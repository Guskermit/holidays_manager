"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SkillAnalysisItem = {
  name: string;
  count: number;
  avgLevel: number;
  levels: [number, number, number, number];
};

export type CategoryAnalysis = {
  category: string;
  employeeCount: number;
  avgLevel: number;
  totalSkillsInDB: number;
  skills: SkillAnalysisItem[];
};

export type AnalyticsData = {
  kpis: {
    totalEmployees: number;
    activeProjects: number;
    approvedDaysThisYear: number;
    pendingRequests: number;
  };
  categoryStats: { label: string; count: number }[];
  projectStats: { name: string; color: string; count: number }[];
  projectCategoryStats: {
    projectName: string;
    color: string;
    categories: { category: string; label: string; count: number }[];
  }[];
  projectEmployeesByCategory: {
    projectName: string;
    color: string;
    categories: { category: string; label: string; employees: string[] }[];
  }[];
  employeesWithoutProject: { name: string; category: string; label: string }[];
  topSkills: { name: string; count: number }[];
  vacationByStatus: { status: string; label: string; count: number; days: number }[];
  monthlyApproved: { label: string; count: number }[];
  year: number;
  skillsAnalysis: {
    byCategory: CategoryAnalysis[];
    uncoveredSkills: { name: string; category: string }[];
    totalWithSkills: number;
  };
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

const CATEGORY_COLORS: Record<string, string> = {
  Externo:          "#ef4444", // rojo
  Intern:           "#16a34a", // verde (Becario)
  Staff:            "#60a5fa", // azul claro
  Senior:           "#f97316", // naranja
  Manager:          "#374151", // gris oscuro
  "Senior-Manager": "#1d4ed8", // azul fuerte
  Socio:            "#6b7280", // gris
};

/** Pyramid order used to render categories from base to top */
const CATEGORY_ORDER: string[] = [
  "Externo",
  "Intern",
  "Staff",
  "Senior",
  "Manager",
  "Senior-Manager",
  "Socio",
];

function sortByCategoryOrder<T extends { category: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib);
  });
}

const LEVEL_STYLES = [
  { bg: "bg-zinc-400 dark:bg-zinc-500", text: "text-white", color: "#9ca3af" },
  { bg: "bg-amber-500",                text: "text-white", color: "#f59e0b" },
  { bg: "bg-blue-500",                 text: "text-white", color: "#3b82f6" },
  { bg: "bg-emerald-500",              text: "text-white", color: "#10b981" },
] as const;

function avgLevelColor(avg: number): string {
  if (avg < 0.5) return "#9ca3af";
  if (avg < 1.5) return "#f59e0b";
  if (avg < 2.5) return "#3b82f6";
  return "#10b981";
}

function avgLevelBadgeClass(avg: number): string {
  if (avg < 0.5) return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  if (avg < 1.5) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  if (avg < 2.5) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
}

