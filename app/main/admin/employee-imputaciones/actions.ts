"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";


type Office = "madrid" | "barcelona" | "valencia" | "malaga" | "zaragoza" | "sevilla";

// ── Types ──────────────────────────────────────────────────

export type EmployeeOption = {
  id: string;
  name: string;
  category: string;
  email: string;
};

export type AdminEngagementData = {
  id: string;
  clientName: string;
  engagementName: string;
  engagementCode: string;
  startDate: string | null;
  endDate: string | null;
  weeklyHours: number;
  weekHours: Map<number, number>;
};

export type WeekInfo = {
  start: Date;
  end: Date;
  label: string;
  isSummer: boolean;
};

export type MonthGroup = {
  monthKey: string;
  monthName: string;
  startIdx: number;
  endIdx: number;
  colorIdx: number;
};

export type AdminImputacionesData = {
  employeeId: string;
  employeeName: string;
  category: string;
  office: string;
  weeklyHoursTarget: number;
  weekTargetHours: Map<number, number>;
  commercialHours: Map<number, number> | null;
  weeks: WeekInfo[];
  monthGroups: MonthGroup[];
  engagements: AdminEngagementData[];
  absences: { type: string; label: string; startDate: string; endDate: string; weekHours: Map<number, number> }[];
  absenceWeekMap: Map<string, number>;
  engagementWeekMap: Map<string, number>;
  weekTotals: Map<number, number>;
};

export type EngagementOption = {
  id: string;
  name: string;
  code: string;
  clientId: string;
  clientName: string;
  startDate: string | null;
  endDate: string | null;
};

// ── Constants ──────────────────────────────────────────────

const BASE_WEEKLY_TARGET = 42;
const BASE_SUMMER_TARGET = 30;

const COMMERCIAL_HOURS: Record<string, { regular: number; summer: number }> = {
  "Senior-Manager": { regular: 21, summer: 15 },
  Manager:          { regular: 13, summer: 9 },
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Helpers ────────────────────────────────────────────────

function dailyHours(d: Date): number {
  if (isSummer(d)) return 6;
  const day = d.getDay();
  if (day === 5) return 6;
  return 9;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function isSummer(d: Date): boolean {
  const m = d.getMonth();
  const day = d.getDate();
  if (m === 6 && day >= 16) return true;
  if (m === 7) return true;
  if (m === 8 && day <= 15) return true;
  return false;
}

// ── Auth helper ────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") {
    redirect("/main");
  }

  return supabase;
}

// ── Get all employees for the dropdown ─────────────────────

export async function getEmployeesForDropdown(): Promise<{
  data?: EmployeeOption[];
  error?: string;
}> {
  const supabase = await requireAdmin();
  const now = new Date();

  // Get all active employees (no exit_date or exit_date > today)
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, category, email, exit_date")
    .order("name");

  if (error) return { error: error.message };

  const todayStr = fmtDate(now);
  const activeEmployees = (employees ?? []).filter(
    (e) => !e.exit_date || e.exit_date > todayStr
  ).filter(
    (e) => e.category !== "Intern" && e.category !== "Externo"
  );

  return {
    data: activeEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      email: e.email,
    })),
  };
}

// ── Get all engagement options ─────────────────────────────

export async function getAllEngagementOptions(): Promise<{
  data?: EngagementOption[];
  error?: string;
}> {
  const supabase = await requireAdmin();

  const { data: engagements, error } = await supabase
    .from("engagements")
    .select("id, name, engagement_code, client_id, start_date, end_date")
    .order("name");

  if (error) return { error: error.message };

  const clientIds = [...new Set((engagements ?? []).map((e) => e.client_id).filter(Boolean))];
  const { data: clients } = await supabase
    .from("projects")
    .select("id_engagement, name")
    .in("id_engagement", clientIds);

  const clientMap = new Map((clients ?? []).map((c) => [c.id_engagement, c.name]));

  const options: EngagementOption[] = (engagements ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    code: e.engagement_code,
    clientId: e.client_id,
    clientName: clientMap.get(e.client_id) ?? e.client_id,
    startDate: e.start_date,
    endDate: e.end_date,
  }));

  return { data: options };
}

// ── Get full imputaciones data for an employee ─────────────

