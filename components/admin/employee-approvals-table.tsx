"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { OFFICE_LABELS, type Office } from "@/lib/holidays";
import { approveEmployee, rejectEmployee } from "@/app/main/admin/employee-approvals/actions";
import { cn } from "@/lib/utils";

type PendingEmployee = {
  id: string;
  name: string;
  email: string;
  category: string;
  office: string;
  company: string | null;
  created_at: string;
};

export function EmployeeApprovalsTable({
  employees,
}: {
  employees: PendingEmployee[];
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setProcessingId(id);
    setActionError(null);
    startTransition(async () => {
      const result = await approveEmployee(id);
      if (result?.error) setActionError(result.error);
      setProcessingId(null);
    });
  }

  function handleReject(id: string) {
    if (!confirm("¿Seguro que quieres rechazar esta cuenta? El empleado no podrá acceder.")) return;
    setProcessingId(id);
    setActionError(null);
    startTransition(async () => {
      const result = await rejectEmployee(id);
      if (result?.error) setActionError(result.error);
      setProcessingId(null);
    });
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay cuentas pendientes de aprobación.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError && (
        <p className="text-sm text-red-500">{actionError}</p>
      )}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oficina</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Solicitud</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const isProcessing = isPending && processingId === emp.id;
              return (
                <tr key={emp.id} className={cn("border-t", isProcessing && "opacity-50")}>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3">
                    {CATEGORY_LABELS[emp.category as Category] ?? emp.category}
                    {emp.company && (
                      <span className="ml-1 text-xs text-muted-foreground">({emp.company})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {OFFICE_LABELS[emp.office as Office] ?? emp.office}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(emp.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApprove(emp.id)}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleReject(emp.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                      >
                        Rechazar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
