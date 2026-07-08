/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityTable } from "@/components/vacations/availability-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { getAllOfficeHolidaysFromDB } from "@/lib/holidays";

function flattenEmployee(emp: any) {
  return {
    ...emp,
    specializations: (emp.employee_specializations ?? [])
      .map((es: any) => es.specializations?.name)
      .filter(Boolean) as string[],
  };
}

export default async function AvailabilityPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") {
    redirect("/main");
  }

  let employees: any[] = [];
  let projects: any[] = [];
  let teams: any[]    = [];

  const [empResult, projResult, teamsResult] = await Promise.all([
    supabase
      .from("employees")
      .select(`
        id, name, office, category,
        employee_specializations ( specializations ( name ) ),
        vacation_requests!vacation_requests_employee_id_fkey ( id, start_date, end_date, status, is_bootcamp, is_medical_leave )
      `)
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
  projects  = projResult.data  ?? [];
  teams     = teamsResult.data ?? [];

  const holidaysByOffice = await getAllOfficeHolidaysFromDB(supabase);

  // Build teamAssignments: `${employeeId}:${projectId}` → teamIds[]
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
      <div>
        <h1 className="text-2xl font-bold">{strings.vacations.availabilityTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.vacations.availabilitySubtitle}
        </p>
      </div>

      <AvailabilityTable
        employees={employees as any}
        projects={projects}
        teams={teams}
        teamAssignments={teamAssignments}
        holidaysByOffice={holidaysByOffice}
      />
    </div>
  );
}
