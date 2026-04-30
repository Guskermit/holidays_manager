/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSummaryTable } from "@/components/vacations/vacation-summary-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { getEffectiveEmployee } from "@/lib/impersonation";

function flattenEmployee(emp: any) {
  return {
    ...emp,
    specializations: (emp.employee_specializations ?? [])
      .map((es: any) => es.specializations?.name)
      .filter(Boolean) as string[],
  };
}

export default async function TeamVacationPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: realEmployee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  // Admins use the full admin overview
  if (realEmployee?.role === "admin" || realEmployee?.role === "super-admin") {
    redirect("/main/vacations/summary");
  }

  const { effectiveId } = await getEffectiveEmployee(supabase, {
    id: realEmployee?.id ?? "",
    role: realEmployee?.role ?? "employee",
  });

  const currentYear = new Date().getFullYear();

  // Get the current employee's project assignments
  const { data: myAssignments } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", effectiveId);

  const myProjectIds = (myAssignments ?? []).map((a: any) => a.project_id);

  if (myProjectIds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <div>
          <h1 className="text-2xl font-bold">{strings.vacations.teamTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{strings.vacations.teamSubtitle}</p>
        </div>
        <p className="text-sm text-muted-foreground">{strings.vacations.teamNoProjects}</p>
      </div>
    );
  }

  // Fetch projects + all their members, and colleague employee data in parallel
  const [projectsResult, allAssignmentsResult] = await Promise.all([
    supabase
      .from("projects")
      .select(`id_engagement, name, color, employee_projects ( employee_id )`)
      .in("id_engagement", myProjectIds)
      .order("name"),
    supabase
      .from("employee_projects")
      .select("employee_id")
      .in("project_id", myProjectIds),
  ]);

  const projects = projectsResult.data ?? [];
  const uniqueColleagueIds = [
    ...new Set((allAssignmentsResult.data ?? []).map((a: any) => a.employee_id)),
  ];

  const { data: rawEmployees } = await supabase
    .from("employees")
    .select(
      `id, name, office, category, employee_specializations ( specializations ( name ) ), vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status, days_requested, year )`
    )
    .in("id", uniqueColleagueIds)
    .order("name");

  const employees = (rawEmployees ?? []).map(flattenEmployee);
  const allEmployeeIds = employees.map((e: any) => e.id);

  const [balancesResult, categoryDaysResult] = await Promise.all([
    allEmployeeIds.length > 0
      ? supabase
          .from("vacation_balances")
          .select("employee_id, total_days")
          .eq("year", currentYear)
          .in("employee_id", allEmployeeIds)
      : { data: [] },
    supabase.from("category_vacation_days").select("category, vacation_days"),
  ]);

  const totalDaysMap = new Map<string, number>();
  for (const b of ((balancesResult as any).data ?? []) as any[]) {
    totalDaysMap.set(b.employee_id, b.total_days);
  }

  const categoryDaysMap = new Map<string, number>();
  for (const row of ((categoryDaysResult as any).data ?? []) as any[]) {
    categoryDaysMap.set(row.category, row.vacation_days);
  }

  const balances = new Map<string, { totalDays: number; usedDays: number; pendingDays: number }>();
  for (const emp of employees as any[]) {
    const total =
      totalDaysMap.get(emp.id) ??
      categoryDaysMap.get(emp.category ?? "") ??
      0;

    let usedDays = 0;
    let pendingDays = 0;
    for (const req of (emp.vacation_requests ?? []) as any[]) {
      if (req.year !== currentYear) continue;
      if (req.status === "approved") usedDays += req.days_requested ?? 0;
      else if (req.status === "pending") pendingDays += req.days_requested ?? 0;
    }
    balances.set(emp.id, { totalDays: total, usedDays, pendingDays });
  }

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.vacations.teamTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.vacations.teamSubtitle}</p>
      </div>

      <VacationSummaryTable
        employees={employees as any}
        projects={projects}
        balances={balances}
        year={currentYear}
      />
    </div>
  );
}
