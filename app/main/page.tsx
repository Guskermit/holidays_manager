import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderKanbanIcon, CalendarDaysIcon, LayoutListIcon, CheckCircle2Icon, ClockIcon, SunIcon, UsersIcon, ClipboardListIcon, BrainIcon, SearchIcon } from "lucide-react";
import { strings } from "@/lib/strings";

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

  const displayName = employee?.name ?? data.claims.email ?? "there";

  const { data: balance } = employee
    ? await supabase
        .from("vacation_balances")
        .select("total_days, used_days, pending_days")
        .eq("employee_id", employee.id)
        .eq("year", currentYear)
        .single()
    : { data: null };

  const remaining = balance
    ? balance.total_days - balance.used_days - balance.pending_days
    : null;

  return (
    <div className="flex flex-col gap-10">
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

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {employee?.role === "admin" && (
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
              <p className="text-sm text-muted-foreground">
                {strings.dashboard.cardProjectsDesc}
              </p>
            </div>
            <span className="text-sm text-violet-600 font-medium group-hover:underline">
              {strings.dashboard.cardProjectsLink}
            </span>
          </Link>
        )}

        {employee?.role === "admin" && (
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
              <p className="text-sm text-muted-foreground">
                {strings.dashboard.cardEmployeesDesc}
              </p>
            </div>
            <span className="text-sm text-violet-600 font-medium group-hover:underline">
              {strings.dashboard.cardEmployeesLink}
            </span>
          </Link>
        )}

        {employee?.role === "admin" && (
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
              <p className="text-sm text-muted-foreground">
                {strings.dashboard.cardRequestsDesc}
              </p>
            </div>
            <span className="text-sm text-teal-600 font-medium group-hover:underline">
              {strings.dashboard.cardRequestsLink}
            </span>
          </Link>
        )}

        <Link
          href="/main/vacations"
          className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
        >
          <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
            <CalendarDaysIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{strings.dashboard.cardVacations}</h2>
              <p className="text-sm text-muted-foreground">
                {strings.dashboard.cardVacationsDesc}
            </p>
          </div>
          <span className="text-sm text-teal-600 font-medium group-hover:underline">
              {strings.dashboard.cardVacationsLink}
          </span>
        </Link>

        <Link
          href="/main/vacations/summary"
          className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-teal-500 transition-colors"
        >
          <div className="flex items-center justify-center size-12 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
            <LayoutListIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{strings.dashboard.cardOverview}</h2>
              <p className="text-sm text-muted-foreground">
                {strings.dashboard.cardOverviewDesc}
            </p>
          </div>
          <span className="text-sm text-teal-600 font-medium group-hover:underline">
              {strings.dashboard.cardOverviewLink}
          </span>
        </Link>

        <Link
          href="/main/skills"
          className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-amber-500 transition-colors"
        >
          <div className="flex items-center justify-center size-12 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <BrainIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{strings.skills.dashboardCard}</h2>
            <p className="text-sm text-muted-foreground">
              {strings.skills.dashboardCardDesc}
            </p>
          </div>
          <span className="text-sm text-amber-600 font-medium group-hover:underline">
            {strings.skills.dashboardCardLink}
          </span>
        </Link>

        {employee?.role === "admin" && (
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
              <p className="text-sm text-muted-foreground">
                {strings.skills.searchDashboardCardDesc}
              </p>
            </div>
            <span className="text-sm text-amber-600 font-medium group-hover:underline">
              {strings.skills.searchDashboardCardLink}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
