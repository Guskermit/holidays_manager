import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function NewProjectPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") {
    redirect("/main");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, employee_projects(projects(id_engagement, name, color, end_date))")
    .order("name");

  const employeesWithProjects = (employees ?? []).map((emp: any) => ({
    id: emp.id as string,
    name: emp.name as string,
    email: emp.email as string,
    activeProjects: ((emp.employee_projects ?? []) as any[])
      .map((ep: any) => ep.projects)
      .filter((p: any) => p && (!p.end_date || new Date(p.end_date) >= today))
      .map((p: any) => ({ name: p.name as string, color: (p.color ?? "#6366f1") as string }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.projects.newTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.projects.newSubtitle}
        </p>
      </div>

      <ProjectForm employees={employeesWithProjects} />
    </div>
  );
}
