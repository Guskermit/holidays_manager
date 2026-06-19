"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import { isHoliday, isWeekend, toDateString, type Office } from "@/lib/holidays";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";

// ── Types ────────────────────────────────────────────────────

type VacationRequest = {
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  is_bootcamp?: boolean;
};

type Employee = {
  id: string;
  name: string;
  office: Office;
  category: string | null;
  specializations: string[];
  vacation_requests: VacationRequest[];
};

type Project = {
  id_engagement: string;
  name: string;
  color: string | null;
  employee_projects: {
    employee_id: string;
    employee_project_teams?: { team_id: string }[];
  }[];
};

type Team = {
  id: string;
  name: string;
  project_id: string;
};

type Props = {
  employees: Employee[];
  projects: Project[];
  teams?: Team[];
  /** key: `${employeeId}:${projectId}` → teamIds[] */
  teamAssignments?: Record<string, string[]>;
  /** Pre-fetched holidays from DB keyed by office name */
  holidaysByOffice?: Record<string, string[]>;
};

type GroupBy = "employee" | "project" | "team" | "category" | "specialization";

type GroupRow = {
  id: string;
  label: string;
  color?: string | null;
  employeeIds: Set<string>;
};

// ── Week helpers ─────────────────────────────────────────────

const MONTH_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"] as const;

type Week = {
  start: Date;
  mondayStr: string;
  dayNum: number;
  monthAbbr: string;
  /** e.g. "16 jun – 20 jun" */
  tooltipLabel: string;
  year: number;
};

function getWeeksUntilYearEnd(): Week[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find this Monday (ISO week: Monday = first day)
  const dow = today.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const currentYear = today.getFullYear();
  const yearEnd = new Date(currentYear, 11, 31);

  const weeks: Week[] = [];
  const cur = new Date(monday);

  while (cur <= yearEnd) {
    const friday = new Date(cur);
    friday.setDate(cur.getDate() + 4);
    // Clamp display label to Dec 31
    const fridayDisplay = friday > yearEnd ? yearEnd : friday;

    const startLabel = `${cur.getDate()} ${MONTH_SHORT[cur.getMonth()]}`;
    const endLabel   = `${fridayDisplay.getDate()} ${MONTH_SHORT[fridayDisplay.getMonth()]}`;
    const tooltipLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;

    weeks.push({
      start: new Date(cur),
      mondayStr: toDateString(cur),
      dayNum: cur.getDate(),
      monthAbbr: MONTH_SHORT[cur.getMonth()],
      tooltipLabel,
      year: currentYear,
    });

    cur.setDate(cur.getDate() + 7);
  }

  return weeks;
}

// ── Cell components ──────────────────────────────────────────

/** Cell for individual-employee rows (full / partial / none) */
function EmpCell({ available, total, tooltip }: { available: number; total: number; tooltip: string }) {
  if (total === 0) {
    return (
      <td
        title={strings.vacations.availabilityLegendHoliday}
        className="w-12 text-center border-r last:border-r-0 bg-muted/20"
      />
    );
  }
  const full = available === total;
  const none = available === 0;
  return (
    <td
      title={tooltip}
      className={cn(
        "w-12 py-1.5 text-center border-r last:border-r-0 text-xs tabular-nums font-medium",
        full && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        none && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        !full && !none && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      )}
    >
      {available}/{total}
    </td>
  );
}

/** Cell for group rows (percentage-based coloring) */
function GroupCell({ available, total, tooltip }: { available: number; total: number; tooltip: string }) {
  if (total === 0) {
    return (
      <td
        title={strings.vacations.availabilityLegendHoliday}
        className="w-12 text-center border-r last:border-r-0 bg-muted/20"
      />
    );
  }
  const pct = available / total;
  return (
    <td
      title={tooltip}
      className={cn(
        "w-12 py-1.5 text-center border-r last:border-r-0 text-xs tabular-nums font-medium",
        pct >= 0.8 && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        pct >= 0.4 && pct < 0.8 && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        pct > 0 && pct < 0.4 && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
        pct === 0 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      )}
    >
      {available}
    </td>
  );
}

