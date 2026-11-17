"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategoryDays } from "@/lib/categories";
import { countWorkingDays, getHolidaysForOfficeFromDB, type Office } from "@/lib/holidays";
import { notifyVacationRequested } from "@/lib/slack";
import { notifyManagersVacationRequested } from "@/lib/notifications";
import { startsInJanuary, splitJanuaryDays } from "@/lib/vacation-years";

const BOOTCAMP_MAX_DAYS = 2;

/** Remaining days on a balance row, or null when no row exists. */
async function getBalanceRemaining(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  employeeId: string,
  year: number
): Promise<number | null> {
  const { data } = await supabase
    .from("vacation_balances")
    .select("total_days, used_days, pending_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();
  if (!data) return null;
  return data.total_days - data.used_days - data.pending_days;
}

/** Add pending days to a balance row, creating the row when missing. */
async function chargePendingDays(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  employeeId: string,
  year: number,
  days: number,
  totalDays: number
): Promise<void> {
  if (days <= 0) return;

  const { data: balance } = await supabase
    .from("vacation_balances")
    .select("pending_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (balance) {
    await supabase
      .from("vacation_balances")
      .update({ pending_days: balance.pending_days + days })
      .eq("employee_id", employeeId)
      .eq("year", year);
  } else {
    await supabase.from("vacation_balances").insert({
      employee_id: employeeId,
      year,
      total_days: totalDays,
      pending_days: days,
    });
  }
}

export async function requestVacation(
  employeeId: string,
  startDate: string,
  endDate: string,
  daysRequested: number,
  year: number,
  isBootcamp: boolean = false,
  isMedicalLeave: boolean = false,
  isOther: boolean = false,
  otherReason: string = ""
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // year may be overridden for cross-year vacations
  let effectiveYear = year;
  // January requests may charge part of the previous year's balance
  let prevYearDays = 0;

  // Verify the employee belongs to the current user
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated." };

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, category, office, custom_vacation_days")
    .eq("id", employeeId)
    .eq("user_id", authData.claims.sub)
    .single();

  if (empError || !employee) {
    return { error: "Employee not found or access denied." };
  }

  // Recalculate actual working days server-side (ignore weekends + holidays)
  const employeeOffice = (employee.office as Office) ?? "madrid";
  const holidays = await getHolidaysForOfficeFromDB(employeeOffice, supabase);
  const startDateObj = new Date(startDate + "T00:00:00");
  const endDateObj = new Date(endDate + "T00:00:00");
  const serverDaysRequested = countWorkingDays(startDateObj, endDateObj, holidays);

  if (serverDaysRequested <= 0) {
    return { error: "The selected range contains no working days." };
  }

  if (isBootcamp && isMedicalLeave) {
    return { error: "A request cannot be both bootcamp and medical leave." };
  }

  if (isOther && !otherReason.trim()) {
    return { error: "Debes indicar el motivo para solicitar días de \"Otros\"." };
  }

  if (isBootcamp) {
    // Validate against bootcamp limit (max 2 days per year, separate from vacation balance)
    const { data: existingBootcamp } = await supabase
      .from("vacation_requests")
      .select("days_requested")
      .eq("employee_id", employeeId)
      .eq("year", year)
      .eq("is_bootcamp", true)
      .in("status", ["approved", "pending"]);

    const usedBootcamp = (existingBootcamp ?? []).reduce(
      (sum, r) => sum + r.days_requested,
      0
    );
    const remainingBootcamp = BOOTCAMP_MAX_DAYS - usedBootcamp;

    if (serverDaysRequested > remainingBootcamp) {
      return {
        error: `No tienes suficientes días de Bootcamp. Te quedan ${remainingBootcamp} de ${BOOTCAMP_MAX_DAYS} días.`,
      };
    }
  } else if (!isMedicalLeave && !isOther) {
    // Detect cross-year vacation (e.g. Dec 29 → Jan 5)
    const endDateObj = new Date(endDate + "T00:00:00");
    const endYear = endDateObj.getFullYear();
    const crossYear = endYear > year;
    // January-only request: consume previous year balance first, then this year
    const januarySplit = !crossYear && startsInJanuary(startDate);

    // Compute category-based maximum days for the requested year
    const maxDays = await getCategoryDays(supabase, employee.category, employee.custom_vacation_days);

    if (januarySplit) {
      const prevYear = year - 1;
      const remainingPrev = (await getBalanceRemaining(supabase, employeeId, prevYear)) ?? 0;
      const remainingCurr =
        (await getBalanceRemaining(supabase, employeeId, year)) ?? maxDays;
      const available = remainingPrev + remainingCurr;

      if (serverDaysRequested > available) {
        return {
          error: `Insufficient vacation balance. You have ${available} of ${maxDays} days remaining.`,
        };
      }

      const split = splitJanuaryDays(serverDaysRequested, remainingPrev);
      prevYearDays = split.prevYearDays;
    } else {
      // Sum all approved + pending regular vacation days (excluding bootcamp, medical leave, and 'Otros')
      const { data: existingRequests } = await supabase
        .from("vacation_requests")
        .select("days_requested")
        .eq("employee_id", employeeId)
        .eq("year", year)
        .eq("is_bootcamp", false)
        .eq("is_medical_leave", false)
        .eq("is_other", false)
        .in("status", ["approved", "pending"]);

      const usedAndPending = (existingRequests ?? []).reduce(
        (sum, r) => sum + r.days_requested,
        0
      );
      let remaining = maxDays - usedAndPending;

      // For cross-year vacations: if the start year has insufficient balance,
      // try using the next year's balance instead.
      if (crossYear && serverDaysRequested > remaining) {
        const nextYear = year + 1;
        const nextMaxDays = await getCategoryDays(supabase, employee.category, employee.custom_vacation_days);

        const { data: nextYearRequests } = await supabase
          .from("vacation_requests")
          .select("days_requested")
          .eq("employee_id", employeeId)
          .eq("year", nextYear)
          .eq("is_bootcamp", false)
          .eq("is_medical_leave", false)
          .eq("is_other", false)
          .in("status", ["approved", "pending"]);

        const nextUsedAndPending = (nextYearRequests ?? []).reduce(
          (sum, r) => sum + r.days_requested,
          0
        );
        const nextRemaining = nextMaxDays - nextUsedAndPending;

        if (serverDaysRequested <= nextRemaining) {
          effectiveYear = nextYear;
          remaining = nextRemaining;
        }
      }

      if (serverDaysRequested > remaining) {
        return {
          error: `Insufficient vacation balance. You have ${remaining} of ${maxDays} days remaining.`,
        };
      }
    }
  }

  // Create the request — bootcamp, medical leave, and other days are auto-approved
  const { data: insertedRequest, error: insertError } = await supabase
    .from("vacation_requests")
    .insert({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate,
      days_requested: serverDaysRequested,
      status: isBootcamp || isMedicalLeave || isOther ? "approved" : "pending",
      year: effectiveYear,
      prev_year_days: prevYearDays,
      is_bootcamp: isBootcamp,
      is_medical_leave: isMedicalLeave,
      is_other: isOther,
      other_reason: isOther ? otherReason.trim() : null,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  // Notify admins via Slack
  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .single();
  await notifyVacationRequested({
    employeeName: emp?.name ?? "Empleado",
    startDate,
    endDate,
    days: serverDaysRequested,
  });

  // In-app notification to managers of the employee's projects
  if (!isBootcamp && !isMedicalLeave && !isOther) {
    await notifyManagersVacationRequested({
      employeeId,
      employeeName: emp?.name ?? "Empleado",
      startDate,
      endDate,
      days: serverDaysRequested,
      isBootcamp,
      isMedicalLeave,
      vacationRequestId: insertedRequest?.id,
    });
  }

  // Bootcamp, medical leave, and 'Otros' requests do NOT consume the regular vacation balance
  if (!isBootcamp && !isMedicalLeave && !isOther) {
    const maxDays = await getCategoryDays(supabase, employee.category, employee.custom_vacation_days);
    const currentYearDays = serverDaysRequested - prevYearDays;

    // January: charge leftover days to the previous year first
    await chargePendingDays(supabase, employeeId, year - 1, prevYearDays, maxDays);
    // Remainder (or full amount for non-January) on the request year
    await chargePendingDays(supabase, employeeId, effectiveYear, currentYearDays, maxDays);
  }

  return {};
}

export async function cancelVacationRequest(
  requestId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated." };

  const { data: employee } = await supabase
    .from("employees")
    .select("id, office")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found." };

  const { data: req } = await supabase
    .from("vacation_requests")
    .select("id, status, start_date, end_date, days_requested, year, prev_year_days, employee_id, is_bootcamp, is_medical_leave, is_other")
    .eq("id", requestId)
    .eq("employee_id", employee.id)
    .single();

  if (!req) return { error: "Request not found or access denied." };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(req.start_date + "T00:00:00");

  const isCancellable =
    req.status === "pending" ||
    (req.status === "approved" && startDate > today);

  if (!isCancellable) {
    return { error: "This request cannot be cancelled." };
  }

  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  if (updErr) return { error: updErr.message };

  // Bootcamp, medical leave, and 'Otros' requests do not touch the vacation balance
  if (!req.is_bootcamp && !req.is_medical_leave && !req.is_other) {
    // Recalculate actual working days server-side to ensure balance accuracy
    const employeeOffice = (employee.office as Office) ?? "madrid";
    const holidays = await getHolidaysForOfficeFromDB(employeeOffice, supabase);
    const actualDays = countWorkingDays(
      new Date(req.start_date + "T00:00:00"),
      new Date(req.end_date + "T00:00:00"),
      holidays
    );

    const releaseDays = (year: number, days: number) => {
      if (days <= 0) return Promise.resolve();
      return supabase
        .from("vacation_balances")
        .select("pending_days, used_days")
        .eq("employee_id", employee.id)
        .eq("year", year)
        .single()
        .then(async ({ data: bal }) => {
          if (!bal) return;
          const patch =
            req.status === "pending"
              ? { pending_days: Math.max(0, bal.pending_days - days) }
              : { used_days: Math.max(0, bal.used_days - days) };
          await supabase
            .from("vacation_balances")
            .update(patch)
            .eq("employee_id", employee.id)
            .eq("year", year);
        });
    };

    // Release from the same years that were charged (January split-aware)
    const prevDays = Math.min(req.prev_year_days ?? 0, actualDays);
    const currentDays = actualDays - prevDays;
    await releaseDays(req.year - 1, prevDays);
    await releaseDays(req.year, currentDays);
  }

  return {};
}
