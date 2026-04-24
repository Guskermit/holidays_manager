import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VacationRequestsTable } from "@/components/admin/vacation-requests-table";
import { BackNav } from "@/components/back-nav";

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

  if (currentEmployee?.role !== "admin") {
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
      employees!vacation_requests_employee_id_fkey ( id, name, email )
    `)
    .order("created_at", { ascending: false });

  if (reqError) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <div>
          <h1 className="text-2xl font-bold">Vacation requests</h1>
          <p className="text-sm text-red-500 mt-2">
            Error loading requests: <code>{reqError.message}</code>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Make sure migrations 000006, 000007 and 000008 have been applied in Supabase.
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

  // Build a map: employee_id → first project (or null)
  const empProjectMap = new Map<string, { name: string; color: string | null }>();
  (empProjects ?? []).forEach((ep: any) => {
    const proj = ep.projects;
    if (proj && !empProjectMap.has(ep.employee_id)) {
      empProjectMap.set(ep.employee_id, { name: proj.name, color: proj.color ?? null });
    }
  });

  const requests = (rawRequests ?? []).map((r: any) => {
    const empId = r.employees?.id ?? null;
    const proj = empId ? empProjectMap.get(empId) : null;
    return {
      ...r,
      project_name: proj?.name ?? null,
      project_color: proj?.color ?? null,
    };
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">Vacation requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pendingCount > 0
            ? `${pendingCount} request${pendingCount !== 1 ? "s" : ""} pending approval.`
            : "All requests have been reviewed."}
        </p>
      </div>

      <VacationRequestsTable requests={requests as any} />
    </div>
  );
}
