export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderKanbanIcon, CalendarDaysIcon, LayoutListIcon, CheckCircle2Icon, ClockIcon, SunIcon, UsersIcon, ClipboardListIcon } from "lucide-react";

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
          Welcome back, {displayName.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground">
          What would you like to manage today?
        </p>
      </div>

      {/* Vacation summary */}
      {balance && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            My vacations · {currentYear}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{balance.used_days}</p>
                <p className="text-xs text-muted-foreground">Days taken</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <ClockIcon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{balance.pending_days}</p>
                <p className="text-xs text-muted-foreground">Pending approval</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border p-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <SunIcon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{remaining}</p>
                <p className="text-xs text-muted-foreground">Remaining of {balance.total_days}</p>
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
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FolderKanbanIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Projects</h2>
              <p className="text-sm text-muted-foreground">
                View and manage all engagement projects, their dates and assigned team members.
              </p>
            </div>
            <span className="text-sm text-primary font-medium group-hover:underline">
              Go to Projects →
            </span>
          </Link>
        )}

        {employee?.role === "admin" && (
          <Link
            href="/main/employees"
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <UsersIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Employees</h2>
              <p className="text-sm text-muted-foreground">
                View the full employee list and edit their details, office and role.
              </p>
            </div>
            <span className="text-sm text-primary font-medium group-hover:underline">
              Go to Employees →
            </span>
          </Link>
        )}

        {employee?.role === "admin" && (
          <Link
            href="/main/admin/vacation-requests"
            className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <ClipboardListIcon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Vacation requests</h2>
              <p className="text-sm text-muted-foreground">
                Review, approve or reject team vacation requests and notify employees by email.
              </p>
            </div>
            <span className="text-sm text-primary font-medium group-hover:underline">
              Go to Requests →
            </span>
          </Link>
        )}

        <Link
          href="/main/vacations"
          className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <CalendarDaysIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Vacations</h2>
            <p className="text-sm text-muted-foreground">
              Request vacation days, track your balance and review the status of your requests.
            </p>
          </div>
          <span className="text-sm text-primary font-medium group-hover:underline">
            Go to Vacations →
          </span>
        </Link>

        <Link
          href="/main/vacations/summary"
          className="group flex flex-col gap-4 rounded-xl border p-6 hover:bg-accent hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <LayoutListIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Vacation overview</h2>
            <p className="text-sm text-muted-foreground">
              Monthly calendar view of the whole team's vacations, filterable by project.
            </p>
          </div>
          <span className="text-sm text-primary font-medium group-hover:underline">
            Go to Overview →
          </span>
        </Link>
      </div>
    </div>
  );
}
