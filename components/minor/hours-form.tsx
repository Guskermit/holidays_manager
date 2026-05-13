"use client";

import { useState, useRef, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertMinorHours } from "@/app/main/minor/actions";
import { strings } from "@/lib/strings";

// ── Types ─────────────────────────────────────────────────────────────────────

type Subproject = { id: string; name: string; color: string };

type HoursMap = {
  [weekStart: string]: { [subprojectId: string]: number };
};

type Props = {
  subprojects: Subproject[];
  weeklyHours: number;
  initialHours: { subproject_id: string; week_start: string; hours: number }[];
  defaultWeekStart: string;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NAMES = strings.vacations.calendarMonths;

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addWeeks(iso: string, delta: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + delta * 7);
  return toIso(d);
}

function weekLabel(iso: string): string {
  const monday = parseIso(iso);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`;
  return `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
}

// Group subprojects by color, preserving insertion order of colors
function groupByColor(
  subprojects: Subproject[]
): { color: string; items: Subproject[] }[] {
  const map = new Map<string, Subproject[]>();
  for (const sp of subprojects) {
    const c = sp.color || "#6366f1";
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(sp);
  }
  return Array.from(map.entries()).map(([color, items]) => ({ color, items }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MinorHoursForm({
  subprojects,
  weeklyHours,
  initialHours,
  defaultWeekStart,
}: Props) {
  const [currentWeek, setCurrentWeek] = useState(defaultWeekStart);

  const buildInitialMap = (): HoursMap => {
    const map: HoursMap = {};
    for (const entry of initialHours) {
      if (!map[entry.week_start]) map[entry.week_start] = {};
      map[entry.week_start][entry.subproject_id] = Number(entry.hours);
    }
    return map;
  };

  const [hoursMap, setHoursMap] = useState<HoursMap>(buildInitialMap);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const weekData = hoursMap[currentWeek] ?? {};
  const total = subprojects.reduce((sum, sp) => sum + (weekData[sp.id] ?? 0), 0);
  const isComplete = total === weeklyHours;
  const groups = groupByColor(subprojects);

  // ── Auto-save with debounce ────────────────────────────────────────────────

  const triggerSave = (weekStart: string, map: HoursMap) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    setSaveError(null);

    debounceRef.current = setTimeout(() => {
      const entries = subprojects.map((sp) => ({
        subproject_id: sp.id,
        week_start: weekStart,
        hours: map[weekStart]?.[sp.id] ?? 0,
      }));

      startTransition(async () => {
        const result = await upsertMinorHours(entries);
        if (result?.error) {
          setSaveStatus("error");
          setSaveError(strings.minor.errorSaving(result.error));
        } else {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      });
    }, 800);
  };

  const handleChange = (subprojectId: string, raw: string) => {
    const value = raw === "" ? 0 : Math.max(0, parseFloat(raw) || 0);
    const newMap: HoursMap = {
      ...hoursMap,
      [currentWeek]: { ...(hoursMap[currentWeek] ?? {}), [subprojectId]: value },
    };
    setHoursMap(newMap);
    triggerSave(currentWeek, newMap);
  };

  const navigate = (delta: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("idle");
    setSaveError(null);
    setCurrentWeek((w) => addWeeks(w, delta));
  };

  if (subprojects.length === 0) {
    return <p className="text-sm text-muted-foreground">{strings.minor.noSubprojects}</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Week navigator + save status */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title={strings.minor.prevWeek}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-base font-semibold min-w-[210px] text-center">
            {weekLabel(currentWeek)}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} title={strings.minor.nextWeek}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <div className="text-sm min-w-[100px] text-right">
          {saveStatus === "saving" && (
            <span className="text-muted-foreground animate-pulse">{strings.minor.savingButton}</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-emerald-600 flex items-center justify-end gap-1">
              <CheckIcon className="size-3.5" />
              {strings.minor.savedMessage}
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-500 text-xs">{saveError}</span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {strings.minor.weeklyHoursTarget(weeklyHours)}
      </p>

      {/* Hours table grouped by color */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left font-medium px-4 py-3">Subproyecto</th>
              <th className="text-center font-medium px-4 py-3">Horas</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ color, items }) => (
              <>
                {/* Color group header */}
                <tr key={`group-${color}`} style={{ borderTop: `3px solid ${color}` }}>
                  <td
                    colSpan={2}
                    className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color, backgroundColor: `${color}15` }}
                  >
                    <span
                      className="inline-block size-2 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: color }}
                    />
                    {items.length === 1 ? items[0].name : `${items.length} subproyectos`}
                  </td>
                </tr>

                {/* Rows for this group */}
                {items.map((sp) => (
                  <tr key={sp.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {sp.name}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max="168"
                        step="0.5"
                        value={weekData[sp.id] ?? 0}
                        onChange={(e) => handleChange(sp.id, e.target.value)}
                        className={cn(
                          "w-20 text-center rounded border bg-background px-2 py-1 text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-ring border-input",
                          "hover:border-muted-foreground/50 transition-colors"
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </>
            ))}

            {/* Total row */}
            <tr className="bg-muted/30 border-t-2">
              <td className="px-4 py-3 font-semibold">{strings.minor.totalLabel}</td>
              <td className={cn(
                "px-4 py-3 text-center font-semibold tabular-nums",
                total > 0 && !isComplete && "text-red-500",
                isComplete && "text-emerald-600",
              )}>
                {total % 1 === 0 ? total : total.toFixed(1)}
                {!isComplete && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {weeklyHours}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
