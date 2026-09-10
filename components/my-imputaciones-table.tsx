"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { MyImputacionesData } from "@/app/main/my-imputaciones/actions";
import { requestEngagement } from "@/app/main/my-imputaciones/actions";
import {
  BriefcaseIcon,
  PalmtreeIcon,
  CalendarIcon,
  StethoscopeIcon,
  GraduationCapIcon,
  HelpCircleIcon,
  ClockIcon,
  SendIcon,
  CheckCircleIcon,
} from "lucide-react";

// ── Month color palette (same as admin calendar) ──────────
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

const ABSENCE_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  vacation: { icon: PalmtreeIcon, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
  holiday: { icon: CalendarIcon, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  medical: { icon: StethoscopeIcon, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  bootcamp: { icon: GraduationCapIcon, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  other: { icon: HelpCircleIcon, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
};

type Props = {
  data: MyImputacionesData;
};

export function MyImputacionesTable({ data }: Props) {
  const { weeks, monthGroups, engagements, absences, commercialHours, weekTargetHours, weekTotals, hasUnassignedHours } = data;

  // Engagement request state
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleRequestEngagement = async () => {
    setRequesting(true);
    try {
      const result = await requestEngagement();
      if (result.success) {
        setRequestSent(true);
      } else if (result.error) {
        alert(result.error);
      }
    } catch {
      alert("Error al enviar la solicitud.");
    } finally {
      setRequesting(false);
    }
  };

  // Current week index
  const currentWeekIdx = useMemo(() => {
    const now = new Date();
    const nowMonday = new Date(now);
    const day = nowMonday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    nowMonday.setDate(nowMonday.getDate() + diff);
    nowMonday.setHours(0, 0, 0, 0);
    for (let i = 0; i < weeks.length; i++) {
      const wStart = new Date(weeks[i].start);
      if (wStart.getTime() === nowMonday.getTime()) return i;
      if (wStart > nowMonday) return Math.max(0, i - 1);
    }
    return weeks.length - 1;
  }, [weeks]);

  // Week color map
  const weekColorMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of monthGroups) {
      for (let i = g.startIdx; i <= g.endIdx; i++) {
        map.set(i, g.colorIdx);
      }
    }
    return map;
  }, [monthGroups]);

  // Auto-scroll to current week on mount
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tableRef.current || currentWeekIdx <= 0) return;
    const el = tableRef.current.querySelector(`[data-week="${currentWeekIdx}"]`);
    if (el) {
      const container = tableRef.current;
      const stickyColWidth = 180;
      container.scrollLeft = (el as HTMLElement).offsetLeft - stickyColWidth - 16;
    }
  }, [currentWeekIdx]);

  if (weeks.length === 0 || (engagements.length === 0 && absences.length === 0)) {
    return (
      <div className="rounded-xl border p-8 text-center">
        <BriefcaseIcon className="size-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No tienes imputaciones planificadas para este año.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Engagement request button */}
      {hasUnassignedHours && (
        <div className="flex justify-end">
          {requestSent ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <CheckCircleIcon className="size-4" />
              Solicitud enviada a tus managers
            </span>
          ) : (
            <button
              onClick={handleRequestEngagement}
              disabled={requesting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors"
            >
              <SendIcon className="size-4" />
              {requesting ? "Enviando..." : "Solicitar engagement"}
            </button>
          )}
        </div>
      )}

  return (
    <div ref={tableRef} className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-xs min-w-[800px]">
        <thead>
          {/* Month name row */}
          <tr>
            <th className="text-left px-3 py-1 font-medium sticky left-0 bg-background z-10 min-w-[180px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]" />
            {monthGroups.map((g) => {
              const color = MONTH_COLORS[g.colorIdx % MONTH_COLORS.length];
              return (
                <th
                  key={g.monthKey}
                  colSpan={g.endIdx - g.startIdx + 1}
                  className={`text-center px-1 py-1 font-bold text-[11px] border-b ${color.bg} ${color.text} ${color.border}`}
                >
                  {g.monthName} {weeks[g.startIdx].start.getFullYear()}
                </th>
              );
            })}
            <th className="text-center px-3 py-1 font-medium sticky right-0 bg-background z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]" />
          </tr>
          {/* Week header row */}
          <tr className="bg-muted/50">
            <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted z-10 min-w-[180px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
              Engagement
            </th>
            {weeks.map((w, i) => {
              const colorIdx = weekColorMap.get(i) ?? 0;
              const color = MONTH_COLORS[colorIdx % MONTH_COLORS.length];
              const isCurrentWeek = i === currentWeekIdx;
              return (
                <th
                  key={i}
                  data-week={i}
                  className={`text-center px-2 py-2 font-medium min-w-[60px] border-b-2 ${color.border} ${
                    w.isSummer ? "text-amber-600 dark:text-amber-400" : ""
                  } ${isCurrentWeek ? "ring-2 ring-primary/50 rounded-t" : ""}`}
                >
                  <div>{w.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {w.isSummer ? "Verano" : "Regular"}
                  </div>
                </th>
              );
            })}
            <th className="text-center px-3 py-2 font-medium min-w-[70px] sticky right-0 bg-muted z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Engagement rows */}
          {engagements.map((eng) => {
            const total = Array.from(eng.weekHours.values()).reduce((s, h) => s + h, 0);
            return (
              <tr key={eng.id} className="border-t">
                <td className="px-3 py-2 sticky left-0 bg-background z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-2">
                    <BriefcaseIcon className="size-3.5 text-indigo-500 shrink-0" />
                    <div>
                      <div className="font-medium">{eng.clientName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {eng.engagementCode} · {eng.engagementName}
                      </div>
                    </div>
                  </div>
                </td>
                {weeks.map((w, i) => {
                  const val = eng.weekHours.get(i);
                  const isCurrentWeek = i === currentWeekIdx;
                  return (
                    <td
                      key={i}
                      className={`text-center px-1 py-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}
                    >
                      {val !== undefined ? (
                        <span className="inline-block w-12 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                          {val}h
                        </span>
                      ) : (
                        <span className="inline-block w-12 text-center text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2 font-semibold text-indigo-600 dark:text-indigo-400 sticky right-0 bg-background z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                  {total}h
                </td>
              </tr>
            );
          })}

          {/* Acción comercial row (Managers & Senior Managers only) */}
          {commercialHours && (
            <tr className="border-t bg-emerald-50/50 dark:bg-emerald-950/20">
              <td className="px-3 py-2 sticky left-0 bg-emerald-50 dark:bg-emerald-950/95 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <BriefcaseIcon className="size-3" />
                  </span>
                  <div className="font-medium text-emerald-700 dark:text-emerald-300">Acción comercial</div>
                </div>
              </td>
              {weeks.map((w, i) => {
                const hours = commercialHours.get(i);
                const isCurrentWeek = i === currentWeekIdx;
                return (
                  <td
                    key={i}
                    className={`text-center px-1 py-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}
                  >
                    {hours !== undefined && hours > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {hours}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                );
              })}
              <td className="text-center px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400 sticky right-0 bg-emerald-50 dark:bg-emerald-950/95 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                {Array.from(commercialHours.values()).reduce((s, h) => s + h, 0)}h
              </td>
            </tr>
          )}

          {/* Absence rows */}
          {absences.map((abs, absIdx) => {
            const config = ABSENCE_ICONS[abs.type] ?? ABSENCE_ICONS.other;
            const Icon = config.icon;
            const totalHours = Array.from(abs.weekHours.values()).reduce((s, h) => s + h, 0);
            return (
              <tr key={`abs-${absIdx}`} className="border-t">
                <td className="px-3 py-2 sticky left-0 bg-background z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center size-5 rounded ${config.bg} ${config.color} shrink-0`}>
                      <Icon className="size-3" />
                    </span>
                    <div>
                      <div className="font-medium">{abs.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(abs.startDate + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                        {" – "}
                        {new Date(abs.endDate + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                  </div>
                </td>
                {weeks.map((w, i) => {
                  const hours = abs.weekHours.get(i);
                  const isCurrentWeek = i === currentWeekIdx;
                  return (
                    <td
                      key={i}
                      className={`text-center px-1 py-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}
                    >
                      {hours !== undefined && hours > 0 ? (
                        <span className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-[10px] font-bold ${config.bg} ${config.color}`}>
                          {hours}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
                <td className={`text-center px-3 py-2 font-semibold sticky right-0 bg-background z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)] ${config.color}`}>
                  {totalHours}h
                </td>
              </tr>
            );
          })}

          {/* Horas sin asignar row */}
          <tr className="border-t bg-amber-50/50 dark:bg-amber-950/20">
            <td className="px-3 py-2 sticky left-0 bg-amber-50 dark:bg-amber-950/95 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center size-5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <ClockIcon className="size-3" />
                </span>
                <div className="font-medium text-amber-700 dark:text-amber-300">Horas sin asignar</div>
              </div>
            </td>
            {weeks.map((w, i) => {
              const target = weekTargetHours.get(i) ?? 0;
              const used = weekTotals.get(i) ?? 0;
              const absenceHours = absences.reduce((s, a) => s + (a.weekHours.get(i) ?? 0), 0);
              const commHours = commercialHours?.get(i) ?? 0;
              const unassigned = target - used - absenceHours - commHours;
              const isCurrentWeek = i === currentWeekIdx;
              const isOver = unassigned < 0;
              return (
                <td
                  key={i}
                  className={`text-center px-1 py-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}
                >
                  {target > 0 ? (
                    <span className={`text-xs font-semibold ${isOver ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                      {unassigned}h
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
              );
            })}
            <td className="text-center px-3 py-2 font-semibold text-amber-600 dark:text-amber-400 sticky right-0 bg-amber-50 dark:bg-amber-950/95 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
              {Array.from(weekTargetHours.values()).reduce((s, h) => s + h, 0)
                - Array.from(weekTotals.values()).reduce((s, h) => s + h, 0)
                - absences.reduce((s, a) => s + Array.from(a.weekHours.values()).reduce((sh, h) => sh + h, 0), 0)
                - (commercialHours ? Array.from(commercialHours.values()).reduce((s, h) => s + h, 0) : 0)}h
            </td>
          </tr>

          {/* Total row (base reference: 42h / 30h summer) */}
          <tr className="border-t-2 bg-muted/30 font-semibold">
            <td className="px-3 py-2 sticky left-0 bg-muted z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)] text-muted-foreground">
              Total horas/semana
            </td>
            {weeks.map((w, i) => {
              const target = weekTargetHours.get(i) ?? 0;
              const isCurrentWeek = i === currentWeekIdx;
              return (
                <td
                  key={i}
                  className={`text-center px-1 py-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}
                >
                  <span className="text-xs text-foreground">
                    {target}h
                  </span>
                </td>
              );
            })}
            <td className="text-center px-3 py-2 sticky right-0 bg-muted z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">
              {weeks.length > 0 ? `${weekTargetHours.get(0) ?? 42}h` : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
}