export async function getAdminEmployeeImputaciones(
  employeeId: string,
  year?: number
): Promise<{
  data?: AdminImputacionesData;
  error?: string;
}> {
  const supabase = await requireAdmin();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, office, weekly_hours, category")
    .eq("id", employeeId)
    .single();

  if (!employee) return { error: "Empleado no encontrado." };

  const effectiveYear = year ?? new Date().getFullYear();
  const office = (employee.office ?? "madrid") as Office;

  // Build weeks for the year
  const yearStart = new Date(effectiveYear, 0, 1);
  const yearEnd = new Date(effectiveYear, 11, 31);
  const firstMonday = getMonday(yearStart);
  const lastMonday = getMonday(yearEnd);

  const weeks: WeekInfo[] = [];
  let current = new Date(firstMonday);
  while (current <= lastMonday || weeks.length === 0) {
    const weekEnd = addDays(current, 6);
    weeks.push({
      start: new Date(current),
      end: weekEnd,
      label: `${current.getDate()}/${current.getMonth() + 1}`,
      isSummer: isSummer(current),
    });
    current = addDays(current, 7);
    if (current > lastMonday && weeks.length > 0) break;
  }

  // Month groups for header coloring
  const monthGroups: MonthGroup[] = [];
  const seen = new Map<string, number>();
  let colorIdx = 0;
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const key = `${w.start.getFullYear()}-${w.start.getMonth()}`;
    if (!seen.has(key)) {
      seen.set(key, colorIdx);
      colorIdx++;
    }
    const ci = seen.get(key)!;
    const monthName = MONTH_NAMES[w.start.getMonth()];
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.monthKey === key) {
      last.endIdx = i;
    } else {
      monthGroups.push({ monthKey: key, monthName, startIdx: i, endIdx: i, colorIdx: ci });
    }
  }

  // Fetch engagements
  const { data: imputaciones } = await supabase
    .from("employee_imputations")
    .select("engagement_id, start_date, end_date, weekly_hours")
    .eq("employee_id", employeeId);

  const engagements: AdminEngagementData[] = [];
  const engagementWeekMap = new Map<string, number>();

  if (imputaciones && imputaciones.length > 0) {
    const engagementIds = [...new Set(imputaciones.map((i) => i.engagement_id))];
    const { data: engRows } = await supabase
      .from("engagements")
      .select("id, name, engagement_code, client_id")
      .in("id", engagementIds);

    const engMap = new Map((engRows ?? []).map((e) => [e.id, e]));
    const clientIds = [...new Set((engRows ?? []).map((e) => e.client_id).filter(Boolean))];
    const { data: clientRows } = await supabase
      .from("projects")
      .select("id_engagement, name")
      .in("id_engagement", clientIds);
    const clientMap = new Map((clientRows ?? []).map((c) => [c.id_engagement, c.name]));

    // Group imputations by engagement_id so split records still appear as one row
    const engGroups = new Map<string, {
      weekHours: Map<number, number>;
      startDate: string;
      endDate: string | null;
    }>();

    for (const imp of imputaciones) {
      const eng = engMap.get(imp.engagement_id);
      if (!eng) continue;

      let group = engGroups.get(imp.engagement_id);
      if (!group) {
        group = {
          weekHours: new Map<number, number>(),
          startDate: imp.start_date,
          endDate: imp.end_date,
        };
        engGroups.set(imp.engagement_id, group);
      }

      const impStart = new Date(imp.start_date + "T00:00:00");
      const impEnd = imp.end_date ? new Date(imp.end_date + "T00:00:00") : yearEnd;

      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        if (impStart <= w.end && impEnd >= w.start) {
          group.weekHours.set(i, imp.weekly_hours);
          engagementWeekMap.set(`${imp.engagement_id}-${i}`, imp.weekly_hours);
        }
      }
    }

    for (const [engagementId, group] of engGroups) {
      const eng = engMap.get(engagementId)!;
      engagements.push({
        id: engagementId,
        clientName: clientMap.get(eng.client_id) ?? eng.client_id,
        engagementName: eng.name,
        engagementCode: eng.engagement_code,
        startDate: group.startDate,
        endDate: group.endDate,
        weeklyHours: [...group.weekHours.values()][0] ?? 0,
        weekHours: group.weekHours,
      });
    }
  }

  // Fetch absences
  const yearStartStr = fmtDate(yearStart);
  const yearEndStr = fmtDate(yearEnd);

  const { data: vacations } = await supabase
    .from("vacation_requests")
    .select("start_date, end_date, status, is_bootcamp, is_medical_leave, is_other, other_reason")
    .eq("employee_id", employeeId)
    .eq("year", effectiveYear)
    .in("status", ["approved", "pending"]);

  type AbsenceItem = { type: string; label: string; startDate: string; endDate: string; weekHours: Map<number, number> };
  const absences: AbsenceItem[] = [];
  const absenceWeekMap = new Map<string, number>();

  for (const v of vacations ?? []) {
    const vStart = v.start_date < yearStartStr ? yearStartStr : v.start_date;
    const vEnd = v.end_date > yearEndStr ? yearEndStr : v.end_date;

    let type = "vacation";
    let label = "Vacaciones";
    if (v.is_bootcamp) { type = "bootcamp"; label = "Bootcamp"; }
    else if (v.is_medical_leave) { type = "medical"; label = "Baja médica"; }
    else if (v.is_other) { type = "other"; label = v.other_reason || "Otros"; }

    const weekHours = new Map<number, number>();
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const vS = new Date(Math.max(new Date(vStart).getTime(), w.start.getTime()));
      const vE = new Date(Math.min(new Date(vEnd).getTime(), w.end.getTime()));
      if (vS > vE) continue;
      let hours = 0;
      const d = new Date(vS);
      while (d <= vE) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) hours += dailyHours(d);
        d.setDate(d.getDate() + 1);
      }
      if (hours > 0) {
        weekHours.set(i, hours);
        absenceWeekMap.set(`${absences.length}-${i}`, hours);
      }
    }

    absences.push({ type, label, startDate: v.start_date, endDate: v.end_date, weekHours });
  }

  // Fetch holidays
  const { data: holidayRows } = await supabase
    .from("public_holidays")
    .select("date, name, scope")
    .in("scope", ["national", office])
    .gte("date", yearStartStr)
    .lte("date", yearEndStr);

  if (holidayRows && holidayRows.length > 0) {
    const holidayDates = new Map<string, string>();
    for (const h of holidayRows) {
      if (!holidayDates.has(h.date)) holidayDates.set(h.date, h.name);
    }

    const weekHours = new Map<number, number>();
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      let hours = 0;
      const d = new Date(w.start);
      while (d <= w.end) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5 && holidayDates.has(fmtDate(d))) hours += dailyHours(d);
        d.setDate(d.getDate() + 1);
      }
      if (hours > 0) {
        weekHours.set(i, hours);
        absenceWeekMap.set(`${absences.length}-${i}`, hours);
      }
    }

    if (weekHours.size > 0) {
      const firstDate = [...holidayDates.keys()].sort()[0];
      const lastDate = [...holidayDates.keys()].sort().pop()!;
      absences.push({ type: "holiday", label: "Festivos", startDate: firstDate, endDate: lastDate, weekHours });
    }
  }

  // Weekly targets, commercial hours, totals
  const commercialDef = COMMERCIAL_HOURS[employee.category];
  const weekTargetHours = new Map<number, number>();
  const weekTotals = new Map<number, number>();
  const commercialHours = new Map<number, number>();

  for (let i = 0; i < weeks.length; i++) {
    const target = weeks[i].isSummer ? BASE_SUMMER_TARGET : BASE_WEEKLY_TARGET;
    weekTargetHours.set(i, target);
    if (commercialDef) {
      commercialHours.set(i, weeks[i].isSummer ? commercialDef.summer : commercialDef.regular);
    }
    let total = 0;
    for (const eng of engagements) {
      total += eng.weekHours.get(i) ?? 0;
    }
    weekTotals.set(i, total);
  }

  return {
    data: {
      employeeId,
      employeeName: employee.name,
      category: employee.category,
      office,
      weeklyHoursTarget: BASE_WEEKLY_TARGET,
      weekTargetHours,
      commercialHours: commercialDef ? commercialHours : null,
      weeks,
      monthGroups,
      engagements,
      absences,
      absenceWeekMap,
      engagementWeekMap,
      weekTotals,
    },
  };
}

