"use client";

import { useState, useTransition } from "react";
import { startImpersonation, stopImpersonation } from "@/app/main/impersonation/actions";
import { UserCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Employee = { id: string; name: string; role: string };

type Props = {
  employees: Employee[];
  currentImpersonatedId: string | null;
};

export function ImpersonationSelector({ employees, currentImpersonatedId }: Props) {
  const [selectedId, setSelectedId] = useState(currentImpersonatedId ?? "");
  const [isPending, startTransition] = useTransition();

  const handleView = () => {
    if (!selectedId) return;
    startTransition(async () => {
      await startImpersonation(selectedId);
    });
  };

  const handleStop = () => {
    startTransition(async () => {
      await stopImpersonation();
    });
  };

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 shrink-0 text-amber-700 dark:text-amber-400">
        <UserCheckIcon className="size-4" />
        <span className="text-sm font-semibold">Vista como empleado</span>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
          className={cn(
            "flex-1 min-w-0 text-sm border rounded-lg px-3 py-1.5 bg-background",
            "focus:outline-none focus:ring-2 focus:ring-amber-400",
            "disabled:opacity-50"
          )}
        >
          <option value="">Selecciona un empleado…</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}{emp.role === "admin" ? " (admin)" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleView}
          disabled={!selectedId || isPending}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
        >
          Ver
        </button>

        {currentImpersonatedId && (
          <button
            type="button"
            onClick={handleStop}
            disabled={isPending}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-40 transition-colors shrink-0"
          >
            Mi cuenta
          </button>
        )}
      </div>
    </div>
  );
}
