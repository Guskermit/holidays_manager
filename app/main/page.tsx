import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderKanbanIcon, CalendarDaysIcon, LayoutListIcon, CheckCircle2Icon, ClockIcon, SunIcon, UsersIcon, ClipboardListIcon, BrainIcon, SearchIcon, TrendingUpIcon, SettingsIcon, BarChart2Icon, BookOpenIcon, TimerIcon, CalendarIcon, BotIcon, BellIcon, BriefcaseIcon } from "lucide-react";
import { strings } from "@/lib/strings";
import { getEffectiveEmployee } from "@/lib/impersonation";
import { ImpersonationSelector } from "@/components/impersonation-selector";

/** Get Monday of the current week */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Format date as YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const currentYear = new Date().getFullYear();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("user_id", data.claims.sub)
    .single();

  // Resolve effective employee (impersonation support for super-admins)
  const { effectiveId, isImpersonating } = await getEffectiveEmployee(supabase, {
    id: employee?.id ?? "",
    role: employee?.role ?? "employee",
  });

  // Fetch effective employee's data (may be impersonated)
  const { data: effectiveEmployee } = effectiveId !== employee?.id
    ? await supabase.from("employees").select("id, name, role").eq("id", effectiveId).single()
    : { data: employee };

  const displayName = isImpersonating
    ? (effectiveEmployee?.name ?? "")
    : (employee?.name ?? data.claims.email ?? "there");

  const { data: balance } = effectiveId
    ? await supabase
        .from("vacation_balances")
        .select("total_days, used_days, pending_days")
        .eq("employee_id", effectiveId)
        .eq("year", currentYear)
        .single()
    : { data: null };

  const remaining = balance
    ? balance.total_days - balance.used_days - balance.pending_days
    : null;

  // For super-admin selector: fetch all employees
  const { data: allEmployees } = employee?.role === "super-admin"
    ? await supabase.from("employees").select("id, name, role").order("name")
    : { data: null };

  const isAdmin = effectiveEmployee?.role === "admin" || effectiveEmployee?.role === "super-admin";

  // ── Imputaciones for current & next week ──────────────────
  const now = new Date();
  const thisMonday = getMonday(now);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);

  const thisMondayStr = fmtDate(thisMonday);
  const nextSundayStr = fmtDate(nextSunday);

  type WeekImputacion = {
    engagement_name: string;
    engagement_code: string;
    weekly_hours: number;
  };

  const thisWeekImputaciones: WeekImputacion[] = [];
  const nextWeekImputaciones: WeekImputacion[] = [];

  if (effectiveId) {
    // Fetch all active imputaciones overlapping this+next week
    const { data: imps } = await supabase
      .from("employee_imputations")
      .select("engagement_id, start_date, end_date, weekly_hours, engagements(name, engagement_code)")
      .eq("employee_id", effectiveId)
      .lte("start_date", nextSundayStr)
      .or(`end_date.is.null,end_date.gte.${thisMondayStr}`);

    type ImpWithEngagement = {
      engagement_id: string;
      start_date: string;
      end_date: string | null;
      weekly_hours: number;
      engagements: { name: string; engagement_code: string } | null;
    };
    for (const imp of (imps ?? []) as ImpWithEngagement[]) {
      const eng = imp.engagements;
      if (!eng) continue;

      const impStart = imp.start_date as string;
      const impEnd = (imp.end_date as string | null) ?? "9999-12-31";

      // Check overlap with this week
      if (impStart <= fmtDate(new Date(thisMonday.getTime() + 6 * 86400000)) && impEnd >= thisMondayStr) {
        thisWeekImputaciones.push({
          engagement_name: eng.name,
          engagement_code: eng.engagement_code,
          weekly_hours: imp.weekly_hours,
        });
      }

      // Check overlap with next week
      const nextWeekEnd = new Date(nextMonday.getTime() + 6 * 86400000);
      if (impStart <= fmtDate(nextWeekEnd) && impEnd >= fmtDate(nextMonday)) {
        nextWeekImputaciones.push({
          engagement_name: eng.name,
          engagement_code: eng.engagement_code,
          weekly_hours: imp.weekly_hours,
        });
      }
    }
  }

  const { count: pendingApprovalsCount } = isAdmin
    ? await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("approved", false)
    : { count: null };

  // Check if the effective employee is in a Minor project
  const { data: effectiveProjects } = effectiveId
    ? await supabase
        .from("employee_projects")
        .select("project_id")
        .eq("employee_id", effectiveId)
    : { data: null };

  const effectiveProjectIds = (effectiveProjects ?? []).map((ep) => ep.project_id);

  let isMinorMember = false;
  let isMinorAdmin  = false;
  if (effectiveProjectIds.length > 0) {
    const { data: minorProject } = await supabase
      .from("projects")
      .select("id_engagement")
      .in("id_engagement", effectiveProjectIds)
      .eq("is_minor", true)
      .maybeSingle();

    isMinorMember = !!minorProject;
    isMinorAdmin  = isMinorMember && isAdmin;
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Super-admin impersonation selector */}
      {employee?.role === "super-admin" && allEmployees && (
        <ImpersonationSelector
          employees={allEmployees.filter((e) => e.id !== employee.id)}
          currentImpersonatedId={isImpersonating ? effectiveId : null}
        />
      )}

      {/* Hero */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {strings.dashboard.greeting(displayName.split(" ")[0])}
        </h1>
        <p className="text-muted-foreground">
          {strings.dashboard.subtitle}
        </p>
      </div>

      {/* Vacation summary */}
      {balance && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {strings.dashboard.vacationSectionTitle(currentYear)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{balance.used_days}</p>
                <p className="text-xs text-muted-foreground">{strings.dashboard.statDaysTaken}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <ClockIcon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{balance.pending_days}</p>
                <p className="text-xs text-muted-foreground">{strings.dashboard.statPending}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <SunIcon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{remaining}</p>
                <p className="text-xs text-muted-foreground">{strings.dashboard.statRemaining(balance.total_days)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Imputaciones de la semana ──────────────────────── */}
      {effectiveId && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BriefcaseIcon className="size-4" />
            {strings.imputaciones.weeklyTitle}
          </h2>
          {thisWeekImputaciones.length === 0 && nextWeekImputaciones.length === 0 ? (
            <div className="rounded-xl border p-4 bg-indigo-500/5">
              <p className="text-sm text-muted-foreground">{strings.imputaciones.noEngagementMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* This week */}
              <div className="rounded-xl border p-4 bg-indigo-500/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{strings.imputaciones.thisWeekLabel}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(thisMonday)} – {fmtDate(new Date(thisMonday.getTime() + 6 * 86400000))}
                  </span>
                </div>
                {thisWeekImputaciones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{strings.imputaciones.noHoursThisWeek}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {thisWeekImputaciones.map((imp) => (
                      <div key={imp.engagement_code} className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium">{imp.engagement_name}</span>
                        <span className="shrink-0 ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">{imp.weekly_hours}h</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs font-bold border-t pt-1.5 mt-1">
                      <span>{strings.imputaciones.totalLabel}</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{thisWeekImputaciones.reduce((s, i) => s + i.weekly_hours, 0)}h</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Next week */}
              <div className="rounded-xl border p-4 bg-indigo-500/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{strings.imputaciones.nextWeekLabel}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(nextMonday)} – {nextSundayStr}
                  </span>
                </div>
                {nextWeekImputaciones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{strings.imputaciones.noHoursThisWeek}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {nextWeekImputaciones.map((imp) => (
                      <div key={imp.engagement_code} className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium">{imp.engagement_name}</span>
                        <span className="shrink-0 ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">{imp.weekly_hours}h</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs font-bold border-t pt-1.5 mt-1">
                      <span>{strings.imputaciones.totalLabel}</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{nextWeekImputaciones.reduce((s, i) => s + i.weekly_hours, 0)}h</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vacaciones ──────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Vacaciones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/main/vacations"
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <CalendarDaysIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{strings.dashboard.cardVacations}</h2>
              <p className="text-sm text-muted-foreground">{strings.dashboard.cardVacationsDesc}</p>
            </div>
            <span className="text-sm text-teal-600 font-medium group-hover:underline">{strings.dashboard.cardVacationsLink}</span>
          </Link>

          <Link
            href={isAdmin ? "/main/vacations/summary" : "/main/vacations/team"}
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <LayoutListIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{isAdmin ? strings.dashboard.cardOverview : strings.dashboard.cardTeamOverview}</h2>
              <p className="text-sm text-muted-foreground">{isAdmin ? strings.dashboard.cardOverviewDesc : strings.dashboard.cardTeamOverviewDesc}</p>
            </div>
            <span className="text-sm text-teal-600 font-medium group-hover:underline">{strings.dashboard.cardOverviewLink}</span>
          </Link>

          {isAdmin && (
            <Link
              href="/main/admin/vacation-requests"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <ClipboardListIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.dashboard.cardRequests}</h2>
                <p className="text-sm text-muted-foreground">{strings.dashboard.cardRequestsDesc}</p>
              </div>
              <span className="text-sm text-teal-600 font-medium group-hover:underline">{strings.dashboard.cardRequestsLink}</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/main/vacations/availability"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <BarChart2Icon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.vacations.availabilityTitle}</h2>
                <p className="text-sm text-muted-foreground">{strings.vacations.availabilitySubtitle}</p>
              </div>
              <span className="text-sm text-teal-600 font-medium group-hover:underline">{strings.vacations.availabilityLink}</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Skills ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Skills
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/main/skills"
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-amber-500 transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <BrainIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{strings.skills.dashboardCard}</h2>
              <p className="text-sm text-muted-foreground">{strings.skills.dashboardCardDesc}</p>
            </div>
            <span className="text-sm text-amber-600 font-medium group-hover:underline">{strings.skills.dashboardCardLink}</span>
          </Link>

          <Link
            href="/main/copilot"
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-amber-500 transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <BotIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{strings.copilot.dashboardCard}</h2>
              <p className="text-sm text-muted-foreground">{strings.copilot.dashboardCardDesc}</p>
            </div>
            <span className="text-sm text-amber-600 font-medium group-hover:underline">{strings.copilot.dashboardCardLink}</span>
          </Link>

          {isAdmin && (
            <Link
              href="/main/admin/skills-search"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-amber-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <SearchIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.skills.searchDashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.skills.searchDashboardCardDesc}</p>
              </div>
              <span className="text-sm text-amber-600 font-medium group-hover:underline">{strings.skills.searchDashboardCardLink}</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Minor ───────────────────────────────────────── */}
      {isMinorMember && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Minor
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/main/minor"
              className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-orange-500 transition-colors"
            >
              <div className="flex items-center justify-center size-12 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <TimerIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.minor.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.minor.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-orange-600 font-medium group-hover:underline">{strings.minor.dashboardCardLink}</span>
            </Link>

            {isMinorAdmin && (
              <Link
                href="/main/admin/minor"
                className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-orange-500 transition-colors"
              >
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">{strings.dashboard.adminBadge}</span>
                <div className="flex items-center justify-center size-12 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <FolderKanbanIcon className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{strings.minor.adminDashboardCard}</h2>
                  <p className="text-sm text-muted-foreground">{strings.minor.adminDashboardCardDesc}</p>
                </div>
                <span className="text-sm text-orange-600 font-medium group-hover:underline">{strings.minor.adminDashboardCardLink}</span>
              </Link>
            )}

            {isMinorAdmin && (
              <Link
                href="/main/admin/minor/hours"
                className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-orange-500 transition-colors"
              >
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">{strings.dashboard.adminBadge}</span>
                <div className="flex items-center justify-center size-12 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <BarChart2Icon className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{strings.minor.adminHoursDashboardCard}</h2>
                  <p className="text-sm text-muted-foreground">{strings.minor.adminHoursDashboardCardDesc}</p>
                </div>
                <span className="text-sm text-orange-600 font-medium group-hover:underline">{strings.minor.adminHoursDashboardCardLink}</span>
              </Link>
            )}

            {isMinorAdmin && (
              <Link
                href="/main/admin/minor/monthly"
                className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-orange-500 transition-colors"
              >
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">{strings.dashboard.adminBadge}</span>
                <div className="flex items-center justify-center size-12 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <CalendarIcon className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{strings.minor.adminMonthlyDashboardCard}</h2>
                  <p className="text-sm text-muted-foreground">{strings.minor.adminMonthlyDashboardCardDesc}</p>
                </div>
                <span className="text-sm text-orange-600 font-medium group-hover:underline">{strings.minor.adminMonthlyDashboardCardLink}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Administración (admin only) ─────────────────── */}
      {isAdmin && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Administración
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/main/admin/employee-approvals"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              {(pendingApprovalsCount ?? 0) > 0 && (
                <span className="absolute top-3 left-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                  {pendingApprovalsCount}
                </span>
              )}
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <UsersIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.admin.approvalsTitle}</h2>
                <p className="text-sm text-muted-foreground">{strings.admin.approvalsSubtitle}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">Ver solicitudes →</span>
            </Link>

            <Link
              href="/main/projects"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <FolderKanbanIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.dashboard.cardProjects}</h2>
                <p className="text-sm text-muted-foreground">{strings.dashboard.cardProjectsDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.dashboard.cardProjectsLink}</span>
            </Link>

            <Link
              href="/main/employees"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <UsersIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.dashboard.cardEmployees}</h2>
                <p className="text-sm text-muted-foreground">{strings.dashboard.cardEmployeesDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.dashboard.cardEmployeesLink}</span>
            </Link>

            <Link
              href="/main/pricing"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <TrendingUpIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.pricing.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.pricing.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.pricing.dashboardCardLink}</span>
            </Link>

            <Link
              href="/main/admin/vacation-settings"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <SettingsIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.admin.vacationSettings.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.admin.vacationSettings.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.admin.vacationSettings.dashboardCardLink}</span>
            </Link>

            <Link
              href="/main/admin/holidays"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <CalendarIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.admin.holidays.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.admin.holidays.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.admin.holidays.dashboardCardLink}</span>
            </Link>

            <Link
              href="/main/admin/analytics"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <BarChart2Icon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Analytics</h2>
                <p className="text-sm text-muted-foreground">Gráficos de equipo, skills y vacaciones.</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">Ver analytics →</span>
            </Link>

            <Link
              href="/main/admin/skills"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <BookOpenIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.skills.adminPageTitle}</h2>
                <p className="text-sm text-muted-foreground">{strings.skills.adminPageSubtitle}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.skills.adminDashboardLink}</span>
            </Link>

            <Link
              href="/main/admin/copilot"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <BotIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.copilot.managerDashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.copilot.managerDashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.copilot.managerDashboardCardLink}</span>
            </Link>

            <Link
              href="/main/admin/notifications"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <BellIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.notifications.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.notifications.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.notifications.dashboardCardLink}</span>
            </Link>

            <Link
              href="/main/admin/imputaciones"
              className="group relative flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-violet-500 transition-colors"
            >
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{strings.dashboard.adminBadge}</span>
              <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <BriefcaseIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{strings.imputaciones.dashboardCard}</h2>
                <p className="text-sm text-muted-foreground">{strings.imputaciones.dashboardCardDesc}</p>
              </div>
              <span className="text-sm text-violet-600 font-medium group-hover:underline">{strings.imputaciones.dashboardCardLink}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
