"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getImpersonatedEmployeeId } from "@/lib/impersonation";
import { createEmployeeNotification } from "@/lib/notifications";

type Office = "madrid" | "barcelona" | "valencia" | "malaga" | "zaragoza" | "sevilla";

// ── Types ──────────────────────────────────────────────────

export type MyEngagementData = {
  id: string;
  clientName: string;
  engagementName: string;
  engagementCode: string;
  startDate: string | null;
  endDate: string | null;
  weekHours: Map<number, number>;
};

export type AbsenceType = "vacation" | "holiday" | "medical" | "bootcamp" | "other";

export type MyAbsenceData = {
  type: AbsenceType;
  label: string;
  startDate: string;
  endDate: string;
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

export type MyImputacionesData = {
  employeeName: string;
  category: string;
  office: string;
  weeklyHoursTarget: number;
  weekTargetHours: Map<number, number>;
  commercialHours: Map<number, number> | null;
  hasUnassignedHours: boolean;
  weeks: WeekInfo[];
  monthGroups: MonthGroup[];
  engagements: MyEngagementData[];
  absences: MyAbsenceData[];
  engagementWeekMap: Map<string, number>;
  absenceWeekMap: Map<string, number>;
  weekTotals: Map<number, number>;
};

// Base weekly hours for ALL profiles
const BASE_WEEKLY_TARGET = 42;
const BASE_SUMMER_TARGET = 30;

// ── Helpers ────────────────────────────────────────────────

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function dailyHours(d: Date): number {
  if (isSummer(d)) return 6;
  const day = d.getDay();
  if (day === 5) return 6; // Friday
  return 9; // Mon–Thu
}

// Fixed weekly commercial action hours by category
const COMMERCIAL_HOURS: Record<string, { regular: number; summer: number }> = {
  "Senior-Manager": { regular: 21, summer: 15 },
  Manager:          { regular: 29, summer: 21 },
};

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

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Main action ────────────────────────────────────────────

export async function getMyImputaciones(year?: number): Promise<{
  data?: MyImputacionesData;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  // Check impersonation cookie first
  const impersonatedId = await getImpersonatedEmployeeId();

  let employee: { id: string; name: string; office: string; weekly_hours: number; category: string } | null = null;

  if (impersonatedId) {
    // Impersonating: look up employee by ID directly
    const { data } = await supabase
      .from("employees")
      .select("id, name, office, weekly_hours, category")
      .eq("id", impersonatedId)
      .single();
    employee = data;
  } else {
    // Normal: look up by user_id
    const { data } = await supabase
      .from("employees")
      .select("id, name, office, weekly_hours, category")
      .eq("user_id", authData.claims.sub)
      .single();
    employee = data;
  }

  if (!employee) return { error: "Empleado no encontrado." };

  // Block interns and externs
  if (employee.category === "Intern" || employee.category === "Externo") {
    return { error: "Los becarios y externos no tienen acceso a esta sección." };
  }

  const effectiveYear = year ?? new Date().getFullYear();
  const office = (employee.office ?? "madrid") as Office;
  const weeklyHoursTarget = BASE_WEEKLY_TARGET;

  // Commercial action hours (only for Manager / Senior-Manager)
  const commercialDef = COMMERCIAL_HOURS[employee.category];

  // ── Build weeks for the year ────────────────────────
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

  // Current week index
  const nowMonday = getMonday(new Date());
  let currentWeekIdx = weeks.length - 1;
  for (let i = 0; i < weeks.length; i++) {
    if (fmtDate(weeks[i].start) === fmtDate(nowMonday)) {
      currentWeekIdx = i;
      break;
    }
  }

  // ── Month groups for header coloring ─────────────────
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

  // ── 1. Fetch engagements ─────────────────────────────
  const { data: imputaciones } = await supabase
    .from("employee_imputations")
    .select("engagement_id, start_date, end_date, weekly_hours")
    .eq("employee_id", employee.id);

  const engagements: MyEngagementData[] = [];
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

    for (const imp of imputaciones) {
      const eng = engMap.get(imp.engagement_id);
      if (!eng) continue;

      const weekHours = new Map<number, number>();
      const impStart = new Date(imp.start_date + "T00:00:00");
      const impEnd = imp.end_date ? new Date(imp.end_date + "T00:00:00") : yearEnd;

      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        if (impStart <= w.end && impEnd >= w.start) {
          weekHours.set(i, imp.weekly_hours);
          engagementWeekMap.set(`${imp.engagement_id}-${i}`, imp.weekly_hours);
        }
      }

      engagements.push({
        id: imp.engagement_id,
        clientName: clientMap.get(eng.client_id) ?? eng.client_id,
        engagementName: eng.name,
        engagementCode: eng.engagement_code,
        startDate: imp.start_date,
        endDate: imp.end_date,
        weekHours,
      });
    }
  }

  // ── 2. Fetch approved vacations for the year ─────────
  const yearStartStr = fmtDate(yearStart);
  const yearEndStr = fmtDate(yearEnd);

  const { data: vacations } = await supabase
    .from("vacation_requests")
    .select("start_date, end_date, status, is_bootcamp, is_medical_leave, is_other, other_reason")
    .eq("employee_id", employee.id)
    .eq("year", effectiveYear)
    .in("status", ["approved", "pending"]);

  const absences: MyAbsenceData[] = [];
  const absenceWeekMap = new Map<string, number>();

  for (const v of vacations ?? []) {
    const vStart = v.start_date < yearStartStr ? yearStartStr : v.start_date;
    const vEnd = v.end_date > yearEndStr ? yearEndStr : v.end_date;

    let type: AbsenceType = "vacation";
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

  // ── 3. Fetch holidays in the year for this office ────
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
      absences.push({
        type: "holiday",
        label: "Festivos",
        startDate: firstDate,
        endDate: lastDate,
        weekHours,
      });
    }
  }

  // ── Weekly targets, commercial hours, and totals ──
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

  // ── Check if employee has unassigned hours in next 4 weeks ──
  let hasUnassignedHours = false;
  for (let i = currentWeekIdx; i < Math.min(currentWeekIdx + 4, weeks.length); i++) {
    const target = weekTargetHours.get(i) ?? 0;
    const used = weekTotals.get(i) ?? 0;
    const absenceHrs = absences.reduce((s, a) => s + (a.weekHours.get(i) ?? 0), 0);
    const commHrs = commercialHours.get(i) ?? 0;
    if (target - used - absenceHrs - commHrs > 0) {
      hasUnassignedHours = true;
      break;
    }
  }

  return {
    data: {
      employeeName: employee.name,
      category: employee.category,
      office,
      weeklyHoursTarget,
      weekTargetHours,
      commercialHours: commercialDef ? commercialHours : null,
      hasUnassignedHours,
      weeks,
      monthGroups,
      engagements,
      absences,
      engagementWeekMap,
      absenceWeekMap,
      weekTotals,
    },
  };
}