// ── Update engagement weekly hours for an employee ─────────
// Splits the imputation so only the edited week gets new hours.

export async function updateEmployeeEngagementHours(
  employeeId: string,
  engagementId: string,
  newWeeklyHours: number,
  weekIdx: number,
  year: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await requireAdmin();

  if (newWeeklyHours < 0) return { error: "Las horas no pueden ser negativas." };

  // Calculate the exact dates of the edited week
  const yearStart = new Date(year, 0, 1);
  const firstMonday = getMonday(yearStart);
  const editedWeekStart = addDays(firstMonday, weekIdx * 7);
  const editedWeekEnd = addDays(editedWeekStart, 6);

  // Fetch all imputations for this employee-engagement pair
  const { data: imputaciones, error: fetchErr } = await supabase
    .from("employee_imputations")
    .select("id, start_date, end_date, weekly_hours")
    .eq("employee_id", employeeId)
    .eq("engagement_id", engagementId);

  if (fetchErr) return { error: fetchErr.message };
  if (!imputaciones || imputaciones.length === 0) return { error: "No hay imputaciones para modificar." };

  // Process each imputation that covers the edited week
  const toDelete: string[] = [];
  const toInsert: { employee_id: string; engagement_id: string; start_date: string; end_date: string | null; weekly_hours: number }[] = [];

  for (const imp of imputaciones) {
    const impStart = new Date(imp.start_date + "T00:00:00");
    const impEnd = imp.end_date ? new Date(imp.end_date + "T00:00:00") : new Date(year, 11, 31);

    // Does this imputation cover the edited week?
    if (impStart > editedWeekEnd || impEnd < editedWeekStart) {
      // No — keep it as-is
      continue;
    }

    // Yes — we need to split it. Delete the original.
    toDelete.push(imp.id);

    const origHours = imp.weekly_hours;

    // Part 1: weeks before the edited week (if any)
    const part1End = addDays(editedWeekStart, -1);
    if (impStart <= part1End) {
      toInsert.push({
        employee_id: employeeId,
        engagement_id: engagementId,
        start_date: fmtDate(impStart),
        end_date: fmtDate(part1End),
        weekly_hours: origHours,
      });
    }

    // Part 2: the edited week itself (only if newWeeklyHours > 0)
    if (newWeeklyHours > 0) {
      toInsert.push({
        employee_id: employeeId,
        engagement_id: engagementId,
        start_date: fmtDate(editedWeekStart),
        end_date: fmtDate(editedWeekEnd),
        weekly_hours: newWeeklyHours,
      });
    }

    // Part 3: weeks after the edited week (if any)
    const part3Start = addDays(editedWeekEnd, 1);
    if (impEnd >= part3Start) {
      toInsert.push({
        employee_id: employeeId,
        engagement_id: engagementId,
        start_date: fmtDate(part3Start),
        end_date: imp.end_date ? imp.end_date : fmtDate(impEnd),
        weekly_hours: origHours,
      });
    }
  }

  // Execute: delete originals, insert splits
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("employee_imputations")
      .delete()
      .in("id", toDelete);
    if (delErr) return { error: delErr.message };
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from("employee_imputations")
      .insert(toInsert);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/main/admin/employee-imputaciones");
  return { success: true };
}

