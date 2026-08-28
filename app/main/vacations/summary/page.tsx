/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSummaryTable } from "@/components/vacations/vacation-summary-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { getAllOfficeHolidaysFromDB } from "@/lib/holidays";
import Link from "next/link";
import { BarChart2Icon } from "lucide-react";

function flattenEmployee(emp: any) {
  return {
    ...emp,
    specializations: (emp.employee_specializations ?? [])
      .map((es: any) => es.specializations?.name)
      .filter(Boolean) as string[],
  };
}

export default async function VacationSummaryPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  // Get current employee + role
  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") {
    redirect("/main");
  }

  const currentYear = new Date().getFullYear();

  let employees: any[] = [];
  let projects: any[] = [];
  let teams: any[] = [];

  const [empResult, projResult, teamsResult] = await Promise.all([
    supabase
      .from("employees")
      .select(`id, name, office, category, employee_specializations ( specializations ( name ) ), vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status, days_requested, year, is_bootcamp, is_medical_leave, is_other, other_reason )`)
      .or(`exit_date.is.null,exit_date.gt.${new Date().toISOString().split("T")[0]}`)
      .order("name"),
    supabase
      .from("projects")
      .select(`id_engagement, name, color, employee_projects ( employee_id, employee_project_teams ( team_id ) )`)
      .order("name"),
    supabase
      .from("project_teams")
      .select("id, name, project_id")
      .order("name"),
  ]);
  employees = (empResult.data ?? []).map(flattenEmployee);
  projects = projResult.data ?? [];
  teams = teamsResult.data ?? [];

  const holidaysByOffice = await getAllOfficeHolidaysFromDB(supabase);

  // Compute vacation balances from requests (reliable source of truth)
  // total_days: prefer vacation_balances row; fall back to category_vacation_days.
  const allEmployeeIds = employees.map((e: any) => e.id);

  const [balancesResult, categoryDaysResult] = await Promise.all([
    allEmployeeIds.length > 0
      ? supabase
          .from("vacation_balances")
          .select("employee_id, total_days")
          .eq("year", currentYear)
          .in("employee_id", allEmployeeIds)
      : { data: [] },
    supabase
      .from("category_vacation_days")
      .select("category, vacation_days"),
  ]);

  const totalDaysMap = new Map<string, number>();
  for (const b of ((balancesResult as any).data ?? []) as any[]) {
    totalDaysMap.set(b.employee_id, b.total_days);
  }

  // category → default days map
  const categoryDaysMap = new Map<string, number>();
  for (const row of ((categoryDaysResult as any).data ?? []) as any[]) {
    categoryDaysMap.set(row.category, row.vacation_days);
  }

  const balances = new Map<string, { totalDays: number; usedDays: number; pendingDays: number }>();
  for (const emp of employees as any[]) {
    // Use balance row if present, otherwise fall back to category default
    const total =
      totalDaysMap.get(emp.id) ??
      categoryDaysMap.get(emp.category ?? "") ??
      0;

    let usedDays = 0;
    let pendingDays = 0;
    for (const req of (emp.vacation_requests ?? []) as any[]) {
      if (req.year !== currentYear) continue;
      if (req.is_bootcamp || req.is_medical_leave || req.is_other) continue;
      if (req.status === "approved") usedDays += req.days_requested ?? 0;
      else if (req.status === "pending") pendingDays += req.days_requested ?? 0;
    }
    balances.set(emp.id, { totalDays: total, usedDays, pendingDays });
  }

  // Build teamAssignments record: `${employeeId}:${projectId}` → teamIds[]
  // Using a plain Record (not Map) for safe RSC serialization across server→client boundary.
  const teamAssignments: Record<string, string[]> = {};
  for (const proj of projects as any[]) {
    for (const ep of (proj.employee_projects ?? []) as any[]) {
      teamAssignments[`${ep.employee_id}:${proj.id_engagement}`] =
        (ep.employee_project_teams ?? []).map((item: { team_id: string }) => item.team_id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{strings.vacations.overviewTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {strings.vacations.overviewSubtitleAdmin}
          </p>
        </div>
        <Link
          href="/main/vacations/availability"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BarChart2Icon className="size-4" />
          {strings.vacations.availabilityLink}
        </Link>
      </div>

      <VacationSummaryTable
        employees={employees as any}
        projects={projects}
        balances={balances}
        year={currentYear}
        teams={teams}
        teamAssignments={teamAssignments}
        holidaysByOffice={holidaysByOffice}
      />
    </div>
  );
}
