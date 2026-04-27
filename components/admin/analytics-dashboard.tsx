"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AnalyticsData = {
  kpis: {
    totalEmployees: number;
    activeProjects: number;
    approvedDaysThisYear: number;
    pendingRequests: number;
  };
  categoryStats: { label: string; count: number }[];
  projectStats: { name: string; color: string; count: number }[];
  topSkills: { name: string; count: number }[];
  vacationByStatus: { status: string; label: string; count: number; days: number }[];
  monthlyApproved: { label: string; count: number }[];
  year: number;
};

const STATUS_COLORS: Record<string, string> = {
  approved: "#10b981",
  pending:  "#f59e0b",
  rejected: "#ef4444",
  cancelled:"#9ca3af",
};

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#14b8a6", "#f97316",
  "#84cc16", "#06b6d4",
];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-1 min-w-0">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function HBar({
  items,
  getColor,
  suffix = "",
}: {
  items: { label: string; count: number; color?: string }[];
  getColor?: (index: number) => string;
  suffix?: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const color = item.color ?? (getColor ? getColor(i) : PALETTE[i % PALETTE.length]);
        const pct = Math.round((item.count / max) * 100);
        return (
          <div key={`${item.label}-${i}`} className="flex items-center gap-2.5">
            <span
              className={cn(
                "text-xs text-muted-foreground shrink-0 truncate text-right",
                "w-32"
              )}
            >
              {item.label}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-medium w-10 shrink-0">
              {item.count}{suffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const {
    kpis,
    categoryStats,
    projectStats,
    topSkills,
    vacationByStatus,
    monthlyApproved,
    year,
  } = data;

  const activeVacStatus = vacationByStatus.filter((v) => v.count > 0);

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Empleados totales" value={kpis.totalEmployees} />
        <KpiCard label="Proyectos activos" value={kpis.activeProjects} />
        <KpiCard
          label="Días aprobados"
          value={kpis.approvedDaysThisYear}
          sub={`vacaciones ${year}`}
        />
        <KpiCard
          label="Solicitudes pendientes"
          value={kpis.pendingRequests}
          sub="esperando aprobación"
        />
      </div>

      {/* ── Row 1: Categoría + Top skills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Empleados por categoría">
          {categoryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <HBar
              items={categoryStats}
              getColor={(i) => PALETTE[i % PALETTE.length]}
            />
          )}
        </ChartCard>

        <ChartCard title="Top 10 skills">
          {topSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin skills registradas</p>
          ) : (
            <HBar
              items={topSkills.map((s) => ({ label: s.name, count: s.count }))}
              getColor={() => "#6366f1"}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Proyectos + Vacaciones por estado ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Empleados por proyecto activo">
          {projectStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin proyectos activos</p>
          ) : (
            <HBar
              items={projectStats.map((p) => ({
                label: p.name,
                count: p.count,
                color: p.color,
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title={`Solicitudes de vacaciones ${year}`}>
          {activeVacStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin solicitudes este año</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Por número de solicitudes</p>
                <HBar
                  items={activeVacStatus.map((v) => ({
                    label: v.label,
                    count: v.count,
                    color: STATUS_COLORS[v.status],
                  }))}
                />
              </div>
              {activeVacStatus.some((v) => v.days > 0) && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Por días solicitados</p>
                  <HBar
                    items={activeVacStatus
                      .filter((v) => v.days > 0)
                      .map((v) => ({
                        label: v.label,
                        count: v.days,
                        color: STATUS_COLORS[v.status],
                      }))}
                    suffix=" d"
                  />
                </div>
              )}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: Distribución mensual ── */}
      <ChartCard title={`Distribución mensual de vacaciones aprobadas ${year}`}>
        {monthlyApproved.every((m) => m.count === 0) ? (
          <p className="text-sm text-muted-foreground">Sin vacaciones aprobadas este año</p>
        ) : (
          <HBar
            items={monthlyApproved}
            getColor={() => "#10b981"}
            suffix=" sol"
          />
        )}
      </ChartCard>
    </div>
  );
}
