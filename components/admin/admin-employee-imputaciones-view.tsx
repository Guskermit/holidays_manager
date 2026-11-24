"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import {
  getEmployeesForDropdown,
  getAdminEmployeeImputaciones,
  type EmployeeOption,
  type AdminImputacionesData,
} from "@/app/main/admin/employee-imputaciones/actions";

// ── Month colors ──────────────────────────────────────────

const MONTH_COLORS = [
  { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200 dark:border-sky-800" },
  { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-200 dark:border-fuchsia-800" },
  { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-700 dark:text-lime-300", border: "border-lime-200 dark:border-lime-800" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
];

const ABSENCE_COLORS: Record<string, { pill: string; icon: string }> = {
  vacation: { pill: "bg-teal-500/10 text-teal-600 dark:text-teal-400", icon: "text-teal-600 dark:text-teal-400" },
  holiday: { pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400" },
  medical: { pill: "bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: "text-rose-600 dark:text-rose-400" },
  bootcamp: { pill: "bg-violet-500/10 text-violet-600 dark:text-violet-400", icon: "text-violet-600 dark:text-violet-400" },
  other: { pill: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: "text-gray-600 dark:text-gray-400" },
};

export function AdminEmployeeImputacionesView() {
  const tableRef = useRef<HTMLDivElement>(null);

  // Employee selector state
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Imputaciones data
  const [data, setData] = useState<AdminImputacionesData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  // Fetch employees on mount
  useEffect(() => {
    getEmployeesForDropdown().then((result) => {
      if (result.data) setEmployees(result.data);
      setLoadingEmployees(false);
    });
  }, []);

  // Fetch imputaciones data when employee or year changes
  const fetchData = useCallback(async (empId: string, yr: number) => {
    if (!empId) return;
    setLoadingData(true);
    const result = await getAdminEmployeeImputaciones(empId, yr);
    if (result.data) setData(result.data);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchData(selectedEmployeeId, year);
    }
  }, [selectedEmployeeId, year, fetchData]);

  // Auto-scroll to current week
  useEffect(() => {
    if (!data || !tableRef.current) return;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentWeekEl = tableRef.current.querySelector(`[data-week="${currentMonth}"]`);
    if (currentWeekEl) {
      currentWeekEl.scrollIntoView({ inline: "center", behavior: "smooth" });
    }
  }, [data]);

  // Filter employees for dropdown
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.email.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // Read-only helper: hours for an engagement cell
  const getHours = (engagementId: string, weekIdx: number): number =>
    data?.engagements.find((e) => e.id === engagementId)?.weekHours.get(weekIdx) ?? 0;

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="flex flex-col gap-6">
      {/* Employee selector */}
      <div className="relative max-w-md">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center justify-between w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {selectedEmployee ? (
            <span className="flex items-center gap-2">
              <span>{selectedEmployee.name}</span>
              <span className="text-xs text-muted-foreground">({selectedEmployee.category})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {loadingEmployees ? strings.common.loading : "Seleccionar empleado..."}
            </span>
          )}
          <ChevronRightIcon className={`size-4 transition-transform ${dropdownOpen ? "rotate-90" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[400px] overflow-hidden flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full h-8 rounded border bg-background px-2 pl-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>
            {/* Employee list */}
            <div className="overflow-y-auto flex-1">
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors ${
                    emp.id === selectedEmployeeId ? "bg-muted" : ""
                  }`}
                  onClick={() => {
                    setSelectedEmployeeId(emp.id);
                    setDropdownOpen(false);
                    setEmployeeSearch("");
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{emp.category}</span>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {strings.common.empty}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Backdrop to close dropdown */}
        {dropdownOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
        )}
      </div>

      {/* Year selector and controls */}
      {data && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-base font-semibold min-w-[60px] text-center">
              {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadingData && (
        <div className="rounded-lg border p-8 bg-muted/20 text-center text-sm text-muted-foreground">
          {strings.common.loading}
        </div>
      )}

      {/* No employee selected */}
      {!loadingData && !data && !selectedEmployeeId && (
        <div className="rounded-lg border p-8 bg-muted/20 text-center text-sm text-muted-foreground">
          Selecciona un empleado para ver sus imputaciones.
        </div>
      )}

      {/* Imputaciones table */}
      {data && (
        <div ref={tableRef} className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm border-collapse">
            {/* Month header */}
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-background min-w-[200px]" />
                {data.monthGroups.map((mg) => {
                  const color = MONTH_COLORS[mg.colorIdx % MONTH_COLORS.length];
                  const colspan = mg.endIdx - mg.startIdx + 1;
                  return (
                    <th
                      key={mg.monthKey}
                      colSpan={colspan}
                      className={`${color.bg} ${color.text} px-2 py-1.5 text-xs font-semibold border ${color.border} text-center whitespace-nowrap`}
                    >
                      {mg.monthName}
                    </th>
                  );
                })}
                <th className="bg-muted/80 px-2 py-1.5 text-xs font-semibold border text-center whitespace-nowrap min-w-[80px]">
                  Total
                </th>
                <th className="bg-muted/80 w-10 border" />
              </tr>

              {/* Week header */}
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-20 bg-muted text-left font-medium px-3 py-2 border-b text-xs">
                  {strings.imputaciones.calendarColEmployee}
                </th>
                {data.weeks.map((w, i) => {
                  const mg = data.monthGroups.find((m) => i >= m.startIdx && i <= m.endIdx);
                  const color = mg ? MONTH_COLORS[mg.colorIdx % MONTH_COLORS.length] : MONTH_COLORS[0];
                  return (
                    <th
                      key={i}
                      data-week={w.start.getMonth()}
                      className={`border-b-2 ${color.border} px-1 py-2 text-center text-[10px] font-medium min-w-[52px] tabular-nums whitespace-nowrap`}
                    >
                      <div>{w.start.getDate()}</div>
                    </th>
                  );
                })}
                <th className="bg-muted border-b px-2 py-2 text-center text-[10px] font-medium whitespace-nowrap">
                  Semana
                </th>
                <th className="bg-muted border-b" />
              </tr>
            </thead>

            <tbody>
              {/* Engagement rows */}
              {data.engagements.map((eng, engIdx) => {
                const rowTotal = data.weeks.reduce((s, _, i) => s + getHours(eng.id, i), 0);
                return (
                  <tr key={`eng-${engIdx}`} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">
                            {eng.clientName ? `${eng.clientName} → ` : ""}
                            {eng.engagementName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {eng.engagementCode}
                          </p>
                        </div>
                      </div>
                    </td>
                    {data.weeks.map((_, weekIdx) => {
                      const val = getHours(eng.id, weekIdx);
                      return (
                        <td
                          key={weekIdx}
                          className="border px-1 py-1 text-center text-xs tabular-nums"
                        >
                          <span className="block py-0.5">
                            {val > 0 ? (val % 1 === 0 ? val : val.toFixed(1)) : ""}
                          </span>
                        </td>
                      );
                    })}
                    <td className="border px-2 py-1 text-center text-xs font-semibold tabular-nums bg-muted/30">
                      {rowTotal > 0 ? (rowTotal % 1 === 0 ? rowTotal : rowTotal.toFixed(1)) : "—"}
                    </td>
                    <td className="border" />
                  </tr>
                );
              })}

              {/* Commercial action row */}
              {data.commercialHours && (
                <tr className="bg-emerald-50/50 dark:bg-emerald-900/20">
                  <td className="sticky left-0 z-10 bg-emerald-50/95 dark:bg-emerald-950/95 border-r px-3 py-2 min-w-[200px]">
                    <p className="font-medium text-xs text-emerald-700 dark:text-emerald-300">
                      Acción comercial
                    </p>
                  </td>
                  {data.weeks.map((_, weekIdx) => {
                    const val = data.commercialHours!.get(weekIdx) ?? 0;
                    return (
                      <td key={weekIdx} className="border px-1 py-1 text-center text-xs tabular-nums text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/10">
                        {val > 0 ? val : ""}
                      </td>
                    );
                  })}
                  <td className="border px-2 py-1 text-center text-xs font-semibold tabular-nums bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                    {(() => {
                      let total = 0;
                      for (let i = 0; i < data.weeks.length; i++) {
                        total += data.commercialHours!.get(i) ?? 0;
                      }
                      return total > 0 ? total : "—";
                    })()}
                  </td>
                  <td className="border bg-emerald-50/50 dark:bg-emerald-900/20" />
                </tr>
              )}

              {/* Absence rows */}
              {data.absences.map((abs, absIdx) => {
                const colors = ABSENCE_COLORS[abs.type] ?? ABSENCE_COLORS.other;
                const absTotal = data.weeks.reduce((s, _, i) => s + (abs.weekHours.get(i) ?? 0), 0);
                return (
                  <tr key={`abs-${absIdx}`} className="border-t">
                    <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 min-w-[200px]">
                      <p className="font-medium text-xs">{abs.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {abs.startDate} → {abs.endDate}
                      </p>
                    </td>
                    {data.weeks.map((_, weekIdx) => {
                      const val = abs.weekHours.get(weekIdx) ?? 0;
                      return (
                        <td key={weekIdx} className="border px-1 py-1 text-center text-xs tabular-nums">
                          {val > 0 ? (
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-[10px] font-bold ${colors.pill}`}>
                              {val}h
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border px-2 py-1 text-center text-xs font-semibold tabular-nums">
                      {absTotal > 0 ? `${absTotal}h` : "—"}
                    </td>
                    <td className="border" />
                  </tr>
                );
              })}

              {/* Total hours/week row (engagements + commercial + absences) */}
              <tr className="bg-muted/50 font-semibold">
                <td className="sticky left-0 z-10 bg-muted/90 border-r px-3 py-2 min-w-[200px]">
                  <p className="text-xs">
                    Total horas / semana
                  </p>
                </td>
                {data.weeks.map((_, weekIdx) => {
                  const engTotal = data.engagements.reduce((s, e) => s + getHours(e.id, weekIdx), 0);
                  const commHrs = data.commercialHours?.get(weekIdx) ?? 0;
                  const absHrs = data.absences.reduce((s, a) => s + (a.weekHours.get(weekIdx) ?? 0), 0);
                  const combined = engTotal + commHrs + absHrs;
                  return (
                    <td
                      key={weekIdx}
                      className="border px-1 py-1 text-center text-xs tabular-nums text-foreground"
                    >
                      {combined > 0 ? combined : "—"}
                    </td>
                  );
                })}
                <td className="border px-2 py-1 text-center text-xs font-semibold tabular-nums bg-muted/50">
                  {(() => {
                    let total = 0;
                    for (let i = 0; i < data.weeks.length; i++) {
                      const engTotal = data.engagements.reduce((s, e) => s + getHours(e.id, i), 0);
                      const absHrs = data.absences.reduce((s, a) => s + (a.weekHours.get(i) ?? 0), 0);
                      total += engTotal + (data.commercialHours?.get(i) ?? 0) + absHrs;
                    }
                    return total > 0 ? total : "—";
                  })()}
                </td>
                <td className="border bg-muted/50" />
              </tr>

              {/* Week target row */}
              <tr className="bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/70 border-r px-3 py-2 min-w-[200px]">
                  <p className="text-xs text-muted-foreground">
                    Objetivo semanal (base)
                  </p>
                </td>
                {data.weeks.map((w, weekIdx) => {
                  const target = data.weekTargetHours.get(weekIdx) ?? 0;
                  return (
                    <td
                      key={weekIdx}
                      className="border px-1 py-1 text-center text-xs tabular-nums text-muted-foreground"
                    >
                      {target}
                    </td>
                  );
                })}
                <td className="border px-2 py-1 text-center text-xs tabular-nums text-muted-foreground bg-muted/30">
                  {(() => {
                    let total = 0;
                    for (let i = 0; i < data.weeks.length; i++) {
                      total += data.weekTargetHours.get(i) ?? 0;
                    }
                    return total;
                  })()}
                </td>
                <td className="border bg-muted/30" />
              </tr>

              {/* Difference row: (engagements + commercial + absences) - target */}
              <tr className="bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/60 border-r px-3 py-2 min-w-[200px]">
                  <p className="text-xs text-muted-foreground">
                    Diferencia
                  </p>
                </td>
                {data.weeks.map((_, weekIdx) => {
                  const target = data.weekTargetHours.get(weekIdx) ?? 0;
                  const engTotal = data.engagements.reduce((s, e) => s + getHours(e.id, weekIdx), 0);
                  const commHrs = data.commercialHours?.get(weekIdx) ?? 0;
                  const absHrs = data.absences.reduce((s, a) => s + (a.weekHours.get(weekIdx) ?? 0), 0);
                  const diff = engTotal + commHrs + absHrs - target;
                  return (
                    <td
                      key={weekIdx}
                      className={`border px-1 py-1 text-center text-xs font-semibold tabular-nums ${
                        diff > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : diff < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {target > 0 ? (diff > 0 ? `+${diff}` : diff) : "—"}
                    </td>
                  );
                })}
                <td className="border px-2 py-1 text-center text-xs font-semibold tabular-nums bg-muted/30">
                  {(() => {
                    let totalDiff = 0;
                    for (let i = 0; i < data.weeks.length; i++) {
                      const target = data.weekTargetHours.get(i) ?? 0;
                      const engTotal = data.engagements.reduce((s, e) => s + getHours(e.id, i), 0);
                      const commHrs = data.commercialHours?.get(i) ?? 0;
                      const absHrs = data.absences.reduce((s, a) => s + (a.weekHours.get(i) ?? 0), 0);
                      totalDiff += engTotal + commHrs + absHrs - target;
                    }
                    return totalDiff > 0 ? `+${totalDiff}` : totalDiff;
                  })()}
                </td>
                <td className="border bg-muted/30" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
