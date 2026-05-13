"use client";

import { useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifyIncompleteMinorHours } from "@/app/main/admin/minor/hours/actions";
import { strings } from "@/lib/strings";

// ── Types ─────────────────────────────────────────────────────────────────────

type Subproject = { id: string; name: string; color: string };

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  weekly_hours: number;
  hours: { [subprojectId: string]: number };
};

type Props = {
  subprojects: Subproject[];
  employees: EmployeeRow[];
  defaultWeekStart: string;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function prevWeekIso(iso: string): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() - 7);
  return toIso(d);
}

function nextWeekIso(iso: string): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + 7);
  return toIso(d);
}

function weekLabel(iso: string): string {
  const monday = parseIso(iso);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  return `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
}

// Group subprojects by color preserving first-seen order
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

export function MinorHoursTable({
  subprojects,
  employees: initialEmployees,
  defaultWeekStart,
}: Props) {
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [, startTransition] = useTransition();

  const groups = groupByColor(subprojects);

  const incompleteEmployees = initialEmployees.filter((e) => {
    const total = subprojects.reduce((sum, sp) => sum + (e.hours[sp.id] ?? 0), 0);
    return total < e.weekly_hours;
  });

  const handleNotify = () => {
    setNotifyStatus("sending");

    const payload = incompleteEmployees.map((e) => ({
      name: e.name,
      email: e.email,
      hoursLogged: subprojects.reduce((sum, sp) => sum + (e.hours[sp.id] ?? 0), 0),
      hoursTarget: e.weekly_hours,
    }));

    startTransition(async () => {
      const result = await notifyIncompleteMinorHours({
        weekStart: defaultWeekStart,
        incompleteEmployees: payload,
      });
      if (result?.error) {
        setNotifyStatus("error");
        setTimeout(() => setNotifyStatus("idle"), 3000);
      } else {
        setNotifyStatus("sent");
        setTimeout(() => setNotifyStatus("idle"), 3000);
      }
    });
  };

  const navigate = (iso: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("week", iso);
    window.location.href = url.toString();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Week navigator + notify button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(prevWeekIso(defaultWeekStart))}
            title={strings.minor.adminHoursPrevWeek}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-base font-semibold min-w-[240px] text-center">
            {strings.minor.adminHoursWeekOf(weekLabel(defaultWeekStart))}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(nextWeekIso(defaultWeekStart))}
            title={strings.minor.adminHoursNextWeek}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        {incompleteEmployees.length > 0 && (
          <Button
            variant="outline"
            onClick={handleNotify}
            disabled={notifyStatus === "sending"}
            className={cn(
              notifyStatus === "sent"  && "border-emerald-500 text-emerald-700",
              notifyStatus === "error" && "border-red-500 text-red-600",
            )}
          >
            <BellIcon className="size-4 mr-1.5" />
            {notifyStatus === "idle"    && strings.minor.adminHoursSlackButton}
            {notifyStatus === "sending" && strings.minor.adminHoursSlackSending}
            {notifyStatus === "sent"    && strings.minor.adminHoursSlackSent}
            {notifyStatus === "error"   && strings.minor.adminHoursSlackError}
          </Button>
        )}
      </div>

      {initialEmployees.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.minor.adminHoursNoEmployees}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {/* Employee column */}
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap sticky left-0 bg-muted/50 z-10">
                  {strings.minor.adminHoursColEmployee}
                </th>

                {/* Subproject columns grouped by color */}
                {groups.map(({ color, items }) =>
                  items.map((sp, idx) => (
                    <th
                      key={sp.id}
                      className="text-center font-medium px-3 py-3 whitespace-nowrap"
                      style={{
                        borderTop: idx === 0 ? `3px solid ${color}` : undefined,
                        color,
                      }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="inline-block size-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {sp.name}
                      </div>
                    </th>
                  ))
                )}

                {/* Total column */}
                <th className="text-center font-medium px-3 py-3 whitespace-nowrap">
                  {strings.minor.adminHoursColTotal}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialEmployees.map((employee) => {
                const total = subprojects.reduce(
                  (sum, sp) => sum + (employee.hours[sp.id] ?? 0), 0
                );
                const isComplete = total >= employee.weekly_hours;

                return (
                  <tr key={employee.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium sticky left-0 bg-background whitespace-nowrap z-10">
                      {employee.name}
                      <span className="block text-xs text-muted-foreground font-normal">
                        {employee.email}
                      </span>
                    </td>

                    {/* Hours per subproject (sorted same as header) */}
                    {groups.flatMap(({ items }) =>
                      items.map((sp) => {
                        const h = employee.hours[sp.id] ?? 0;
                        return (
                          <td
                            key={sp.id}
                            className="px-3 py-3 text-center tabular-nums text-muted-foreground"
                          >
                            {h > 0 ? (h % 1 === 0 ? h : h.toFixed(1)) : "—"}
                          </td>
                        );
                      })
                    )}

                    <td className={cn(
                      "px-3 py-3 text-center font-semibold tabular-nums",
                      !isComplete && "text-red-500",
                      isComplete  && "text-emerald-600",
                    )}>
                      {total % 1 === 0 ? total : total.toFixed(1)}
                      {!isComplete && (
                        <span className="block text-[10px] font-normal">
                          / {employee.weekly_hours}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {initialEmployees.length > 0 && incompleteEmployees.length === 0 && (
        <p className="text-sm text-emerald-600">{strings.minor.adminHoursAllComplete}</p>
      )}
    </div>
  );
}
