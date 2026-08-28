import { createClient } from "@/lib/supabase/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { VacationRequestsTable } from "@/components/admin/vacation-requests-table";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function AdminVacationRequestsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") {
    redirect("/main");
  }

  // Fetch all vacation requests with employee + project info
  const { data: rawRequests, error: reqError } = await supabase
    .from("vacation_requests")
    .select(`
      id,
      start_date,
      end_date,
      days_requested,
      status,
      created_at,
      rejection_reason,
      is_bootcamp,
      is_medical_leave,
      is_other,
      other_reason,
      employees!vacation_requests_employee_id_fkey ( id, name, email )
    `)
        .order("start_date", { ascending: true });

  if (reqError) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <div>
          <h1 className="text-2xl font-bold">{strings.admin.requestsTitle}</h1>
          <p className="text-sm text-red-500 mt-2">
            {strings.admin.requestsError(reqError.message)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {strings.admin.requestsMigrationHint}
          </p>
        </div>
      </div>
    );
  }

  // For each employee, find their projects to enable project filter
  // Fetch all employee_projects + projects in one go
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select(`employee_id, projects ( id_engagement, name, color )`);

  // Build a map: employee_id → all projects
  const empProjectMap = new Map<string, { name: string; color: string | null }[]>();
  (empProjects ?? []).forEach((ep: any) => {
    const proj = ep.projects;
    if (proj) {
      const existing = empProjectMap.get(ep.employee_id) ?? [];
      existing.push({ name: proj.name, color: proj.color ?? null });
      empProjectMap.set(ep.employee_id, existing);
    }
  });

  const requests = (rawRequests ?? []).map((r: any) => {
    const empId = r.employees?.id ?? null;
    const projs = empId ? (empProjectMap.get(empId) ?? []) : [];
    return {
      ...r,
      employee_projects: projs,
      // Keep first project for backward compat display
      project_name: projs[0]?.name ?? null,
      project_color: projs[0]?.color ?? null,
    };
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.admin.requestsTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pendingCount > 0
            ? strings.admin.requestsCountPending(pendingCount)
            : strings.admin.requestsAllReviewed}
        </p>
      </div>

      <VacationRequestsTable requests={requests as any} />
    </div>
  );
}
