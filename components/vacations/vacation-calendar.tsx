"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getHolidaysForOffice,
  isWeekend,
  isHoliday,
  isWorkingDay,
  countWorkingDays,
  toDateString,
  OFFICE_LABELS,
  type Office,
} from "@/lib/holidays";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { strings } from "@/lib/strings";

type VacationRequest = {
  id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  year: number;
};

type Props = {
  employeeId: string;
  office: Office;
  requests: VacationRequest[];
  maxDays: number;
  onSubmit: (
    employeeId: string,
    startDate: string,
    endDate: string,
    daysRequested: number,
    year: number
  ) => Promise<{ error?: string }>;
};

const STATUS_LABELS: Record<VacationRequest["status"], string> = {
  pending: strings.vacations.statusPending,
  approved: strings.vacations.statusApproved,
  rejected: strings.vacations.statusRejected,
  cancelled: strings.vacations.statusCancelled,
};

const STATUS_VARIANT: Record<
  VacationRequest["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

const STATUS_ROW_COLOR: Record<VacationRequest["status"], string> = {
  pending:   "border-l-4 border-l-amber-400 bg-amber-50/50 dark:bg-amber-900/10",
  approved:  "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10",
  rejected:  "border-l-4 border-l-red-400 bg-red-50/50 dark:bg-red-900/10",
  cancelled: "border-l-4 border-l-muted-foreground/30 opacity-60",
};

const DAYS_SHORT = strings.vacations.calendarDaysShort;
const MONTH_NAMES = strings.vacations.calendarMonths;

function buildMonth(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  // Monday-based week: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

export function VacationCalendar({
  employeeId,
  office,
  requests,
  maxDays,
  onSubmit,
}: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const minDate = new Date(currentYear, 0, 1);
  const maxDate = new Date(currentYear + 1, 0, 31);

  const [startPage, setStartPage] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const holidays = useMemo(() => getHolidaysForOffice(office), [office]);

  // Months to display: current startPage and next
  const months = useMemo(() => {
    const m0 = startPage;
    const m1month = (startPage.month + 1) % 12;
    const m1year = startPage.month === 11 ? startPage.year + 1 : startPage.year;
    return [
      { year: m0.year, month: m0.month },
      { year: m1year, month: m1month },
    ];
  }, [startPage]);

  const canGoBack = useMemo(() => {
    const prev = new Date(startPage.year, startPage.month - 1, 1);
    return prev >= new Date(currentYear, 0, 1);
  }, [startPage, currentYear]);

  const canGoForward = useMemo(() => {
    const next = new Date(startPage.year, startPage.month + 2, 1);
    return next <= maxDate;
  }, [startPage, maxDate]);

  const goBack = () => {
    setStartPage((p) => {
      if (p.month === 0) return { year: p.year - 1, month: 11 };
      return { year: p.year, month: p.month - 1 };
    });
  };

  const goForward = () => {
    setStartPage((p) => {
      if (p.month === 11) return { year: p.year + 1, month: 0 };
      return { year: p.year, month: p.month + 1 };
    });
  };

  // Build a map of date → status across all non-cancelled requests
  const existingDates = useMemo(() => {
    const map = new Map<string, VacationRequest["status"]>();
    for (const r of requests) {
      if (r.status === "cancelled") continue;
      const cur = new Date(r.start_date + "T00:00:00");
      const end = new Date(r.end_date + "T00:00:00");
      while (cur <= end) {
        const ds = toDateString(cur);
        // approved wins over pending; pending wins over rejected
        const prev = map.get(ds);
        if (!prev || r.status === "approved" || (r.status === "pending" && prev === "rejected")) {
          map.set(ds, r.status);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [requests]);

  // For overlap check: only pending/approved block new selections
  const blockedDates = useMemo(() => {
    const set = new Set<string>();
    existingDates.forEach((status, ds) => {
      if (status === "pending" || status === "approved") set.add(ds);
    });
    return set;
  }, [existingDates]);

  const effectiveEnd = rangeStart && !rangeEnd && hovered ? hovered : rangeEnd;
  const selStart =
    rangeStart && effectiveEnd
      ? rangeStart <= effectiveEnd
        ? rangeStart
        : effectiveEnd
      : rangeStart;
  const selEnd =
    rangeStart && effectiveEnd
      ? rangeStart <= effectiveEnd
        ? effectiveEnd
        : rangeStart
      : null;

  // Check if current selection overlaps any existing (pending/approved) request
  const hasOverlap = useMemo(() => {
    if (!selStart) return false;
    const end = selEnd ?? selStart;
    const cur = new Date(selStart);
    while (cur <= end) {
      if (blockedDates.has(toDateString(cur))) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }, [selStart, selEnd, blockedDates]);

  const rangeOverlaps = (start: Date, end: Date): boolean => {
    const cur = new Date(start);
    while (cur <= end) {
      if (blockedDates.has(toDateString(cur))) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  };

  const handleDayClick = (date: Date) => {
    if (
      isWeekend(date) ||
      isHoliday(date, holidays) ||
      date < minDate ||
      date > maxDate
    )
      return;

    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Start new selection — also reset error
      setRangeStart(date);
      setRangeEnd(null);
      setSubmitError(null);
      setSuccessMsg(null);
    } else {
      // Set end — reject if the resulting range overlaps existing requests
      const newStart = date < rangeStart ? date : rangeStart;
      const newEnd = date < rangeStart ? rangeStart : date;
      if (rangeOverlaps(newStart, newEnd)) {
        setSubmitError(strings.vacations.errorOverlapSubmit);
        return;
      }
      setSubmitError(null);
      if (date < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(date);
      } else {
        setRangeEnd(date);
      }
    }
  };

  const daysSelected = useMemo(() => {
    if (!selStart || !selEnd) return selStart ? 1 : 0;
    return countWorkingDays(selStart, selEnd, holidays);
  }, [selStart, selEnd, holidays]);

  const remaining =
    maxDays - (requests
      .filter(r => r.status === "approved" || r.status === "pending")
      .reduce((s, r) => s + r.days_requested, 0));

  const handleSubmit = async () => {
    if (!selStart) return;
    if (hasOverlap) {
      setSubmitError(strings.vacations.errorOverlapSubmit);
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    const end = selEnd ?? selStart;
    const year = selStart.getFullYear();

    const result = await onSubmit(
      employeeId,
      toDateString(selStart),
      toDateString(end),
      daysSelected,
      year
    );

    if (result?.error) {
      setSubmitError(result.error);
    } else {
      setSuccessMsg(strings.vacations.successMessage(daysSelected));
      setRangeStart(null);
      setRangeEnd(null);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const getDayState = (date: Date) => {
    const ds = toDateString(date);
    const weekend = isWeekend(date);
    const holiday = isHoliday(date, holidays);
    const outOfRange = date < minDate || date > maxDate;
    const existingStatus = existingDates.get(ds) ?? null;
    let inSelection = false;
    let isSelStart = false;
    let isSelEnd = false;

    if (selStart) {
      isSelStart = toDateString(selStart) === ds;
      isSelEnd = selEnd ? toDateString(selEnd) === ds : isSelStart;
      if (selEnd) {
        inSelection = date >= selStart && date <= selEnd;
      } else {
        inSelection = isSelStart;
      }
    }

    return { weekend, holiday, outOfRange, existingStatus, inSelection, isSelStart, isSelEnd };
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Office indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{strings.vacations.calendarOfficeLabel}</span>
        <span className="px-3 py-1 rounded-full text-sm bg-primary text-primary-foreground font-medium">
          {OFFICE_LABELS[office]}
        </span>
        <span className="text-xs text-muted-foreground">
          {strings.vacations.calendarOfficeHint}
        </span>
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          disabled={!canGoBack}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {MONTH_NAMES[months[0].month]} {months[0].year} —{" "}
          {MONTH_NAMES[months[1].month]} {months[1].year}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={goForward}
          disabled={!canGoForward}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Two-month grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {months.map(({ year, month }) => {
          const cells = buildMonth(year, month);
          return (
            <div key={`${year}-${month}`} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-center">
                {MONTH_NAMES[month]} {year}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {DAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-1"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((date, i) => {
                  if (!date) {
                    return <div key={`empty-${i}`} />;
                  }
                  const {
                    weekend,
                    holiday,
                    outOfRange,
                    existingStatus,
                    inSelection,
                    isSelStart,
                    isSelEnd,
                  } = getDayState(date);

                  const disabled = weekend || holiday || outOfRange;
                  const isEndpoint = isSelStart || isSelEnd;

                  return (
                    <button
                      key={toDateString(date)}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDayClick(date)}
                      onMouseEnter={() => {
                        if (rangeStart && !rangeEnd) setHovered(date);
                      }}
                      onMouseLeave={() => setHovered(null)}
                      title={
                        existingStatus === "approved" ? strings.vacations.calendarTitleApproved
                        : existingStatus === "pending" ? strings.vacations.calendarTitlePending
                        : existingStatus === "rejected" ? strings.vacations.calendarTitleRejected
                        : holiday ? strings.vacations.calendarTitleHoliday
                        : weekend ? strings.vacations.calendarTitleWeekend
                        : undefined
                      }
                      className={cn(
                        "relative text-xs h-9 w-full rounded-md flex items-center justify-center transition-colors select-none",
                        disabled && "text-muted-foreground/40 cursor-not-allowed",
                        holiday && !weekend && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium",
                        weekend && "bg-muted/30",
                        !disabled && !inSelection && !existingStatus && "hover:bg-accent",
                        existingStatus === "approved" && !inSelection && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium",
                        existingStatus === "pending"  && !inSelection && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium",
                        existingStatus === "rejected" && !inSelection && "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 line-through opacity-60",
                        inSelection && !isEndpoint && "bg-primary/20 rounded-none",
                        isEndpoint && "bg-primary text-primary-foreground font-semibold",
                        isSelStart && selEnd && "rounded-r-none",
                        isSelEnd && selStart && toDateString(selStart) !== toDateString(date) && "rounded-l-none",
                      )}
                    >
                      {date.getDate()}
                      {holiday && !weekend && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary" /> {strings.vacations.legendSelected}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary/20" /> {strings.vacations.legendRange}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> {strings.vacations.legendApproved}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-amber-200 dark:bg-amber-800/40" /> {strings.vacations.legendPending}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-red-100 dark:bg-red-900/30" /> {strings.vacations.legendRejected}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300" /> {strings.vacations.legendHoliday}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-muted/30" /> {strings.vacations.legendWeekend}
        </span>
      </div>

      {/* Selection summary + submit */}
      {(rangeStart || daysSelected > 0) && (
        <div className="rounded-lg border p-4 flex flex-col gap-3 bg-muted/20">
          <p className="text-sm font-medium">{strings.vacations.selectionTitle}</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <span className="text-muted-foreground">{strings.vacations.selectionFrom}</span>
              {selStart?.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) ?? "—"}
            </span>
            <span>
              <span className="text-muted-foreground">{strings.vacations.selectionTo}</span>
              {(selEnd ?? selStart)?.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) ?? "—"}
            </span>
            <span>
              <span className="text-muted-foreground">{strings.vacations.selectionWorkingDays}</span>
              <strong>{daysSelected}</strong>
            </span>
            <span className={cn(daysSelected > remaining ? "text-red-500" : "")}>
                <span className="text-muted-foreground">{strings.vacations.selectionRemaining}</span>
                <strong>{remaining}</strong>
              </span>
          </div>
          {daysSelected > remaining && (
            <p className="text-xs text-red-500">
              {strings.vacations.errorNotEnoughDays}
            </p>
          )}
          {hasOverlap && (
            <p className="text-xs text-red-500">
              {strings.vacations.errorOverlapInline}
            </p>
          )}
          {submitError && <p className="text-xs text-red-500">{submitError}</p>}
          {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                daysSelected === 0 ||
                hasOverlap ||
                daysSelected > remaining
              }
            >
              {isSubmitting ? strings.vacations.submitLoading : strings.vacations.submitIdle}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRangeStart(null);
                setRangeEnd(null);
                setSubmitError(null);
                setSuccessMsg(null);
              }}
            >
              {strings.vacations.clearButton}
            </Button>
          </div>
        </div>
      )}

      {/* Vacation requests summary */}
      <div className="flex flex-col gap-4">
        {/* 5-stat balance cards */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const solicitados = requests
            .filter(r => r.status !== "cancelled")
            .reduce((s, r) => s + r.days_requested, 0);
          const aprobados = requests
            .filter(r => r.status === "approved")
            .reduce((s, r) => s + r.days_requested, 0);
          const pendientes = requests
            .filter(r => r.status === "pending")
            .reduce((s, r) => s + r.days_requested, 0);
          const disfrutados = requests
            .filter(r => r.status === "approved" && new Date(r.end_date + "T00:00:00") < today)
            .reduce((s, r) => s + r.days_requested, 0);
          const restantes = maxDays - aprobados - pendientes;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: strings.vacations.statSolicitados, value: solicitados, color: "text-foreground" },
                { label: strings.vacations.statAprobados, value: aprobados, color: "text-emerald-600 dark:text-emerald-400" },
                { label: strings.vacations.statPendientes, value: pendientes, color: "text-amber-600 dark:text-amber-400" },
                { label: strings.vacations.statDisfrutados, value: disfrutados, color: "text-blue-600 dark:text-blue-400" },
                { label: strings.vacations.statRestantes, value: restantes, color: restantes < 0 ? "text-red-500" : "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border bg-card p-3 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-2xl font-bold ${color}`}>{value}</span>
                  <span className="text-xs text-muted-foreground">{strings.vacations.statOf(maxDays)}</span>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{strings.vacations.requestsTitle}</h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.vacations.requestsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-amber-400" /> {strings.vacations.requestsLegendPending}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-emerald-500" /> {strings.vacations.requestsLegendApproved}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-red-400" /> {strings.vacations.requestsLegendRejected}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-muted-foreground/30" /> {strings.vacations.requestsLegendCancelled}
              </span>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left font-medium px-4 py-2">{strings.vacations.colFrom}</th>
                    <th className="text-left font-medium px-4 py-2">{strings.vacations.colTo}</th>
                    <th className="text-left font-medium px-4 py-2">{strings.vacations.colDays}</th>
                    <th className="text-left font-medium px-4 py-2">{strings.vacations.colYear}</th>
                    <th className="text-left font-medium px-4 py-2">{strings.vacations.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r) => (
                    <tr key={r.id} className={cn("transition-colors", STATUS_ROW_COLOR[r.status])}>
                      <td className="px-4 py-2">
                        {new Date(r.start_date + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(r.end_date + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2 font-medium">{r.days_requested}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.year}</td>
                      <td className="px-4 py-2">
                        <Badge variant={STATUS_VARIANT[r.status]}>
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
