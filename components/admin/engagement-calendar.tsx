"use client";

import { useState, useTransition, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { strings } from "@/lib/strings";
import { CATEGORY_LABELS, type Category, sortEmployeesByCategory } from "@/lib/categories";
import {
  saveEngagementImputaciones,
  type EngagementRow,
  type EngagementEmployee,
  type HoursSettingsRow,
} from "@/app/main/admin/imputaciones/actions";
import {
  SaveIcon,
  ArrowLeftIcon,
  UsersIcon,
  BriefcaseIcon,
  CopyIcon,
  Trash2Icon,
  EyeOffIcon,
  EyeIcon,
  ArrowRightIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";

type Props = {
  engagement: EngagementRow;
  employees: EngagementEmployee[];
  existingImputaciones: {
    employee_id: string;
    start_date: string;
    end_date: string | null;
    weekly_hours: number;
  }[];
  otherEngagementImputaciones: {
    employee_id: string;
    engagement_id: string;
    start_date: string;
    end_date: string | null;
    weekly_hours: number;
  }[];
  engagementNames: Record<string, string>;
  hoursSettings: HoursSettingsRow[];
  holidaysByOffice: Record<string, string[]>;
  vacations: {
    employee_id: string;
    start_date: string;
    end_date: string;
  }[];
};

type WeekInfo = {
  start: Date;
  end: Date;
  label: string;
  isSummer: boolean;
};

// ── Month color palette ──────────────────────────────────
const MONTH_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-700 dark:text-lime-300", border: "border-lime-200 dark:border-lime-800" },
  { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Helpers ────────────────────────────────────────────────

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

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isSummer(date: Date): boolean {
  const m = date.getMonth(); // 0-indexed
  const d = date.getDate();
  // Jul 16 – Sep 15
  if (m === 6 && d >= 16) return true; // Jul 16–31
  if (m === 7) return true;             // Aug 1–31
  if (m === 8 && d <= 15) return true;  // Sep 1–15
  return false;
}

function weeksBetween(start: Date, end: Date): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  let current = getMonday(start);
  const lastMonday = getMonday(end);

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

  return weeks;
}

function getDefaultHours(
  category: string,
  isSummerWeek: boolean,
  settings: HoursSettingsRow[]
): number {
  const cat = (CATEGORY_LABELS as Record<string, string>)[category] ?? category;
  const row = settings.find(
    (s) =>
      s.category === category ||
      (CATEGORY_LABELS as Record<string, string>)[s.category] === cat
  );
  if (row) {
    return isSummerWeek ? row.summer_hours : row.regular_hours;
  }
  // Fallback defaults
  const defaults: Record<string, [number, number]> = {
    Staff: [42, 30],
    Senior: [42, 30],
    Manager: [29, 21],
    "Senior-Manager": [21, 15],
    Externo: [42, 30],
    Socio: [42, 30],
    Intern: [42, 30],
  };
  const d = defaults[category] ?? [42, 30];
  return isSummerWeek ? d[1] : d[0];
}

function getHolidaysForOffice(
  office: string | null,
  holidaysByOffice: Record<string, string[]>
): Set<string> {
  if (!office) return new Set();
  return new Set(holidaysByOffice[office] ?? []);
}

function countNonHolidayWorkdays(
  weekStart: Date,
  weekEnd: Date,
  holidays: Set<string>
): number {
  let count = 0;
  const d = new Date(weekStart);
  while (d <= weekEnd) {
    const day = d.getDay();
    if (day >= 1 && day <= 5 && !holidays.has(formatDate(d))) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function countVacationDaysInWeek(
  empId: string,
  weekStart: Date,
  weekEnd: Date,
  vacations: Props["vacations"]
): number {
  let count = 0;
  for (const v of vacations) {
    if (v.employee_id !== empId) continue;
    const vStart = new Date(Math.max(v.start_date.localeCompare(formatDate(weekStart)) <= 0 ? weekStart.getTime() : new Date(v.start_date).getTime(), weekStart.getTime()));
    const vEnd = new Date(Math.min(v.end_date.localeCompare(formatDate(weekEnd)) >= 0 ? weekEnd.getTime() : new Date(v.end_date).getTime(), weekEnd.getTime()));
    if (vStart > vEnd) continue;
    const d = new Date(vStart);
    while (d <= vEnd) {
      const day = d.getDay();
      if (day >= 1 && day <= 5) count++;
      d.setDate(d.getDate() + 1);
    }
  }
  return count;
}

function hasHolidayInWeek(
  start: Date,
  end: Date,
  holidays: Set<string>
): boolean {
  const d = new Date(start);
  while (d <= end) {
    if (holidays.has(formatDate(d))) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

// ── Component ──────────────────────────────────────────────

export function EngagementCalendar({
  engagement,
  employees: initialEmployees,
  existingImputaciones,
  otherEngagementImputaciones,
  engagementNames,
  hoursSettings,
  holidaysByOffice,
  vacations,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Employee hours: Map<empId, Map<weekIdx, hours>>
  const [hours, setHours] = useState<Map<string, Map<number, number>>>(
    () => new Map()
  );

  // Base hours per employee (for copy-to-all-weeks feature)
  const [baseHours, setBaseHours] = useState<Map<string, number>>(() => new Map());

  // Hide past weeks toggle (enabled by default)
  const [hidePastWeeks, setHidePastWeeks] = useState(true);

  // Copy hours between employees
  const [copySourceEmp, setCopySourceEmp] = useState<string>("");
  const [copyTargetEmp, setCopyTargetEmp] = useState<string>("");

  // Track which past weeks have been explicitly cleared to 0
  // (key format: "empId-weekIdx")
  // Persisted in localStorage per engagement so it survives page reloads
  const [clearedWeeks, setClearedWeeks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`clearedWeeks_${engagement.id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Show remaining hours toggle
  const [showRemaining, setShowRemaining] = useState(false);

  // Weeks that need correction (highlighted in red after save warning)
  const [highlightWeeks, setHighlightWeeks] = useState<Map<string, boolean>>(new Map());

  // Save warning state
  const [saveWarning, setSaveWarning] = useState<{
    incomplete: { empId: string; empName: string; weekIdx: number; weekLabel: string; remaining: number }[];
  } | null>(null);

  // Persist clearedWeeks to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        `clearedWeeks_${engagement.id}`,
        JSON.stringify([...clearedWeeks])
      );
    } catch { /* ignore */ }
  }, [clearedWeeks, engagement.id]);

  // Generate weeks
  const weeks = useMemo(() => {
    if (!engagement.start_date) return [];
    const start = new Date(engagement.start_date);
    const end = engagement.end_date
      ? new Date(engagement.end_date)
      : addDays(start, 84); // default ~12 weeks
    return weeksBetween(start, end);
  }, [engagement.start_date, engagement.end_date]);

  // Current week index (for highlighting & past weeks logic)
  const currentWeekIdx = useMemo(() => {
    const now = new Date();
    const nowMonday = getMonday(now);
    for (let i = 0; i < weeks.length; i++) {
      if (formatDate(weeks[i].start) === formatDate(nowMonday)) return i;
      if (weeks[i].start > nowMonday) return Math.max(0, i - 1);
    }
    return weeks.length - 1;
  }, [weeks]);

  // Visible week indices (respecting hidePastWeeks)
  const visibleWeekIndices = useMemo(() => {
    if (!hidePastWeeks) return weeks.map((_, i) => i);
    return weeks.map((_, i) => i).filter((i) => i >= currentWeekIdx);
  }, [weeks, hidePastWeeks, currentWeekIdx]);

  // Month groups for header coloring
  const monthGroups = useMemo(() => {
    const groups: { monthKey: string; monthName: string; startIdx: number; endIdx: number; colorIdx: number }[] = [];
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
      const last = groups[groups.length - 1];
      if (last && last.monthKey === key) {
        last.endIdx = i;
      } else {
        groups.push({ monthKey: key, monthName, startIdx: i, endIdx: i, colorIdx: ci });
      }
    }
    return groups;
  }, [weeks]);

  // Map weekIdx -> monthColor
  const weekColorMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of monthGroups) {
      for (let i = g.startIdx; i <= g.endIdx; i++) {
        map.set(i, g.colorIdx);
      }
    }
    return map;
  }, [monthGroups]);

  // ── Remaining hours calculation ──────────────────────
  // For each employee+week: expectedHours - (this engagement hours + other engagements hours)
  const remainingHours = useMemo(() => {
    const map = new Map<string, number>(); // key: "empId-weekIdx"
    const otherImps = otherEngagementImputaciones;

    for (const emp of initialEmployees) {
      const empH = hours.get(emp.id) ?? new Map();
      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        // Calculate expected hours for this week
        const base = getDefaultHours(emp.category, w.isSummer, hoursSettings);
        const empHolidays = getHolidaysForOffice(emp.office, holidaysByOffice);
        const workdays = countNonHolidayWorkdays(w.start, w.end, empHolidays);
        const vacDays = countVacationDaysInWeek(emp.id, w.start, w.end, vacations);
        const dailyHours = base / 5;
        const effectiveDays = Math.max(0, workdays - vacDays);
        const expectedHours = Math.round(dailyHours * effectiveDays * 10) / 10;

        // Hours assigned in OTHER engagements for this week
        let otherHours = 0;
        const otherEngDetails: { engId: string; engName: string; hours: number }[] = [];
        const engHoursMap = new Map<string, number>();
        for (const imp of otherImps) {
          if (imp.employee_id !== emp.id) continue;
          if (imp.start_date <= formatDate(w.end) && (!imp.end_date || imp.end_date >= formatDate(w.start))) {
            const existing = engHoursMap.get(imp.engagement_id) ?? 0;
            engHoursMap.set(imp.engagement_id, existing + imp.weekly_hours);
          }
        }
        for (const [engId, engH] of engHoursMap) {
          otherHours += engH;
          otherEngDetails.push({
            engId,
            engName: engagementNames[engId] ?? engId,
            hours: engH,
          });
        }

        // Hours in THIS engagement for this week
        const thisHours = empH.get(i) ?? 0;

        const remaining = Math.round((expectedHours - thisHours - otherHours) * 10) / 10;
        map.set(`${emp.id}-${i}`, remaining);
      }
    }
    return map;
  }, [initialEmployees, weeks, hoursSettings, holidaysByOffice, vacations, otherEngagementImputaciones, engagementNames, hours]);

  // Detailed breakdown for tooltips
  const remainingBreakdown = useMemo(() => {
    const map = new Map<string, {
      expectedHours: number;
      thisHours: number;
      otherHours: number;
      holidays: number;
      vacationDays: number;
      otherEngagements: { engName: string; hours: number }[];
      holidayDates: string[];
    }>();

    for (const emp of initialEmployees) {
      const empH = hours.get(emp.id) ?? new Map();
      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        const base = getDefaultHours(emp.category, w.isSummer, hoursSettings);
        const empHolidays = getHolidaysForOffice(emp.office, holidaysByOffice);
        const workdays = countNonHolidayWorkdays(w.start, w.end, empHolidays);
        const vacDays = countVacationDaysInWeek(emp.id, w.start, w.end, vacations);
        const dailyHours = base / 5;
        const effectiveDays = Math.max(0, workdays - vacDays);
        const expectedHours = Math.round(dailyHours * effectiveDays * 10) / 10;

        // Holiday dates in this week
        const holidayDates: string[] = [];
        const d = new Date(w.start);
        while (d <= w.end) {
          if (empHolidays.has(formatDate(d)) && d.getDay() >= 1 && d.getDay() <= 5) {
            holidayDates.push(formatDate(d));
          }
          d.setDate(d.getDate() + 1);
        }

        // Other engagements
        const engHoursMap = new Map<string, number>();
        for (const imp of otherEngagementImputaciones) {
          if (imp.employee_id !== emp.id) continue;
          if (imp.start_date <= formatDate(w.end) && (!imp.end_date || imp.end_date >= formatDate(w.start))) {
            engHoursMap.set(imp.engagement_id, (engHoursMap.get(imp.engagement_id) ?? 0) + imp.weekly_hours);
          }
        }
        const otherEngagements = [...engHoursMap.entries()].map(([engId, h]) => ({
          engName: engagementNames[engId] ?? engId,
          hours: h,
        }));

        map.set(`${emp.id}-${i}`, {
          expectedHours,
          thisHours: empH.get(i) ?? 0,
          otherHours: otherEngagements.reduce((s, e) => s + e.hours, 0),
          holidays: holidayDates.length,
          vacationDays: vacDays,
          otherEngagements,
          holidayDates,
        });
      }
    }
    return map;
  }, [initialEmployees, weeks, hoursSettings, holidaysByOffice, vacations, otherEngagementImputaciones, engagementNames, hours]);

  // Calculate default hours for an employee in a week
  const calcDefaultHours = useCallback(
    (emp: EngagementEmployee, week: WeekInfo): number => {
      const base = getDefaultHours(emp.category, week.isSummer, hoursSettings);
      const empHolidays = getHolidaysForOffice(emp.office, holidaysByOffice);
      const workdays = countNonHolidayWorkdays(
        week.start,
        week.end,
        empHolidays
      );
      const vacDays = countVacationDaysInWeek(
        emp.id,
        week.start,
        week.end,
        vacations
      );
      const dailyHours = base / 5;
      const effectiveDays = Math.max(0, workdays - vacDays);
      return Math.round(dailyHours * effectiveDays * 10) / 10;
    },
    [hoursSettings, holidaysByOffice, vacations]
  );

  // Initialize hours from existing imputaciones or defaults
  useEffect(() => {
    const map = new Map<string, Map<number, number>>();
    for (const emp of initialEmployees) {
      const empHours = new Map<number, number>();
      for (let i = 0; i < weeks.length; i++) {
        // Check if this week was explicitly cleared (past week set to 0)
        if (clearedWeeks.has(`${emp.id}-${i}`)) {
          empHours.set(i, 0);
          continue;
        }
        // Find the most specific imputation covering this week
        const matching = existingImputaciones
          .filter(
            (imp) =>
              imp.employee_id === emp.id &&
              imp.start_date <= formatDate(weeks[i].end) &&
              (!imp.end_date || imp.end_date >= formatDate(weeks[i].start))
          )
          .sort((a, b) => b.start_date.localeCompare(a.start_date));
        const existing = matching[0];
        if (existing) {
          empHours.set(i, existing.weekly_hours);
        } else {
          empHours.set(i, calcDefaultHours(emp, weeks[i]));
        }
      }
      map.set(emp.id, empHours);
    }
    setHours(map);
  }, [initialEmployees, weeks, existingImputaciones, calcDefaultHours, clearedWeeks]);

  // Handle hours change
  function updateHours(empId: string, weekIdx: number, value: number) {
    setHours((prev) => {
      const next = new Map(prev);
      const empMap = new Map(next.get(empId) ?? new Map());
      empMap.set(weekIdx, value);
      next.set(empId, empMap);
      return next;
    });
  }

  // ── Copy base hours to all weeks for an employee ──────
  function handleCopyBaseToAllWeeks(empId: string) {
    const base = baseHours.get(empId);
    if (base === undefined || base === 0) return;

    const emp = initialEmployees.find((e) => e.id === empId);
    if (!emp) return;

    setHours((prev) => {
      const next = new Map(prev);
      const empMap = new Map(next.get(empId) ?? new Map());
      const empHolidays = getHolidaysForOffice(emp.office, holidaysByOffice);

      for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        const workdays = countNonHolidayWorkdays(w.start, w.end, empHolidays);
        const vacDays = countVacationDaysInWeek(emp.id, w.start, w.end, vacations);
        const effectiveDays = Math.max(0, workdays - vacDays);
        const dailyHours = base / 5;
        empMap.set(i, Math.round(dailyHours * effectiveDays * 10) / 10);
      }

      next.set(empId, empMap);
      return next;
    });
  }

  // ── Copy hours from one employee to another ───────────
  function handleCopyHoursBetweenEmployees() {
    if (!copySourceEmp || !copyTargetEmp) return;
    if (copySourceEmp === copyTargetEmp) return;

    setHours((prev) => {
      const next = new Map(prev);
      const sourceHours = next.get(copySourceEmp);
      if (!sourceHours) return prev;

      const targetMap = new Map<number, number>();
      for (const [weekIdx, h] of sourceHours) {
        targetMap.set(weekIdx, h);
      }
      next.set(copyTargetEmp, targetMap);
      return next;
    });

    setSuccess(strings.imputaciones.copyHoursButton + " ✓");
    setTimeout(() => setSuccess(null), 2000);
  }

  // ── Clear past weeks ──────────────────────────────────
  function handleClearPastWeeks() {
    if (!window.confirm(strings.imputaciones.clearPastWeeksConfirm)) return;

    const newCleared = new Set(clearedWeeks);
    setHours((prev) => {
      const next = new Map(prev);
      for (const emp of initialEmployees) {
        const empMap = new Map(next.get(emp.id) ?? new Map());
        for (let i = 0; i < currentWeekIdx; i++) {
          empMap.set(i, 0);
          newCleared.add(`${emp.id}-${i}`);
        }
        next.set(emp.id, empMap);
      }
      return next;
    });
    setClearedWeeks(newCleared);

    setSuccess(strings.imputaciones.clearPastWeeks + " ✓");
    setTimeout(() => setSuccess(null), 2000);
  }

  // ── Save ────────────────────────────────────────────────
  function handleSave() {
    setError(null);
    setSuccess(null);
    setSaveWarning(null);
    setHighlightWeeks(new Map());

    // Check for incomplete hours across visible weeks
    const incomplete: { empId: string; empName: string; weekIdx: number; weekLabel: string; remaining: number }[] = [];
    for (const emp of initialEmployees) {
      for (const wi of visibleWeekIndices) {
        const rem = remainingHours.get(`${emp.id}-${wi}`) ?? 0;
        if (rem > 0.5) { // tolerance for rounding
          incomplete.push({
            empId: emp.id,
            empName: emp.name,
            weekIdx: wi,
            weekLabel: weeks[wi].label,
            remaining: rem,
          });
        }
      }
    }

    if (incomplete.length > 0) {
      setSaveWarning({ incomplete });
      // Still save, but show warning
    }

    startTransition(async () => {
      const assignments: {
        employeeId: string;
        startDate: string;
        endDate: string | null;
        weeklyHours: number;
      }[] = [];

      for (const emp of initialEmployees) {
        const empH = hours.get(emp.id);
        if (!empH) continue;

        // Find first and last week with hours > 0
        let firstWeek = -1;
        let lastWeek = -1;
        for (let i = 0; i < weeks.length; i++) {
          const h = empH.get(i) ?? 0;
          if (h > 0) {
            if (firstWeek === -1) firstWeek = i;
            lastWeek = i;
          }
        }
        if (firstWeek === -1) continue;

        assignments.push({
          employeeId: emp.id,
          startDate: formatDate(weeks[firstWeek].start),
          endDate: formatDate(weeks[lastWeek].end),
          weeklyHours: empH.get(firstWeek) ?? 0,
        });
      }

      const result = await saveEngagementImputaciones(
        engagement.id,
        assignments
      );
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(strings.imputaciones.calendarSaveSuccess);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/main/admin/imputaciones")}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BriefcaseIcon className="size-5" />
              <span className="text-muted-foreground">
                {engagement.engagement_code}
              </span>
              {engagement.name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <span>{engagement.client_name}</span>
              {engagement.start_date && (
                <span>
                  {new Date(engagement.start_date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {engagement.end_date && (
                <span>
                  –{" "}
                  {new Date(engagement.end_date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {(engagement.total_amount ?? 0) > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {new Intl.NumberFormat("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  }).format(engagement.total_amount)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-1.5">
              {success}
            </p>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            <SaveIcon className="size-4 mr-1.5" />
            {isPending ? strings.common.saving : strings.common.save}
          </Button>
        </div>
      </div>

      {/* Toolbar: hide past, clear past, copy between employees, remaining hours */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Hide past weeks toggle */}
        <Button
          variant={hidePastWeeks ? "default" : "outline"}
          size="sm"
          onClick={() => setHidePastWeeks(!hidePastWeeks)}
        >
          {hidePastWeeks ? (
            <EyeIcon className="size-3.5 mr-1" />
          ) : (
            <EyeOffIcon className="size-3.5 mr-1" />
          )}
          {hidePastWeeks ? strings.imputaciones.showAllWeeks : strings.imputaciones.hidePastWeeks}
        </Button>

        {/* Clear past weeks */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearPastWeeks}
        >
          <Trash2Icon className="size-3.5 mr-1" />
          {strings.imputaciones.deletePast}
        </Button>

        {/* Show remaining hours toggle */}
        <Button
          variant={showRemaining ? "default" : "outline"}
          size="sm"
          onClick={() => setShowRemaining(!showRemaining)}
        >
          <ClockIcon className="size-3.5 mr-1" />
          {showRemaining ? strings.imputaciones.hideRemaining : strings.imputaciones.showRemaining}
        </Button>

        {/* Copy hours between employees */}
        <div className="flex items-center gap-1.5 ml-2 border-l pl-3">
          <CopyIcon className="size-3.5 text-muted-foreground" />
          <select
            value={copySourceEmp}
            onChange={(e) => setCopySourceEmp(e.target.value)}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">{strings.imputaciones.copyHoursFrom}</option>
            {initialEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <ArrowRightIcon className="size-3 text-muted-foreground" />
          <select
            value={copyTargetEmp}
            onChange={(e) => setCopyTargetEmp(e.target.value)}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">{strings.imputaciones.copyHoursTo}</option>
            {initialEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            disabled={!copySourceEmp || !copyTargetEmp || copySourceEmp === copyTargetEmp}
            onClick={handleCopyHoursBetweenEmployees}
          >
            {strings.imputaciones.copyHoursButton}
          </Button>
        </div>
      </div>

      {/* Save warning */}
      {saveWarning && saveWarning.incomplete.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="size-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {strings.imputaciones.saveWarningTitle(saveWarning.incomplete.length)}
              </p>
              <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300 space-y-0.5 max-h-32 overflow-y-auto">
                {saveWarning.incomplete.map((item, idx) => (
                  <li key={idx}>
                    {item.empName} — {strings.imputaciones.weekLabel}: {item.weekLabel} → {item.remaining}h {strings.imputaciones.remaining}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={() => {
                  // Highlight incomplete weeks in red
                  const highlights = new Map<string, boolean>();
                  for (const item of saveWarning.incomplete) {
                    highlights.set(`${item.empId}-${item.weekIdx}`, true);
                  }
                  setHighlightWeeks(highlights);
                  setHidePastWeeks(false); // Show all weeks so user can see them
                  setSaveWarning(null);
                }}
              >
                {strings.imputaciones.fixButton}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Employees legend */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UsersIcon className="size-3" />
          {initialEmployees.length} empleado{initialEmployees.length !== 1 ? "s" : ""}
        </span>
        {sortEmployeesByCategory(initialEmployees).map((emp) => (
          <span
            key={emp.id}
            className="rounded-full bg-muted px-2 py-0.5"
          >
            {emp.name} ({CATEGORY_LABELS[emp.category as Category] ?? emp.category})
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {initialEmployees.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.imputaciones.calendarNoEmployees}
        </div>
      ) : weeks.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.imputaciones.calendarNoDates}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              {/* Month name row */}
              <tr>
                <th className="text-left px-3 py-1 font-medium sticky left-0 bg-card z-10 min-w-[160px]" />
                {monthGroups.map((g) => {
                  const color = MONTH_COLORS[g.colorIdx % MONTH_COLORS.length];
                  // Count visible weeks in this group's range
                  const visibleInRange = visibleWeekIndices.filter(
                    (vi) => vi >= g.startIdx && vi <= g.endIdx
                  );
                  if (visibleInRange.length === 0) return null;
                  // Use the first visible week index for the month name year
                  const firstVisibleIdx = visibleInRange[0];
                  return (
                    <th
                      key={g.monthKey}
                      colSpan={visibleInRange.length}
                      className={`text-center px-1 py-1 font-bold text-[11px] border-b ${color.bg} ${color.text} ${color.border}`}
                    >
                      {g.monthName} {weeks[firstVisibleIdx].start.getFullYear()}
                    </th>
                  );
                })}
                <th className="text-center px-3 py-1 font-medium sticky right-0 bg-card z-10" />
              </tr>
              {/* Week header row */}
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted z-10 min-w-[160px]">
                  {strings.imputaciones.calendarColEmployee}
                </th>
                {weeks.map((w, i) => {
                  if (!visibleWeekIndices.includes(i)) return null;
                  const colorIdx = weekColorMap.get(i) ?? 0;
                  const color = MONTH_COLORS[colorIdx % MONTH_COLORS.length];
                  const isCurrentWeek = i === currentWeekIdx;
                  return (
                    <th
                      key={i}
                      className={`text-center px-2 py-2 font-medium min-w-[60px] border-b-2 ${color.border} ${
                        w.isSummer
                          ? "text-amber-600 dark:text-amber-400"
                          : ""
                      } ${isCurrentWeek ? "ring-2 ring-primary/50 rounded-t" : ""}`}
                    >
                      <div>{w.label}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {w.isSummer
                          ? strings.imputaciones.summerLabel
                          : strings.imputaciones.regularLabel}
                      </div>
                    </th>
                  );
                })}
                <th className="text-center px-3 py-2 font-medium min-w-[70px] sticky right-0 bg-muted z-10">
                  {strings.imputaciones.calendarColTotal}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortEmployeesByCategory(initialEmployees).map((emp) => {
                const empH = hours.get(emp.id) ?? new Map();
                const total = Array.from(empH.values()).reduce(
                  (s, h) => s + h,
                  0
                );
                return (
                  <tr key={emp.id} className="border-t">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-card z-10">
                      <div>{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS[emp.category as Category] ??
                          emp.category}
                      </div>
                      {/* Base hours input + copy button */}
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          step="0.5"
                          value={baseHours.get(emp.id) ?? ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setBaseHours((prev) => {
                              const next = new Map(prev);
                              if (isNaN(val) || val === 0) {
                                next.delete(emp.id);
                              } else {
                                next.set(emp.id, val);
                              }
                              return next;
                            });
                          }}
                          placeholder={strings.imputaciones.baseHoursPlaceholder}
                          className="w-12 h-5 text-center text-[10px] px-0.5"
                          title={strings.imputaciones.baseHoursLabel}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          disabled={!baseHours.has(emp.id)}
                          onClick={() => handleCopyBaseToAllWeeks(emp.id)}
                          title={strings.imputaciones.copyToAllWeeks}
                        >
                          <CopyIcon className="size-2.5" />
                        </Button>
                      </div>
                    </td>
                    {weeks.map((w, i) => {
                      if (!visibleWeekIndices.includes(i)) return null;
                      const val = empH.get(i) ?? 0;
                      const vacDayCount = countVacationDaysInWeek(
                        emp.id,
                        w.start,
                        w.end,
                        vacations
                      );
                      const empHolidays = getHolidaysForOffice(emp.office, holidaysByOffice);
                      const hasHoliday = hasHolidayInWeek(
                        w.start,
                        w.end,
                        empHolidays
                      );
                      const hasVacation = vacDayCount > 0;
                      const isCurrentWeek = i === currentWeekIdx;
                      const cellKey = `${emp.id}-${i}`;
                      const isHighlighted = highlightWeeks.has(cellKey);
                      const rem = showRemaining ? remainingHours.get(cellKey) : undefined;
                      const breakdown = showRemaining ? remainingBreakdown.get(cellKey) : undefined;
                      return (
                        <td key={i} className={`px-1 py-1 text-center ${isCurrentWeek ? "bg-primary/5" : ""} ${isHighlighted ? "bg-red-100 dark:bg-red-950/50" : ""}`}>
                          <div className="relative group">
                            <Input
                              type="number"
                              min="0"
                              max="60"
                              step="0.5"
                              value={val || ""}
                              onChange={(e) =>
                                updateHours(
                                  emp.id,
                                  i,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className={`w-14 h-7 text-center text-xs px-1 ${isHighlighted ? "border-red-400 dark:border-red-600 ring-1 ring-red-300 dark:ring-red-700" : ""}`}
                            />
                            {(hasHoliday || hasVacation) && (
                              <div className="absolute -top-1 -right-1 flex gap-0.5">
                                {hasHoliday && (
                                  <span
                                    className="size-1.5 rounded-full bg-red-400"
                                    title={strings.imputaciones.holidayTooltip}
                                  />
                                )}
                                {hasVacation && (
                                  <span
                                    className="size-1.5 rounded-full bg-blue-400"
                                    title={strings.imputaciones.vacationDayCount(vacDayCount)}
                                  />
                                )}
                              </div>
                            )}
                            {/* Remaining hours indicator */}
                            {showRemaining && rem !== undefined && rem !== 0 && (
                              <div className={`text-[9px] mt-0.5 leading-none ${rem > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                                {rem > 0 ? `-${rem}h` : `${rem}h`}
                              </div>
                            )}
                            {/* Tooltip with breakdown */}
                            {showRemaining && breakdown && (
                              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-56 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-md">
                                <div className="font-medium mb-1">{strings.imputaciones.breakdownTitle}</div>
                                <div className="space-y-0.5 text-muted-foreground">
                                  <div className="flex justify-between">
                                    <span>{strings.imputaciones.expectedLabel}</span>
                                    <span>{breakdown.expectedHours}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{strings.imputaciones.thisEngagementLabel}</span>
                                    <span>{breakdown.thisHours}h</span>
                                  </div>
                                  {breakdown.otherEngagements.length > 0 && (
                                    <div className="border-t pt-0.5 mt-0.5">
                                      {breakdown.otherEngagements.map((oe, j) => (
                                        <div key={j} className="flex justify-between text-[10px]">
                                          <span className="truncate max-w-[120px]">{oe.engName}</span>
                                          <span>{oe.hours}h</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {breakdown.holidays > 0 && (
                                    <div className="flex justify-between text-red-500">
                                      <span>🎄 {strings.imputaciones.holidaysLabel}</span>
                                      <span>{breakdown.holidays}</span>
                                    </div>
                                  )}
                                  {breakdown.vacationDays > 0 && (
                                    <div className="flex justify-between text-blue-500">
                                      <span>🏖️ {strings.imputaciones.vacationsLabel}</span>
                                      <span>{breakdown.vacationDays}</span>
                                    </div>
                                  )}
                                  <div className="border-t pt-0.5 mt-0.5 flex justify-between font-medium">
                                    <span>{strings.imputaciones.remainingLabel}</span>
                                    <span className={rem !== undefined && rem > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}>
                                      {rem !== undefined ? `${rem > 0 ? "-" : ""}${rem}h` : "—"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-medium sticky right-0 bg-card z-10">
                      {Math.round(total * 10) / 10}h
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2 sticky left-0 bg-muted z-10">
                  {strings.imputaciones.calendarColTotal}
                </td>
                {weeks.map((w, i) => {
                  if (!visibleWeekIndices.includes(i)) return null;
                  let weekTotal = 0;
                  for (const emp of initialEmployees) {
                    const empH = hours.get(emp.id) ?? new Map();
                    weekTotal += empH.get(i) ?? 0;
                  }
                  return (
                    <td key={i} className="px-2 py-2 text-center">
                      {Math.round(weekTotal * 10) / 10}h
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center sticky right-0 bg-muted z-10">
                  {Math.round(
                    initialEmployees.reduce((empTotal, emp) => {
                      const empH = hours.get(emp.id) ?? new Map();
                      return (
                        empTotal +
                        Array.from(empH.values()).reduce((s, h) => s + h, 0)
                      );
                    }, 0) * 10
                  ) / 10}
                  h
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
