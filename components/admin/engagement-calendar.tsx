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

// ── Component ──────────────────────────────────────────────

export function EngagementCalendar({
  engagement,
  employees: initialEmployees,
  existingImputaciones,
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

  // Generate weeks
  const weeks = useMemo(() => {
    if (!engagement.start_date) return [];
    const start = new Date(engagement.start_date);
    const end = engagement.end_date
      ? new Date(engagement.end_date)
      : addDays(start, 84); // default ~12 weeks
    return weeksBetween(start, end);
  }, [engagement.start_date, engagement.end_date]);

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
        // Check if there's an existing imputation covering this week
        const existing = existingImputaciones.find(
          (imp) =>
            imp.employee_id === emp.id &&
            imp.start_date <= formatDate(weeks[i].end) &&
            (!imp.end_date || imp.end_date >= formatDate(weeks[i].start))
        );
        if (existing) {
          empHours.set(i, existing.weekly_hours);
        } else {
          empHours.set(i, calcDefaultHours(emp, weeks[i]));
        }
      }
      map.set(emp.id, empHours);
    }
    setHours(map);
  }, [initialEmployees, weeks, existingImputaciones, calcDefaultHours]);

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

  // Save
  function handleSave() {
    setError(null);
    setSuccess(null);
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
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                  {strings.imputaciones.calendarColEmployee}
                </th>
                {weeks.map((w, i) => (
                  <th
                    key={i}
                    className={`text-center px-2 py-2 font-medium min-w-[60px] ${
                      w.isSummer
                        ? "text-amber-600 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    <div>{w.label}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {w.isSummer
                        ? strings.imputaciones.summerLabel
                        : strings.imputaciones.regularLabel}
                    </div>
                  </th>
                ))}
                <th className="text-center px-3 py-2 font-medium min-w-[70px]">
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
                    </td>
                    {weeks.map((w, i) => {
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
                      return (
                        <td key={i} className="px-1 py-1 text-center">
                          <div className="relative">
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
                              className="w-14 h-7 text-center text-xs px-1"
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
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-medium">
                      {Math.round(total * 10) / 10}h
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10">
                  {strings.imputaciones.calendarColTotal}
                </td>
                {weeks.map((w, i) => {
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
                <td className="px-3 py-2 text-center">
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
