"use client";

import React, { useState, useMemo, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckIcon, XIcon, ChevronDownIcon } from "lucide-react";
import { approveVacationRequest, rejectVacationRequest } from "@/app/main/admin/vacation-requests/actions";
import { strings } from "@/lib/strings";

type Status = "pending" | "approved" | "rejected" | "cancelled";

type Request = {
  id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: Status;
  created_at: string;
  rejection_reason: string | null;
  employees: { id: string; name: string; email: string } | null;
  project_name: string | null;
  project_color: string | null;
};

type Props = {
  requests: Request[];
};

const STATUS_BADGE: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: strings.admin.statusPending,   variant: "outline" },
  approved:  { label: strings.admin.statusApproved,  variant: "default" },
  rejected:  { label: strings.admin.statusRejected,  variant: "destructive" },
  cancelled: { label: strings.admin.statusCancelled, variant: "secondary" },
};

const STATUS_FILTERS: { value: "all" | Status; label: string }[] = [
  { value: "all",       label: strings.admin.filterAll },
  { value: "pending",   label: strings.admin.filterPending },
  { value: "approved",  label: strings.admin.filterApproved },
  { value: "rejected",  label: strings.admin.filterRejected },
];

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

export function VacationRequestsTable({ requests }: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("pending");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Per-row reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Derive unique projects from requests
  const projects = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    requests.forEach((r) => {
      if (r.project_name) map.set(r.project_name, { name: r.project_name, color: r.project_color });
    });
    return [...map.entries()].map(([key, val]) => ({ key, ...val }));
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (projectFilter !== "all" && r.project_name !== projectFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.employees?.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, projectFilter, search]);

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approveVacationRequest(id);
      if (res.error) setActionError((prev) => ({ ...prev, [id]: res.error! }));
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      const res = await rejectVacationRequest(id, rejectReason);
      if (res.error) {
        setActionError((prev) => ({ ...prev, [id]: res.error! }));
      } else {
        setRejectingId(null);
        setRejectReason("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filters ── */}
      <div className="flex flex-col gap-4">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm border transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({requests.filter((r) => r.status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Employee search */}
          <Input
            placeholder={strings.admin.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          {/* Project filter */}
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">{strings.admin.projectFilterLabel}</span>
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
                  {strings.admin.filterAll}
              </button>
              {projects.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setProjectFilter(p.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
                    projectFilter === p.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-accent"
                  )}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color ?? "#6366f1" }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{strings.admin.tableEmpty}</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3">{strings.admin.colEmployee}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colProject}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colFrom}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colTo}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colDays}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colRequested}</th>
                <th className="text-left font-medium px-4 py-3">{strings.admin.colStatus}</th>
                <th className="text-left font-medium px-4 py-3 w-48">{strings.admin.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((req) => {
                const isRejecting = rejectingId === req.id;
                const err = actionError[req.id];
                return (
                  <React.Fragment key={req.id}>
                    <tr
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isRejecting && "bg-muted/20"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{req.employees?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{req.employees?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {req.project_name ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: req.project_color ?? "#6366f1" }}
                            />
                            {req.project_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(req.start_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(req.end_date)}</td>
                      <td className="px-4 py-3 font-medium">{req.days_requested}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt(req.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[req.status].variant}>
                          {STATUS_BADGE[req.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
                              disabled={isPending}
                              onClick={() => handleApprove(req.id)}
                            >
                              <CheckIcon className="size-3.5 mr-1" />
                              {strings.admin.approveButton}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                              disabled={isPending}
                              onClick={() =>
                                isRejecting
                                  ? (setRejectingId(null), setRejectReason(""))
                                  : (setRejectingId(req.id), setRejectReason(""))
                              }
                            >
                              <XIcon className="size-3.5 mr-1" />
                              {isRejecting ? strings.admin.rejectCancelButton : strings.admin.rejectButton}
                            </Button>
                          </div>
                        )}
                        {req.status === "rejected" && req.rejection_reason && (
                          <span className="text-xs text-muted-foreground italic">
                            {req.rejection_reason}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Inline reject reason row */}
                    {isRejecting && (
                      <tr key={`${req.id}-reject`} className="bg-red-50/40 dark:bg-red-950/20">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center gap-3 max-w-xl">
                            <Input
                              placeholder={strings.admin.rejectPlaceholder}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="flex-1"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isPending}
                              onClick={() => handleReject(req.id)}
                            >
                              {strings.admin.confirmRejectButton}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Error row */}
                    {err && (
                      <tr key={`${req.id}-err`}>
                        <td colSpan={8} className="px-4 py-2">
                          <p className="text-xs text-red-500">{err}</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
