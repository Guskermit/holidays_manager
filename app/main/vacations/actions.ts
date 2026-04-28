"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategoryDays } from "@/lib/categories";
import { notifyVacationRequested } from "@/lib/slack";

export async function requestVacation(
  employeeId: string,
  startDate: string,
  endDate: string,
  daysRequested: number,
  year: number
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Verify the employee belongs to the current user
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated." };

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, category")
    .eq("id", employeeId)
    .eq("user_id", authData.claims.sub)
    .single();

  if (empError || !employee) {
    return { error: "Employee not found or access denied." };
  }

  // Compute category-based maximum days
  const maxDays = await getCategoryDays(supabase, employee.category);

  // Sum all approved + pending days for the year
  const { data: existingRequests } = await supabase
    .from("vacation_requests")
    .select("days_requested")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("status", ["approved", "pending"]);

  const usedAndPending = (existingRequests ?? []).reduce(
    (sum, r) => sum + r.days_requested,
    0
  );
  const remaining = maxDays - usedAndPending;

  if (daysRequested > remaining) {
    return {
      error: `Insufficient vacation balance. You have ${remaining} of ${maxDays} days remaining.`,
    };
  }

  // Create the request
  const { error: insertError } = await supabase.from("vacation_requests").insert({
    employee_id: employeeId,
    start_date: startDate,
    end_date: endDate,
    days_requested: daysRequested,
    status: "pending",
    year,
  });

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
    days: daysRequested,
  });

  // Update or create balance
  const { data: balance } = await supabase
    .from("vacation_balances")
    .select("pending_days, total_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (balance) {
    await supabase
      .from("vacation_balances")
      .update({ pending_days: balance.pending_days + daysRequested })
      .eq("employee_id", employeeId)
      .eq("year", year);
  } else {
    await supabase.from("vacation_balances").insert({
      employee_id: employeeId,
      year,
      total_days: maxDays,
      pending_days: daysRequested,
    });
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
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found." };

  const { data: req } = await supabase
    .from("vacation_requests")
    .select("id, status, start_date, days_requested, year, employee_id")
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

  // Restore days in balance
  const { data: bal } = await supabase
    .from("vacation_balances")
    .select("pending_days, used_days")
    .eq("employee_id", employee.id)
    .eq("year", req.year)
    .single();

  if (bal) {
    const patch =
      req.status === "pending"
        ? { pending_days: Math.max(0, bal.pending_days - req.days_requested) }
        : { used_days: Math.max(0, bal.used_days - req.days_requested) };

    await supabase
      .from("vacation_balances")
      .update(patch)
      .eq("employee_id", employee.id)
      .eq("year", req.year);
  }

  return {};
}