function TotalCell({ available, total }: { available: number; total: number }) {
  if (total === 0) {
    return <td className="w-12 py-2 text-center border-r text-muted-foreground/40 text-xs">—</td>;
  }
  return (
    <td
      title={`${available} de ${total} persona-días disponibles`}
      className="w-12 py-2 text-center border-r text-xs font-semibold tabular-nums"
    >
      {available}
    </td>
  );
}

// ── Main component ───────────────────────────────────────────

export function AvailabilityTable({ employees, projects, teams = [], teamAssignments, holidaysByOffice }: Props) {
  const [projectFilter, setProjectFilter]   = useState<string>("all");
  const [teamFilter, setTeamFilter]         = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [specFilter, setSpecFilter]         = useState<string>("all");
  // Multi-select: "employee" is mutually exclusive with the rest
  const [groupBys, setGroupBys] = useState<Set<GroupBy>>(new Set<GroupBy>(["project"]));

  const toggleGroupBy = (opt: GroupBy) => {
    setGroupBys(prev => {
      const next = new Set(prev);
      if (opt === "employee") return new Set<GroupBy>(["employee"]);
      next.delete("employee");
      if (next.has(opt)) {
        if (next.size > 1) next.delete(opt); // keep at least one active
      } else {
        next.add(opt);
      }
      return next;
    });
  };

  const isIndividual = groupBys.has("employee");
  const activeDims = (["project","team","category","specialization"] as const)
    .filter(d => groupBys.has(d));

  // Weeks from this Monday to Dec 31 of the current year
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => getWeeksUntilYearEnd(), []);

  /* ── Derived filter options ──────────────────────────────── */
  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    employees.forEach(e => { if (e.category) seen.add(e.category); });
    return [...seen].sort();
  }, [employees]);

  const allSpecs = useMemo(() => {
    const seen = new Set<string>();
    employees.forEach(e => e.specializations.forEach(s => seen.add(s)));
    return [...seen].sort();
  }, [employees]);

  const projectTeams = useMemo(() => {
    if (projectFilter === "all") return [];
    return teams.filter(t => t.project_id === projectFilter);
  }, [teams, projectFilter]);

  /* ── Filtered employees ──────────────────────────────────── */
  const visibleEmployees = useMemo(() => {
    let result = employees;
    if (projectFilter !== "all") {
      const project = projects.find(p => p.id_engagement === projectFilter);
      if (project) {
        const ids = new Set(project.employee_projects.map(ep => ep.employee_id));
        result = result.filter(e => ids.has(e.id));
      }
    }
    if (teamFilter !== "all" && teamAssignments) {
      result = result.filter(e => {
        const key = `${e.id}:${projectFilter}`;
        return (teamAssignments[key] ?? []).includes(teamFilter);
      });
    }
    if (categoryFilter !== "all") {
      result = result.filter(e => e.category === categoryFilter);
    }
    if (specFilter !== "all") {
      result = result.filter(e => e.specializations.includes(specFilter));
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [employees, projects, projectFilter, teamFilter, teamAssignments, categoryFilter, specFilter]);

  /* ── Per-employee: set of approved-off working days ─────── */
  // Includes approved vacations AND approved bootcamp days (both make the employee unavailable)
  const employeeUnavailableMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const emp of visibleEmployees) {
      const unavailable  = new Set<string>();
      const officeHols   = new Set<string>(holidaysByOffice?.[emp.office] ?? []);
      for (const req of emp.vacation_requests) {
        if (req.status !== "approved") continue;
        const start = new Date(req.start_date + "T00:00:00");
        const end   = new Date(req.end_date   + "T00:00:00");
        const cur   = new Date(start);
        while (cur <= end) {
          if (!isWeekend(cur) && !isHoliday(cur, officeHols)) {
            unavailable.add(toDateString(cur));
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      map.set(emp.id, unavailable);
    }
    return map;
  }, [visibleEmployees, holidaysByOffice]);

  /* ── Per-employee weekly availability ────────────────────── */
  const employeeWeeklyData = useMemo(() => {
    const result = new Map<string, Array<{ available: number; total: number }>>();
    for (const emp of visibleEmployees) {
      const unavailable = employeeUnavailableMap.get(emp.id) ?? new Set<string>();
      const officeHols  = new Set<string>(holidaysByOffice?.[emp.office] ?? []);
      const weekData    = weeks.map(week => {
        let available = 0;
        let total     = 0;
        // Iterate Mon (i=0) → Fri (i=4) only
        for (let i = 0; i < 5; i++) {
          const day = new Date(week.start);
          day.setDate(week.start.getDate() + i);
          // Don't count days past Dec 31 of this year
          if (day.getFullYear() > week.year) break;
          if (!isHoliday(day, officeHols)) {
            total++;
            if (!unavailable.has(toDateString(day))) available++;
          }
        }
        return { available, total };
      });
      result.set(emp.id, weekData);
    }
    return result;
  }, [visibleEmployees, weeks, employeeUnavailableMap, holidaysByOffice]);

  /* ── Total available person-days per week ────────────────── */
  const weeklyTotals = useMemo(() => {
    return weeks.map((_, idx) => {
      let available = 0;
      let total     = 0;
      for (const emp of visibleEmployees) {
        const wd = employeeWeeklyData.get(emp.id);
        if (wd) {
          available += wd[idx].available;
          total     += wd[idx].total;
        }
      }
      return { available, total };
    });
  }, [weeks, visibleEmployees, employeeWeeklyData]);

  /* ── Single-dimension groups (base for cartesian product) ── */
  const perDimGroups = useMemo<Record<string, GroupRow[]>>(() => {
    const project: GroupRow[] = projects
      .map(p => ({
        id: p.id_engagement,
        label: p.name,
        color: p.color,
        employeeIds: new Set(
          p.employee_projects
            .map(ep => ep.employee_id)
            .filter(id => visibleEmployees.some(e => e.id === id))
        ),
      }))
      .filter(g => g.employeeIds.size > 0);

    const team: GroupRow[] = teams
      .map(t => {
        const employeeIds = new Set<string>();
        for (const emp of visibleEmployees) {
          const key = `${emp.id}:${t.project_id}`;
          if ((teamAssignments?.[key] ?? []).includes(t.id)) employeeIds.add(emp.id);
        }
        return { id: t.id, label: t.name, employeeIds };
      })
      .filter(g => g.employeeIds.size > 0);

    const category: GroupRow[] = allCategories
      .map(cat => ({
        id: cat,
        label: CATEGORY_LABELS[cat as Category] ?? cat,
        employeeIds: new Set(
          visibleEmployees.filter(e => e.category === cat).map(e => e.id)
        ),
      }))
      .filter(g => g.employeeIds.size > 0);

    const specialization: GroupRow[] = allSpecs
      .map(spec => ({
        id: spec,
        label: spec,
        employeeIds: new Set(
          visibleEmployees.filter(e => e.specializations.includes(spec)).map(e => e.id)
        ),
      }))
      .filter(g => g.employeeIds.size > 0);

    return { project, team, category, specialization };
  }, [projects, teams, visibleEmployees, allCategories, allSpecs, teamAssignments]);

  /* ── Cartesian product of active dimensions ─────────────── */
  const groups = useMemo<GroupRow[]>(() => {
    if (isIndividual || activeDims.length === 0) return [];

    const dimGroupsList = activeDims.map(d => perDimGroups[d]);
    const [first, ...rest] = dimGroupsList;

    return rest.reduce<GroupRow[]>((acc, curr) => {
      const result: GroupRow[] = [];
      for (const a of acc) {
        for (const b of curr) {
          const employeeIds = new Set([...a.employeeIds].filter(id => b.employeeIds.has(id)));
          if (employeeIds.size === 0) continue;
          result.push({
            id: `${a.id}\u00b7\u00b7${b.id}`,
            label: `${a.label} \u00b7 ${b.label}`,
            color: a.color ?? b.color,
            employeeIds,
          });
        }
      }
      return result;
    }, first);
  }, [isIndividual, activeDims, perDimGroups]);

  /* ── Aggregated weekly data per group ───────────────────── */
  const groupWeeklyData = useMemo(() => {
    const result = new Map<string, Array<{ available: number; total: number }>>();
    for (const group of groups) {
      const weekData = weeks.map((_, idx) => {
        let available = 0, total = 0;
        for (const emp of visibleEmployees) {
          if (!group.employeeIds.has(emp.id)) continue;
          const wd = employeeWeeklyData.get(emp.id);
          if (wd) { available += wd[idx].available; total += wd[idx].total; }
        }
        return { available, total };
      });
      result.set(group.id, weekData);
    }
    return result;
  }, [groups, visibleEmployees, weeks, employeeWeeklyData]);

  const selectedProject = projects.find(p => p.id_engagement === projectFilter);
  const isGrouped = !isIndividual;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Group by selector (multi-select) ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium shrink-0">{strings.vacations.availabilityGroupByLabel}</span>
        {(["employee","project","team","category","specialization"] as GroupBy[]).map(opt => {
          const labels: Record<GroupBy, string> = {
            employee:       strings.vacations.availabilityGroupEmployee,
            project:        strings.vacations.availabilityGroupProject,
            team:           strings.vacations.availabilityGroupTeam,
            category:       strings.vacations.availabilityGroupCategory,
            specialization: strings.vacations.availabilityGroupSpec,
          };
          const active = groupBys.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleGroupBy(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>

      {/* ── Project filter ── */}
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
            onClick={() => { setProjectFilter(p.id_engagement); setTeamFilter("all"); }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
              projectFilter === p.id_engagement
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
            {p.name}
          </button>
        ))}
      </div>

      {/* ── Team filter (only when a project with teams is selected) ── */}
      {projectTeams.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium shrink-0">Equipo</span>
          <button
            type="button"
            onClick={() => setTeamFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              teamFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            Todos
          </button>
          {projectTeams.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamFilter(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                teamFilter === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Category filter ── */}
      {allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium shrink-0">{strings.vacations.overviewFilterCategory}</span>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            {strings.vacations.overviewFilterAllCategories}
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {CATEGORY_LABELS[cat as Category] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Specialization filter ── */}
      {allSpecs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium shrink-0">{strings.vacations.overviewFilterSpec}</span>
          <button
            type="button"
            onClick={() => setSpecFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              specFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-accent"
            )}
          >
            {strings.vacations.overviewFilterAllSpecs}
          </button>
          {allSpecs.map(spec => (
            <button
              key={spec}
              type="button"
              onClick={() => setSpecFilter(spec)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                specFilter === spec
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {spec}
            </button>
          ))}
        </div>
      )}

      {/* ── Project badge ── */}
      {selectedProject && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: selectedProject.color ?? "#6366f1" }}
          />
          {strings.vacations.overviewFilterShowing(visibleEmployees.length, selectedProject.name)}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {isGrouped ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-emerald-200 dark:bg-emerald-800" />
              {strings.vacations.availabilityLegendFull}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-amber-200 dark:bg-amber-800" />
              {strings.vacations.availabilityLegendPartial}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-orange-200 dark:bg-orange-800" />
              {strings.vacations.availabilityLegendLow}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-red-200 dark:bg-red-800" />
              {strings.vacations.availabilityLegendNone}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-emerald-200 dark:bg-emerald-800" />
              Disponible completo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-amber-200 dark:bg-amber-800" />
              Disponible parcial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-red-200 dark:bg-red-800" />
              No disponible
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-muted border" />
          {strings.vacations.availabilityLegendHoliday}
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
                <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur text-left font-medium px-3 py-2 min-w-44 border-r">
                  {isGrouped
                    ? activeDims.map(d => ({
                        project: strings.vacations.availabilityGroupProject,
                        team: strings.vacations.availabilityGroupTeam,
                        category: strings.vacations.availabilityGroupCategory,
                        specialization: strings.vacations.availabilityGroupSpec,
                      }[d])).join(" · ")
                    : strings.vacations.availabilityColEmployee}
                </th>
                {isGrouped ? (
                  <th className="text-right font-medium px-3 py-2 min-w-20 border-r text-muted-foreground whitespace-nowrap">
                    {strings.vacations.availabilityColCount}
                  </th>
                ) : (
                  <>
                    <th className="text-left font-medium px-2 py-2 min-w-28 border-r text-muted-foreground">
                      {strings.vacations.availabilityColCategory}
                    </th>
                    <th className="text-left font-medium px-2 py-2 min-w-32 border-r text-muted-foreground">
                      {strings.vacations.availabilityColSpecs}
                    </th>
                  </>
                )}
                {weeks.map(week => (
                  <th
                    key={week.mondayStr}
                    title={week.tooltipLabel}
                    className="font-medium py-2 w-12 text-center border-r last:border-r-0 text-foreground cursor-default"
                  >
                    <div>{week.dayNum}</div>
                    <div className="text-muted-foreground/60 font-normal">{week.monthAbbr}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">

              {/* ── Total row ── */}
              <tr className="bg-muted/40 border-b-2 border-border">
                <td className="sticky left-0 z-10 bg-muted/60 backdrop-blur px-3 py-2 font-semibold border-r whitespace-nowrap">
                  {strings.vacations.availabilityTotalRow}
                </td>
                {isGrouped ? (
                  <td className="px-3 py-2 text-right font-semibold border-r text-muted-foreground">
                    {visibleEmployees.length}
                  </td>
                ) : (
                  <>
                    <td className="border-r" />
                    <td className="border-r" />
                  </>
                )}
                {weeklyTotals.map((wt, idx) => (
                  <TotalCell key={weeks[idx].mondayStr} available={wt.available} total={wt.total} />
                ))}
              </tr>

              {/* ── Grouped rows ── */}
              {isGrouped && groups.map(group => {
                const weekData = groupWeeklyData.get(group.id) ?? [];
                return (
                  <tr key={group.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium border-r whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {group.color && (
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                        )}
                        {group.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground border-r tabular-nums">
                      {group.employeeIds.size}
                    </td>
                    {weekData.map((wd, idx) => (
                      <GroupCell
                        key={weeks[idx].mondayStr}
                        available={wd.available}
                        total={wd.total}
                        tooltip={`${group.label}: ${wd.available} de ${wd.total} persona-días — ${weeks[idx].tooltipLabel}`}
                      />
                    ))}
                  </tr>
                );
              })}

              {/* ── Individual employee rows ── */}
              {!isGrouped && visibleEmployees.map(emp => {
                const weekData = employeeWeeklyData.get(emp.id) ?? [];
                return (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium border-r whitespace-nowrap">
                      {emp.name}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground border-r whitespace-nowrap">
                      {emp.category
                        ? (CATEGORY_LABELS[emp.category as Category] ?? emp.category)
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 border-r">
                      {emp.specializations.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {emp.specializations.map(s => (
                            <span
                              key={s}
                              className="inline-block px-1.5 py-0.5 rounded text-xs bg-muted border border-border whitespace-nowrap"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    {weekData.map((wd, idx) => (
                      <EmpCell
                        key={weeks[idx].mondayStr}
                        available={wd.available}
                        total={wd.total}
                        tooltip={`${emp.name}: ${wd.available}/${wd.total} días disponibles — ${weeks[idx].tooltipLabel}`}
                      />
                    ))}
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
