"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { strings } from "@/lib/strings";
import {
  getHolidaysForOffice,
  isWeekend,
  isHoliday,
  toDateString,
  OFFICE_LABELS,
  type Office,
} from "@/lib/holidays";

type VacationRequest = {
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

type Employee = {
  id: string;
  name: string;
  office: Office;
  vacation_requests: VacationRequest[];
};

type Project = {
  id_engagement: string;
  name: string;
  color: string | null;
  employee_projects: { employee_id: string }[];
};

type Props = {
  employees: Employee[];
  projects: Project[];
};

const STATUS_COLOR: Record<VacationRequest["status"], string> = {
  approved: "bg-emerald-400 dark:bg-emerald-500",
  pending:  "bg-amber-300 dark:bg-amber-400",
  rejected: "bg-red-300 dark:bg-red-400",
  cancelled:"bg-muted",
};

const STATUS_LABEL: Record<VacationRequest["status"], string> = {
  approved: strings.vacations.statusApproved,
  pending:  strings.vacations.statusPending,
  rejected: strings.vacations.statusRejected,
  cancelled:strings.vacations.statusCancelled,
};

const MONTH_NAMES = strings.vacations.calendarMonths;

export function VacationSummaryTable({ employees, projects }: Props) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [projectFilter, setProjectFilter] = useState<string>("all");

  /* ── month navigation ──────────────────────────────────────── */
  const goBack = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const goForward = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  /* ── days of the month ─────────────────────────────────────── */
  const days = useMemo(() => {
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
  }, [year, month]);

  /* ── filtered employees ────────────────────────────────────── */
  const visibleEmployees = useMemo(() => {
    if (projectFilter === "all") return employees;
    const project = projects.find(p => p.id_engagement === projectFilter);
    if (!project) return employees;
    const ids = new Set(project.employee_projects.map(ep => ep.employee_id));
    return employees.filter(e => ids.has(e.id));
  }, [employees, projects, projectFilter]);

  /* ── pre-compute day → status map per employee ─────────────── */
  const employeeDayMap = useMemo(() => {
    const map = new Map<string, Map<string, VacationRequest["status"]>>();
    for (const emp of visibleEmployees) {
      const dayMap = new Map<string, VacationRequest["status"]>();
      for (const req of emp.vacation_requests) {
        if (req.status === "cancelled") continue;
        const cur = new Date(req.start_date + "T00:00:00");
        const end = new Date(req.end_date   + "T00:00:00");
        while (cur <= end) {
          const ds = toDateString(cur);
          // approved wins over pending
          if (!dayMap.has(ds) || req.status === "approved") {
            dayMap.set(ds, req.status);
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      map.set(emp.id, dayMap);
    }
    return map;
  }, [visibleEmployees]);

  const selectedProject = projects.find(p => p.id_engagement === projectFilter);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium shrink-0">{strings.vacations.overviewFilterLabel}</span>
        <button
          type="button"
          onClick={() => setProjectFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            projectFilter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-input hover:bg-accent"
          )}
        >
          {strings.vacations.overviewFilterAll}
        </button>
        {projects.map(p => (
          <button
            key={p.id_engagement}
            type="button"
            onClick={() => setProjectFilter(p.id_engagement)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
              projectFilter === p.id_engagement
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: p.color ?? "#6366f1" }}
            />
            {p.name}
          </button>
        ))}
      </div>

      {/* project badge */}
      {selectedProject && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: selectedProject.color ?? "#6366f1" }}
          />
          {strings.vacations.overviewFilterShowing(visibleEmployees.length, selectedProject.name)}
        </div>
      )}

      {/* ── Month navigation ── */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={goBack}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-base font-semibold min-w-36 text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <Button variant="outline" size="sm" onClick={goForward}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["approved","pending","rejected"] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded", STATUS_COLOR[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-muted-foreground/20" /> {strings.vacations.legendWeekend} / {strings.vacations.legendHoliday}
        </span>
      </div>

      {/* ── Table ── */}
      {visibleEmployees.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{strings.vacations.overviewEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-muted/50">
                {/* sticky employee name column */}
                <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur text-left font-medium px-3 py-2 min-w-40 border-r">
                  {strings.vacations.overviewColEmployee}
                </th>
                <th className="text-left font-medium px-2 py-2 min-w-20 border-r text-muted-foreground">
                  {strings.vacations.overviewColOffice}
                </th>
                {days.map(d => {
                  const weekend = isWeekend(d);
                  const ds = toDateString(d);
                  return (
                    <th
                      key={ds}
                      className={cn(
                        "font-medium py-2 w-8 text-center border-r last:border-r-0",
                        weekend ? "text-muted-foreground/50 bg-muted/30" : "text-foreground"
                      )}
                    >
                      <div>{d.getDate()}</div>
                      <div className="text-muted-foreground/60 font-normal">
                        {["S","M","T","W","T","F","S"][d.getDay()]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleEmployees.map(emp => {
                const dayMap = employeeDayMap.get(emp.id) ?? new Map();
                const officeHolidays = getHolidaysForOffice(emp.office);
                return (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium border-r whitespace-nowrap">
                      {emp.name}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground border-r whitespace-nowrap">
                      {OFFICE_LABELS[emp.office] ?? emp.office}
                    </td>
                    {days.map(d => {
                      const ds = toDateString(d);
                      const weekend = isWeekend(d);
                      const holiday = isHoliday(d, officeHolidays);
                      const status: VacationRequest["status"] | undefined = dayMap.get(ds);
                      const blocked = weekend || holiday;

                      return (
                        <td
                          key={ds}
                          title={
                            status
                              ? STATUS_LABEL[status]
                              : holiday
                              ? strings.vacations.calendarTitleHoliday
                              : weekend
                              ? strings.vacations.calendarTitleWeekend
                              : undefined
                          }
                          className={cn(
                            "border-r last:border-r-0 p-0.5 text-center",
                            blocked && !status && "bg-muted/30"
                          )}
                        >
                          {status && (
                            <div
                              className={cn(
                                "mx-auto rounded size-5 flex items-center justify-center",
                                STATUS_COLOR[status]
                              )}
                            />
                          )}
                          {!status && holiday && (
                            <div className="mx-auto size-5 flex items-center justify-center text-amber-500 font-bold text-xs">
                              ✦
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
