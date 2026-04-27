"use client";

import { useState, useTransition } from "react";
import { sendStaleSkillsNotifications } from "@/app/main/admin/analytics/actions";

export function StaleSkillsNotifier() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    notified?: number;
    error?: string;
    employees?: { name: string; daysSinceUpdate: number | null }[];
  } | null>(null);

  function handleSend() {
    startTransition(async () => {
      const res = await sendStaleSkillsNotifications();
      setResult({
        notified: res.notified,
        error: res.error,
        employees: res.staleEmployees?.map((e) => ({
          name: e.name,
          daysSinceUpdate: e.daysSinceUpdate,
        })),
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Enviando…" : "Enviar recordatorios de skills"}
        </button>
        {result && !result.error && (
          <span className="text-sm text-muted-foreground">
            {result.notified === 0
              ? "✅ Todos los empleados tienen los skills al día."
              : `✅ Notificación enviada — ${result.notified} empleado${result.notified !== 1 ? "s" : ""} con skills desactualizados.`}
          </span>
        )}
        {result?.error && (
          <span className="text-sm text-destructive">{result.error}</span>
        )}
      </div>
      {result && result.employees && result.employees.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
          {result.employees.map((e, i) => (
            <li key={i}>
              • {e.name} —{" "}
              {e.daysSinceUpdate === null
                ? "nunca ha actualizado sus skills"
                : `sin actualizar hace ${e.daysSinceUpdate} días`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
