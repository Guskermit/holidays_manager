import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [{ data: project }, { data: employees }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        id_engagement,
        name,
        start_date,
        end_date,
        color,
        icon_url,
        employee_projects ( employee_id )
      `
      )
      .eq("id_engagement", id)
      .single(),
    supabase
      .from("employees")
      .select("id, name, email, employee_projects(projects(id_engagement, name, color, end_date))")
      .order("name"),
  ]);

  if (!project) notFound();

  const initialValues = {
    idEngagement: project.id_engagement,
    name: project.name,
    startDate: project.start_date,
    endDate: project.end_date ?? "",
    color: project.color ?? "#6366f1",
    iconUrl: project.icon_url ?? null,
    assignedEmployeeIds: project.employee_projects.map(
      (ep: { employee_id: string }) => ep.employee_id
    ),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeesWithProjects = ((employees ?? []) as any[]).map((emp: any) => ({
    id: emp.id as string,
    name: emp.name as string,
    email: emp.email as string,
    activeProjects: ((emp.employee_projects ?? []) as any[])
      .map((ep: any) => ep.projects)
      .filter(
        (p: any) =>
          p &&
          p.id_engagement !== id &&
          (!p.end_date || new Date(p.end_date) >= today)
      )
      .map((p: any) => ({ name: p.name as string, color: (p.color ?? "#6366f1") as string }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.projects.editTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.projects.editSubtitle(project.name)}
        </p>
      </div>

      <ProjectForm employees={employeesWithProjects} initialValues={initialValues} />
    </div>
  );
}
