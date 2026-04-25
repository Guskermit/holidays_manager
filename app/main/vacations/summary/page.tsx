import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSummaryTable } from "@/components/vacations/vacation-summary-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

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

  const isAdmin = currentEmployee?.role === "admin";

  let employees: any[] = [];
  let projects: any[] = [];

  if (isAdmin) {
    // Admin: see all employees and all projects
    const [empResult, projResult] = await Promise.all([
      supabase
        .from("employees")
        .select(`id, name, office, vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status )`)
        .order("name"),
      supabase
        .from("projects")
        .select(`id_engagement, name, color, employee_projects ( employee_id )`)
        .order("name"),
    ]);
    if (empResult.error) console.error("[summary] employees query error:", empResult.error.message, empResult.error.code, empResult.error.details, empResult.error.hint);
    if (projResult.error) console.error("[summary] projects query error:", projResult.error.message, projResult.error.code);
    employees = empResult.data ?? [];
    projects = projResult.data ?? [];
  } else {
    // Employee: only see projects they belong to and colleagues in those projects
    const { data: myProjects } = await supabase
      .from("projects")
      .select(`id_engagement, name, color, employee_projects ( employee_id )`)
      .filter("employee_projects.employee_id", "eq", currentEmployee?.id)
      .order("name");

    // Re-fetch projects with all members (not just self-filtered)
    const myProjectIds = (myProjects ?? []).map((p: any) => p.id_engagement);

    if (myProjectIds.length === 0) {
      employees = [];
      projects = [];
    } else {
      const [{ data: myProjectsFull }, colleagueIds] = await Promise.all([
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

      const uniqueIds = [...new Set((colleagueIds.data ?? []).map((r: any) => r.employee_id))];

      const { data: myEmployees } = await supabase
        .from("employees")
        .select(`id, name, office, vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status )`)
        .in("id", uniqueIds)
        .order("name");

      employees = myEmployees ?? [];
      projects = myProjectsFull ?? [];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.vacations.overviewTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? strings.vacations.overviewSubtitleAdmin
            : strings.vacations.overviewSubtitleUser}
        </p>
      </div>

      <VacationSummaryTable
        employees={employees as any}
        projects={projects}
      />
    </div>
  );
}
