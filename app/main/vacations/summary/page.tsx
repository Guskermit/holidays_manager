/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSummaryTable } from "@/components/vacations/vacation-summary-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

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

  const isAdmin = currentEmployee?.role === "admin";
  const currentYear = new Date().getFullYear();

  let employees: any[] = [];
  let projects: any[] = [];

  if (isAdmin) {
    // Admin: see all employees and all projects
    const [empResult, projResult] = await Promise.all([
      supabase
        .from("employees")
        .select(`id, name, office, category, employee_specializations ( specializations ( name ) ), vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status )`)
        .order("name"),
      supabase
        .from("projects")
        .select(`id_engagement, name, color, employee_projects ( employee_id )`)
        .order("name"),
    ]);
    employees = (empResult.data ?? []).map(flattenEmployee);
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
        .select(`id, name, office, category, employee_specializations ( specializations ( name ) ), vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status )`)
        .in("id", uniqueIds)
        .order("name");

      employees = (myEmployees ?? []).map(flattenEmployee);
      projects = myProjectsFull ?? [];
    }
  }

  // Fetch vacation balances for current year (RLS: admin sees all, employee sees own)
  const allEmployeeIds = employees.map((e: any) => e.id);
  const { data: balancesRaw } = allEmployeeIds.length > 0
    ? await supabase
        .from("vacation_balances")
        .select("employee_id, total_days, used_days, pending_days")
        .eq("year", currentYear)
        .in("employee_id", allEmployeeIds)
    : { data: [] };

  const balances = new Map<string, { totalDays: number; usedDays: number; pendingDays: number }>();
  for (const b of (balancesRaw ?? []) as any[]) {
    balances.set(b.employee_id, {
      totalDays: b.total_days,
      usedDays: b.used_days,
      pendingDays: b.pending_days,
    });
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
        balances={balances}
        year={currentYear}
      />
    </div>
  );
}