function SkillsAnalysisSection({
  byCategory,
  uncoveredSkills,
  totalEmployees,
}: {
  byCategory: CategoryAnalysis[];
  uncoveredSkills: { name: string; category: string }[];
  totalEmployees: number;
}) {
  const [selectedCat, setSelectedCat] = useState(byCategory[0]?.category ?? "");

  const catData = byCategory.find((c) => c.category === selectedCat);

  const uncoveredByCategory = new Map<string, string[]>();
  for (const s of uncoveredSkills) {
    if (!uncoveredByCategory.has(s.category)) uncoveredByCategory.set(s.category, []);
    uncoveredByCategory.get(s.category)!.push(s.name);
  }

  if (byCategory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin skills registradas por los empleados.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Category strength cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {byCategory.map((cat) => {
          const coveragePct =
            totalEmployees > 0 ? Math.round((cat.employeeCount / totalEmployees) * 100) : 0;
          return (
            <button
              key={cat.category}
              type="button"
              onClick={() => setSelectedCat(cat.category)}
              className={cn(
                "rounded-lg border bg-card p-4 flex flex-col gap-3 text-left transition-all",
                selectedCat === cat.category
                  ? "border-primary ring-1 ring-primary/20"
                  : "hover:border-primary/40"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-semibold leading-snug">{cat.category}</p>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                    avgLevelBadgeClass(cat.avgLevel)
                  )}
                >
                  Ø{cat.avgLevel.toFixed(1)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{cat.employeeCount} emp.</span>
                  <span>{coveragePct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${coveragePct}%`,
                      backgroundColor: avgLevelColor(cat.avgLevel),
                    }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {cat.skills.length}/{cat.totalSkillsInDB} skills
              </p>
            </button>
          );
        })}
      </div>

      {/* Skill detail for selected category */}
      {catData && (
        <ChartCard title={`Detalle · ${catData.category}`}>
          {catData.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún empleado ha registrado skills de esta categoría.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* legend */}
              <div className="flex items-center gap-3 flex-wrap">
                {LEVEL_STYLES.map((ls, lvl) => (
                  <span key={lvl} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn("size-4 rounded inline-flex items-center justify-center text-[9px] font-bold", ls.bg, ls.text)}>
                      {lvl}
                    </span>
                    Nivel {lvl}
                  </span>
                ))}
              </div>
              {/* rows */}
              <div className="flex flex-col gap-2">
                {catData.skills.map((skill) => {
                  const maxCount = Math.max(...catData.skills.map((s) => s.count), 1);
                  const barPct = Math.round((skill.count / maxCount) * 100);
                  return (
                    <div
                      key={skill.name}
                      className="grid items-center gap-x-3 gap-y-0.5"
                      style={{ gridTemplateColumns: "1fr 1fr auto" }}
                    >
                      {/* name */}
                      <span className="text-xs font-medium truncate" title={skill.name}>
                        {skill.name}
                      </span>
                      {/* bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: avgLevelColor(skill.avgLevel),
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold w-6 shrink-0">{skill.count}</span>
                      </div>
                      {/* level pills */}
                      <div className="flex gap-0.5 justify-end">
                        {skill.levels.map((cnt, lvl) =>
                          cnt > 0 ? (
                            <span
                              key={lvl}
                              title={`Nivel ${lvl}: ${cnt} empleados`}
                              className={cn(
                                "inline-flex items-center justify-center rounded text-[9px] font-bold min-w-[16px] h-4 px-0.5",
                                LEVEL_STYLES[lvl].bg,
                                LEVEL_STYLES[lvl].text
                              )}
                            >
                              {cnt}
                            </span>
                          ) : (
                            <span
                              key={lvl}
                              className="inline-flex items-center justify-center rounded min-w-[16px] h-4 bg-muted text-muted-foreground/30 text-[9px]"
                            >
                              ·
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ChartCard>
      )}

      {/* Uncovered skills */}
      {uncoveredSkills.length > 0 && (
        <ChartCard title="Skills sin cobertura">
          <p className="text-xs text-muted-foreground -mt-2 mb-1">
            Ningún empleado ha registrado estas skills. Considera formarlas o incorporar perfiles que las dominen.
          </p>
          <div className="flex flex-col gap-4">
            {[...uncoveredByCategory.entries()].map(([cat, names]) => (
              <div key={cat} className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {cat}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 text-xs rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

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

function ProjectCategoryChart({
  items,
}: {
  items: { projectName: string; color: string; categories: { category: string; label: string; count: number }[] }[];
}) {
  const allCatsRaw = [...new Set(items.flatMap((p) => p.categories.map((c) => c.category)))];
  const allCats = allCatsRaw.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib);
  });
  const labelOf = new Map(items.flatMap((p) => p.categories.map((c) => [c.category, c.label])));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin proyectos activos</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {allCats.map((cat, i) => {
          const color = CATEGORY_COLORS[cat] ?? PALETTE[i % PALETTE.length];
          return (
            <span key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {labelOf.get(cat) ?? cat}
            </span>
          );
        })}
      </div>
      {/* Rows */}
      <div className="flex flex-col gap-3">
        {(() => {
          const maxTotal = Math.max(
            ...items.map((p) => p.categories.reduce((s, c) => s + c.count, 0)),
            1
          );
          return items.map((project) => {
            const total = project.categories.reduce((s, c) => s + c.count, 0);
            const orderedCategories = sortByCategoryOrder(project.categories);
            const widthPct = (total / maxTotal) * 100;
            return (
              <div key={project.projectName} className="flex items-center gap-2.5">
                <span
                  className="w-32 text-xs text-muted-foreground shrink-0 truncate text-right"
                  title={project.projectName}
                >
                  {project.projectName}
                </span>
                <div className="flex-1 h-5">
                  <div
                    className="flex rounded-full overflow-hidden h-5 bg-muted"
                    style={{ width: `${widthPct}%` }}
                  >
                    {orderedCategories.map((c) => {
                      const color = CATEGORY_COLORS[c.category] ?? PALETTE[allCats.indexOf(c.category) % PALETTE.length];
                      const pct = total > 0 ? (c.count / total) * 100 : 0;
                      return (
                        <div
                          key={c.category}
                          title={`${c.label}: ${c.count}`}
                          className="flex items-center justify-center text-[10px] font-bold text-white leading-none overflow-hidden"
                          style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 3 : 0 }}
                        >
                          {c.count > 0 ? c.count : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <span className="text-xs font-medium w-6 shrink-0 text-right">{total}</span>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

function ProjectEmployeeTable({
  items,
}: {
  items: { projectName: string; color: string; categories: { category: string; label: string; employees: string[] }[] }[];
}) {
  const [openProjects, setOpenProjects] = useState<Set<string>>(() => new Set(items.map((p) => p.projectName)));

  function toggle(name: string) {
    setOpenProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin proyectos activos con empleados asignados</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((project) => {
        const total = project.categories.reduce((s, c) => s + c.employees.length, 0);
        const isOpen = openProjects.has(project.projectName);
        return (
          <div key={project.projectName} className="rounded-lg border bg-card overflow-hidden">
            {/* Project header */}
            <button
              type="button"
              onClick={() => toggle(project.projectName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <span
                className="inline-block size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="font-semibold text-sm flex-1">{project.projectName}</span>
              <span className="text-xs text-muted-foreground mr-2">{total} empleado{total !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {/* Table */}
            {isOpen && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">Categoría</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empleados</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12">#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.categories.map((cat) => (
                      <tr key={cat.category} className="border-t border-muted/60">
                        <td className="px-4 py-2.5 align-top">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                          >
                            <span
                              className="inline-block size-2 rounded-full shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[cat.category] ?? "#9ca3af" }}
                            />
                            {cat.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {cat.employees.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground align-top">
                          {cat.employees.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
    projectCategoryStats,
    projectEmployeesByCategory,
    employeesWithoutProject,
    topSkills,
    vacationByStatus,
    monthlyApproved,
    year,
    skillsAnalysis,
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

      {/* ── Row 3: Categorías por proyecto ── */}
      <ChartCard title="Empleados por categoría en proyectos activos">
        <ProjectCategoryChart items={projectCategoryStats} />
      </ChartCard>

      {/* ── Row 3b: Tabla de empleados por proyecto y categoría ── */}
      <ChartCard title="Empleados por proyecto y categoría">
        <p className="text-xs text-muted-foreground -mt-2 mb-1">
          Listado de empleados asignados a cada proyecto activo, agrupados por categoría.
        </p>
        <ProjectEmployeeTable items={projectEmployeesByCategory} />
      </ChartCard>

      {/* ── Row 3c: Empleados sin proyecto ── */}
      <ChartCard title={`Empleados sin proyecto activo (${employeesWithoutProject.length})`}>
        {employeesWithoutProject.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los empleados están asignados a al menos un proyecto activo.</p>
        ) : (
          (() => {
            const grouped = new Map<string, { label: string; employees: string[] }>();
            for (const emp of employeesWithoutProject) {
              if (!grouped.has(emp.category)) grouped.set(emp.category, { label: emp.label, employees: [] });
              grouped.get(emp.category)!.employees.push(emp.name);
            }
            return (
              <div className="flex flex-col gap-4">
                {[...grouped.entries()].map(([cat, { label, employees }]) => (
                  <div key={cat} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#9ca3af" }}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">({employees.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {employees.map((name) => (
                        <span
                          key={name}
                          className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </ChartCard>

      {/* ── Row 4: Distribución mensual ── */}
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

      {/* ── Row 5: Advanced skills analysis ── */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Análisis de skills del equipo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fortalezas tecnológicas y gaps de cobertura · {skillsAnalysis.totalWithSkills} empleados con skills registradas
          </p>
        </div>
        <SkillsAnalysisSection
          byCategory={skillsAnalysis.byCategory}
          uncoveredSkills={skillsAnalysis.uncoveredSkills}
          totalEmployees={kpis.totalEmployees}
        />
      </div>
    </div>
  );
}