// ── Request engagement action ─────────────────────────────

export async function requestEngagement(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  // Check impersonation
  const impersonatedId = await getImpersonatedEmployeeId();

  let employee: { id: string; name: string } | null = null;

  if (impersonatedId) {
    const { data } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", impersonatedId)
      .single();
    employee = data;
  } else {
    const { data } = await supabase
      .from("employees")
      .select("id, name")
      .eq("user_id", authData.claims.sub)
      .single();
    employee = data;
  }

  if (!employee) return { error: "Empleado no encontrado." };

  // Find the employee's engagements → clients
  const { data: imputaciones } = await supabase
    .from("employee_imputations")
    .select("engagement_id")
    .eq("employee_id", employee.id);

  if (!imputaciones || imputaciones.length === 0) {
    return { error: "No tienes engagements asignados." };
  }

  const engagementIds = [...new Set(imputaciones.map((i) => i.engagement_id))];
  const { data: engRows } = await supabase
    .from("engagements")
    .select("id, client_id")
    .in("id", engagementIds);

  const clientIds = [...new Set((engRows ?? []).map((e) => e.client_id).filter(Boolean))];

  if (clientIds.length === 0) {
    return { error: "No se encontraron clientes asociados." };
  }

  // Find managers/admins of those clients via employee_projects
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select("employee_id, project_id")
    .in("project_id", clientIds);

  const managerCandidateIds = [...new Set((empProjects ?? []).map((ep) => ep.employee_id))];

  // Filter to only managers and admins
  const { data: managers } = await supabase
    .from("employees")
    .select("id, name")
    .in("id", managerCandidateIds)
    .in("category", ["Manager", "Senior-Manager"]);

  const managerIds = new Set<string>();
  (managers ?? []).forEach((m) => managerIds.add(m.id));

  // Also add direct manager
  const { data: empData } = await supabase
    .from("employees")
    .select("manager_id")
    .eq("id", employee.id)
    .single();

  if (empData?.manager_id) {
    managerIds.add(empData.manager_id);
  }

  // Don't notify yourself
  managerIds.delete(employee.id);

  if (managerIds.size === 0) {
    return { error: "No se encontraron managers para notificar." };
  }

  // Send notification to each manager
  for (const managerId of managerIds) {
    await createEmployeeNotification({
      title: "📊 Solicitud de engagement",
      message: `${employee.name} solicita asignación de un nuevo engagement. Tiene horas sin asignar disponibles en las próximas semanas.`,
      employeeId: managerId,
      createdBy: employee.id,
      targetUrl: "/main/admin/imputaciones",
    });
  }

  return { success: true };
}
