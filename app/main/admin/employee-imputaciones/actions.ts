"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


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

  // Fetch engagements from the consola (per-week rows, read-only)
  const { data: consoleRows } = await supabase
    .from("employee_console_imputations")
    .select("engagement_code, lunes, viernes, horas")
    .eq("employee_id", employeeId)
    .order("lunes");

  const engagements: AdminEngagementData[] = [];
  const engagementWeekMap = new Map<string, number>();

  if (consoleRows && consoleRows.length > 0) {
    const codes = [...new Set(consoleRows.map((r) => r.engagement_code))];
    const { data: engRows } = await supabase
      .from("engagements")
      .select("id, name, engagement_code, client_id")
      .in("engagement_code", codes);

    const engMap = new Map((engRows ?? []).map((e) => [e.engagement_code, e]));
    const clientIds = [...new Set((engRows ?? []).map((e) => e.client_id).filter(Boolean))];
    const { data: clientRows } = await supabase
      .from("projects")
      .select("id_engagement, name")
      .in("id_engagement", clientIds);
    const clientMap = new Map((clientRows ?? []).map((c) => [c.id_engagement, c.name]));

    // Map week start (Monday) → week index for the selected year
    const weekIdxByStart = new Map<string, number>();
    for (let i = 0; i < weeks.length; i++) {
      weekIdxByStart.set(fmtDate(weeks[i].start), i);
    }

    // Group rows by engagement code so it appears as one row
    const groups = new Map<string, {
      weekHours: Map<number, number>;
      startDate: string;
      endDate: string;
    }>();

    for (const row of consoleRows) {
      let group = groups.get(row.engagement_code);
      if (!group) {
        group = {
          weekHours: new Map<number, number>(),
          startDate: row.lunes,
          endDate: row.viernes,
        };
        groups.set(row.engagement_code, group);
      }
      if (row.lunes < group.startDate) group.startDate = row.lunes;
      if (row.viernes > group.endDate) group.endDate = row.viernes;

      const idx = weekIdxByStart.get(row.lunes);
      if (idx === undefined) continue; // week outside the selected year
      group.weekHours.set(idx, row.horas);
      engagementWeekMap.set(`${row.engagement_code}-${idx}`, row.horas);
    }

    for (const [code, group] of groups) {
      const eng = engMap.get(code);
      const firstHours = group.weekHours.size > 0 ? [...group.weekHours.values()][0] : 0;
      engagements.push({
        id: code,
        clientName: eng ? (clientMap.get(eng.client_id) ?? eng.client_id) : "",
        engagementName: eng ? eng.name : code,
        engagementCode: code,
        startDate: group.startDate,
        endDate: group.endDate,
        weeklyHours: firstHours,
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
