/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { CopilotProjectsTable } from "@/components/admin/copilot-projects-table";

type ProjectCopilotGroup = {
  idEngagement: string;
  name: string;
  employees: {
    id: string;
    name: string;
    email: string;
    hasCopilot: boolean;
    engagement: string | null;
  }[];
};

export default async function AdminCopilotPage() {
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

  const { data: projectsData } = await supabase
    .from("projects")
    .select(`
      id_engagement,
      name,
      employee_projects (
        employee_id,
        employees (
          id,
          name,
          email,
          has_copilot,
          copilot_engagement
        )
      )
    `)
    .order("name", { ascending: true });

  const projects: ProjectCopilotGroup[] = (projectsData ?? [])
    .map((project: any) => {
      const employees = (project.employee_projects ?? [])
        .map((ep: any) => ep.employees)
        .filter(Boolean)
        .map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          hasCopilot: Boolean(emp.has_copilot),
          engagement: emp.copilot_engagement ?? null,
        }));

      return {
        idEngagement: project.id_engagement,
        name: project.name,
        employees,
      };
    })
    .filter((project) => project.employees.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.copilot.managerPageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.copilot.managerPageSubtitle}</p>
      </div>

      <CopilotProjectsTable projects={projects} />
    </div>
  );
}