// ── Add a new engagement to an employee ────────────────────

export async function addEmployeeEngagement(
  employeeId: string,
  engagementId: string,
  startDate: string,
  endDate: string | null,
  weeklyHours: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await requireAdmin();

  if (weeklyHours <= 0) return { error: "Las horas deben ser mayores a 0." };

  // Check if already assigned
  const { data: existing } = await supabase
    .from("employee_imputations")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("engagement_id", engagementId)
    .single();

  if (existing) {
    return { error: "Este empleado ya tiene este engagement asignado." };
  }

  // Get the engagement's client
  const { data: engagement } = await supabase
    .from("engagements")
    .select("client_id")
    .eq("id", engagementId)
    .single();

  if (!engagement) return { error: "Engagement no encontrado." };

  // Auto-associate employee to the client if not already
  const { data: existingProject } = await supabase
    .from("employee_projects")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("project_id", engagement.client_id)
    .single();

  if (!existingProject) {
    await supabase.from("employee_projects").insert({
      employee_id: employeeId,
      project_id: engagement.client_id,
    });
  }

  // Create the imputation
  const { error } = await supabase
    .from("employee_imputations")
    .insert({
      employee_id: employeeId,
      engagement_id: engagementId,
      start_date: startDate,
      end_date: endDate,
      weekly_hours: weeklyHours,
    });

  if (error) return { error: error.message };

  revalidatePath("/main/admin/employee-imputaciones");
  return { success: true };
}

// ── Remove an engagement from an employee ──────────────────

export async function removeEmployeeEngagement(
  employeeId: string,
  engagementId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("employee_imputations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("engagement_id", engagementId);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/employee-imputaciones");
  return { success: true };
}
