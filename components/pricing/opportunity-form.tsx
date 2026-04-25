"use client";

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangleIcon, PlusIcon, XIcon, TrashIcon } from "lucide-react";
import { strings } from "@/lib/strings";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { saveOpportunity } from "@/app/main/pricing/actions";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

export type EmployeeOption = {
  id: string;
  name: string;
  email: string;
  category: string;
  costPerHour: number | null;
};

export type InitialEmployee = {
  employeeId: string;
  costPerHour: number;
  revenuePerHour: number | null;
  hours: Record<string, number>;
};

export type InitialValues = {
  id?: string;
  client?: string;
  name?: string;
  description?: string;
  margin?: number;
  startDate?: string;
  endDate?: string;
  employees?: InitialEmployee[];
};

type Props = {
  allEmployees: EmployeeOption[];
  initial?: InitialValues;
};

// ── Date helpers ──────────────────────────────────────────────

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeeks(startDate: string, endDate: string): Date[] {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (end < start) return [];

  const first = getMondayOf(start);
  const weeks: Date[] = [];
  const cur = new Date(first);
  while (cur <= end) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Validation ────────────────────────────────────────────────

type Warning = { key: string; message: string };

function computeWarnings(
  employees: { id: string; category: string; totalHours: number }[],
  totalProjectHours: number
): Warning[] {
  const warnings: Warning[] = [];
  if (totalProjectHours === 0) return warnings;

  const socios = employees.filter((e) => e.category === "Socio");
  const managers = employees.filter(
    (e) => e.category === "Manager" || e.category === "Senior-Manager"
  );

  // Socio check
  if (socios.length === 0) {
    warnings.push({ key: "no-socio", message: strings.pricing.warnNoSocio });
  } else {
    const socioHours = socios.reduce((s, e) => s + e.totalHours, 0);
    const expectedSocio = round2(totalProjectHours * 0.015);
    if (Math.abs(socioHours - expectedSocio) > 0.5) {
      warnings.push({
        key: "socio-hours",
        message: strings.pricing.warnSocioHours(socioHours, expectedSocio),
      });
    }
  }

  // Manager check
  if (managers.length === 0) {
    warnings.push({ key: "no-manager", message: strings.pricing.warnNoManager });
  } else {
    const managerHours = managers.reduce((s, e) => s + e.totalHours, 0);
    const expectedManager = round2(totalProjectHours * 0.1);
    if (Math.abs(managerHours - expectedManager) > 0.5) {
      warnings.push({
        key: "manager-hours",
        message: strings.pricing.warnManagerHours(managerHours, expectedManager),
      });
    }
  }

  return warnings;
}

// ── Component ─────────────────────────────────────────────────

export function OpportunityForm({ allEmployees, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const uid = useId();

  // Opportunity fields
  const [client, setClient] = useState(initial?.client ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [margin, setMargin] = useState(String(initial?.margin ?? ""));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  // Employees in this opportunity
  const [assignedIds, setAssignedIds] = useState<string[]>(
    initial?.employees?.map((e) => e.employeeId) ?? []
  );
  const [costMap, setCostMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial?.employees?.forEach((e) => {
      m[e.employeeId] = String(e.costPerHour);
    });
    return m;
  });
  const [hoursMap, setHoursMap] = useState<Record<string, Record<string, string>>>(() => {
    const m: Record<string, Record<string, string>> = {};
    initial?.employees?.forEach((e) => {
      const weekStrs: Record<string, string> = {};
      Object.entries(e.hours).forEach(([k, v]) => {
        weekStrs[k] = String(v);
      });
      m[e.employeeId] = weekStrs;
    });
    return m;
  });
  // Manual revenue/h overrides — if empty for an employee, formula is used
  const [revMap, setRevMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial?.employees?.forEach((e) => {
      if (e.revenuePerHour != null) m[e.employeeId] = String(e.revenuePerHour);
    });
    return m;
  });

  // Employee picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const weeks = getWeeks(startDate, endDate);

  // Helpers
  const empById = Object.fromEntries(allEmployees.map((e) => [e.id, e]));

  function getHours(empId: string, weekKey: string): string {
    return hoursMap[empId]?.[weekKey] ?? "";
  }

  function setHours(empId: string, weekKey: string, value: string) {
    setHoursMap((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] ?? {}), [weekKey]: value },
    }));
  }

  function getCost(empId: string): string {
    return costMap[empId] ?? "";
  }

  function setCost(empId: string, value: string) {
    setCostMap((prev) => ({ ...prev, [empId]: value }));
  }

  /** Returns manual override if set, otherwise formula-derived value */
  function getRevH(empId: string): number {
    if (revMap[empId] !== undefined && revMap[empId] !== "") {
      return parseFloat(revMap[empId]) || 0;
    }
    const cost = parseFloat(getCost(empId)) || 0;
    return marginNum < 100 ? round2(cost / (1 - marginNum / 100)) : 0;
  }

  function getRevHDisplay(empId: string): string {
    return revMap[empId] ?? "";
  }

  function setRevH(empId: string, value: string) {
    setRevMap((prev) => ({ ...prev, [empId]: value }));
  }

  function addEmployee(empId: string) {
    if (assignedIds.includes(empId)) return;
    setAssignedIds((prev) => [...prev, empId]);
    // Pre-fill cost from employee's base cost if available
    const emp = empById[empId];
    if (emp?.costPerHour != null) {
      setCostMap((prev) => ({ ...prev, [empId]: String(emp.costPerHour) }));
    }
    setShowPicker(false);
    setPickerSearch("");
  }

  function removeEmployee(empId: string) {
    setAssignedIds((prev) => prev.filter((id) => id !== empId));
    setCostMap((prev) => { const n = { ...prev }; delete n[empId]; return n; });
    setHoursMap((prev) => { const n = { ...prev }; delete n[empId]; return n; });
    setRevMap((prev) => { const n = { ...prev }; delete n[empId]; return n; });
  }

  // Totals
  const totalHoursPerEmp: Record<string, number> = {};
  assignedIds.forEach((empId) => {
    const total = weeks.reduce((sum, w) => {
      const v = parseFloat(getHours(empId, toLocalISO(w)));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    totalHoursPerEmp[empId] = total;
  });

  const totalProjectHours = Object.values(totalHoursPerEmp).reduce((a, b) => a + b, 0);

  const totalCost = assignedIds.reduce((sum, empId) => {
    const cost = parseFloat(getCost(empId));
    return sum + (isNaN(cost) ? 0 : cost) * totalHoursPerEmp[empId];
  }, 0);

  const marginNum = parseFloat(margin) || 0;

  // Total revenue uses per-employee revenue/h (manual override or formula)
  const totalRevenue = assignedIds.reduce((sum, empId) => {
    return sum + getRevH(empId) * (totalHoursPerEmp[empId] ?? 0);
  }, 0);
  const effectiveMargin = totalRevenue > 0 ? round2((totalRevenue - totalCost) / totalRevenue * 100) : 0;

  // Legacy revenue (formula-based, for summary label fallback)
  const revenue = round2(totalRevenue);

  // Warnings
  const empForWarnings = assignedIds.map((id) => ({
    id,
    category: empById[id]?.category ?? "",
    totalHours: totalHoursPerEmp[id] ?? 0,
  }));
  const warnings = computeWarnings(empForWarnings, totalProjectHours);

  // Available employees for picker
  const pickerEmployees = allEmployees.filter(
    (e) =>
      !assignedIds.includes(e.id) &&
      (pickerSearch === "" ||
        e.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  // Save
  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      const empPayload = assignedIds.map((empId) => {
        const hoursObj: Record<string, number> = {};
        weeks.forEach((w) => {
          const key = toLocalISO(w);
          const v = parseFloat(getHours(empId, key));
          if (!isNaN(v) && v > 0) hoursObj[key] = v;
        });
        return {
          employeeId: empId,
          costPerHour: parseFloat(getCost(empId)) || 0,
          revenuePerHour: revMap[empId] !== undefined && revMap[empId] !== ""
            ? parseFloat(revMap[empId]) || 0
            : null,
          hours: hoursObj,
        };
      });

      const result = await saveOpportunity({
        id: initial?.id,
        client,
        name,
        description,
        margin: parseFloat(margin) || 0,
        startDate,
        endDate,
        employees: empPayload,
      });

      if ("error" in result) {
        setSaveError(strings.pricing.errorSaving(result.error));
      } else {
        router.push("/main/pricing");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">

      {/* ── Opportunity fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-client`}>{strings.pricing.fieldClient}</Label>
          <Input
            id={`${uid}-client`}
            placeholder={strings.pricing.fieldClientPlaceholder}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-name`}>{strings.pricing.fieldName}</Label>
          <Input
            id={`${uid}-name`}
            placeholder={strings.pricing.fieldNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`${uid}-desc`}>{strings.pricing.fieldDescription}</Label>
          <Input
            id={`${uid}-desc`}
            placeholder={strings.pricing.fieldDescriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-start`}>{strings.pricing.fieldStartDate}</Label>
          <Input
            id={`${uid}-start`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-end`}>{strings.pricing.fieldEndDate}</Label>
          <Input
            id={`${uid}-end`}
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-margin`}>{strings.pricing.fieldMargin}</Label>
          <Input
            id={`${uid}-margin`}
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder={strings.pricing.fieldMarginPlaceholder}
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
        </div>
      </div>

      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w) => (
            <div
              key={w.key}
              className="flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
            >
              <AlertTriangleIcon className="size-4 mt-0.5 shrink-0" />
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Team section ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{strings.pricing.employeesTitle}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPicker((v) => !v)}
          >
            <PlusIcon className="size-3.5 mr-1.5" />
            {strings.pricing.addEmployeeButton}
          </Button>
        </div>

        {/* Employee picker */}
        {showPicker && (
          <div className="rounded-lg border p-3 flex flex-col gap-2 bg-muted/30">
            <Input
              autoFocus
              placeholder="Buscar empleado..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto flex flex-col divide-y">
              {pickerEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-2">No hay empleados disponibles.</p>
              ) : (
                pickerEmployees.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="flex items-center justify-between px-2 py-2 text-sm hover:bg-accent rounded text-left"
                    onClick={() => addEmployee(e.id)}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-xs text-muted-foreground">{e.email}</span>
                    </span>
                    <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                      {CATEGORY_LABELS[e.category as Category] ?? e.category}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Weekly hours grid */}
        {assignedIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.pricing.noEmployees}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="text-sm border-collapse" style={{ minWidth: "100%" }}>
              <thead>
                <tr className="bg-muted/50 border-b">
                  {/* Sticky columns */}
                  <th className="text-left font-medium px-3 py-2 whitespace-nowrap sticky left-0 z-10 bg-muted/80 min-w-[180px]">
                    {strings.pricing.colEmployee}
                  </th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap sticky left-[180px] z-10 bg-muted/80 min-w-[90px] border-r">
                    {strings.pricing.colCostPerHour}
                  </th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap sticky left-[270px] z-10 bg-muted/80 min-w-[100px] border-r">
                    {strings.pricing.colRevenuePerHour}
                  </th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap sticky left-[370px] z-10 bg-muted/80 min-w-[72px]">
                    {strings.pricing.colTotalHours}
                  </th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap sticky left-[442px] z-10 bg-muted/80 min-w-[110px]">
                    {strings.pricing.colTotalCost}
                  </th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap sticky left-[552px] z-10 bg-muted/80 min-w-[110px] border-r">
                    {strings.pricing.colNsr}
                  </th>
                  {/* Week columns */}
                  {weeks.map((w) => (
                    <th
                      key={toLocalISO(w)}
                      className="text-center font-medium px-1 py-2 whitespace-nowrap min-w-[52px]"
                    >
                      {formatWeekLabel(w)}
                    </th>
                  ))}
                  <th className="px-2 py-2 min-w-[40px]" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignedIds.map((empId) => {
                  const emp = empById[empId];
                  const empTotalHours = totalHoursPerEmp[empId] ?? 0;
                  const cost = parseFloat(getCost(empId)) || 0;
                  const empTotalCost = round2(empTotalHours * cost);
                  const revenuePerHour = getRevH(empId);
                  const empNsr = round2(revenuePerHour * empTotalHours);
                  return (
                    <tr key={empId} className="hover:bg-muted/20">
                      {/* Name + category */}
                      <td className="px-3 py-2 sticky left-0 z-10 bg-background border-r">
                        <div className="font-medium leading-tight">{emp?.name ?? empId}</div>
                        <Badge variant="secondary" className="text-[10px] mt-0.5">
                          {CATEGORY_LABELS[emp?.category as Category] ?? emp?.category}
                        </Badge>
                      </td>
                      {/* Cost per hour */}
                      <td className="px-2 py-2 sticky left-[180px] z-10 bg-background border-r">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 w-20 text-right text-xs px-2"
                          value={getCost(empId)}
                          onChange={(e) => setCost(empId, e.target.value)}
                        />
                      </td>
                      {/* Revenue per hour — editable, formula as placeholder */}
                      <td className="px-2 py-2 text-right tabular-nums sticky left-[270px] z-10 bg-background border-r">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 w-24 text-right text-xs px-2 text-violet-600 dark:text-violet-400 font-medium"
                          placeholder={String(marginNum < 100 ? round2((parseFloat(getCost(empId)) || 0) / (1 - marginNum / 100)) : 0)}
                          value={getRevHDisplay(empId)}
                          onChange={(e) => setRevH(empId, e.target.value)}
                        />
                      </td>
                      {/* Total hours */}
                      <td className="px-3 py-2 text-right font-medium tabular-nums sticky left-[370px] z-10 bg-background">
                        {empTotalHours}
                      </td>
                      {/* Total cost */}
                      <td className="px-3 py-2 text-right tabular-nums sticky left-[442px] z-10 bg-background">
                        {empTotalCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {/* NSR */}
                      <td className="px-3 py-2 text-right tabular-nums sticky left-[552px] z-10 bg-background border-r text-emerald-600 dark:text-emerald-400 font-medium">
                        {empNsr.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {/* Week inputs */}
                      {weeks.map((w) => {
                        const key = toLocalISO(w);
                        const val = getHours(empId, key);
                        const num = parseFloat(val);
                        const isOver = !isNaN(num) && num > 42;
                        return (
                          <td key={key} className="px-1 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="42"
                              step="1"
                              className={cn(
                                "w-11 h-7 text-center text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary",
                                isOver && "border-red-400 bg-red-50 dark:bg-red-950/20"
                              )}
                              value={val}
                              onChange={(e) => setHours(empId, key, e.target.value)}
                            />
                          </td>
                        );
                      })}
                      {/* Remove */}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          title={strings.pricing.removeEmployee}
                          onClick={() => removeEmployee(empId)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <XIcon className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary row */}
        {assignedIds.length > 0 && (() => {
          const tarifa = totalProjectHours > 0 ? round2(totalRevenue / totalProjectHours) : 0;

          const categoryHours = (cats: string[]) =>
            assignedIds
              .filter((id) => cats.includes(empById[id]?.category ?? ""))
              .reduce((s, id) => s + (totalHoursPerEmp[id] ?? 0), 0);

          const pct = (h: number) =>
            totalProjectHours > 0 ? ` (${round2((h / totalProjectHours) * 100)}%)` : "";

          const hSocio   = categoryHours(["Socio"]);
          const hManager = categoryHours(["Manager", "Senior-Manager"]);
          const hSenior  = categoryHours(["Senior"]);
          const hStaff   = categoryHours(["Staff"]);

          return (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-4 text-sm">
              {/* First row: financial KPIs */}
              <div className="flex flex-wrap gap-6 border-b pb-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryTotalHours}</span>
                  <span className="font-bold tabular-nums">{totalProjectHours}h</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryTotalCost}</span>
                  <span className="font-bold tabular-nums">
                    {totalCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {strings.pricing.summaryRevenue}
                  </span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {revenue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryTarifa}</span>
                  <span className="font-bold tabular-nums text-violet-600 dark:text-violet-400">
                    {tarifa.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Margen efectivo</span>
                  <span className={`font-bold tabular-nums ${effectiveMargin >= marginNum ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {effectiveMargin.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </span>
                </div>
              </div>
              {/* Second row: category breakdowns */}
              <div className="flex flex-wrap gap-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryHoursSocio}</span>
                  <span className="font-semibold tabular-nums">{hSocio}h<span className="font-normal text-muted-foreground">{pct(hSocio)}</span></span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryHoursManager}</span>
                  <span className="font-semibold tabular-nums">{hManager}h<span className="font-normal text-muted-foreground">{pct(hManager)}</span></span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryHoursSenior}</span>
                  <span className="font-semibold tabular-nums">{hSenior}h<span className="font-normal text-muted-foreground">{pct(hSenior)}</span></span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{strings.pricing.summaryHoursStaff}</span>
                  <span className="font-semibold tabular-nums">{hStaff}h<span className="font-normal text-muted-foreground">{pct(hStaff)}</span></span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Save ── */}
      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending || !client || !name || !startDate || !endDate}
        >
          {isPending ? strings.pricing.savingButton : strings.pricing.saveButton}
        </Button>
      </div>
    </div>
  );
}
