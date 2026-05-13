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
        is_minor,
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
    isMinor: (project as { is_minor?: boolean }).is_minor ?? false,
    assignedEmployeeIds: project.employee_projects.map(
      (ep: { employee_id: string }) => ep.employee_id
    ),
  };

  type ProjectRef = { id_engagement: string; name: string; color: string | null; end_date: string | null };
  type EmpRow = {
    id: string;
    name: string;
    email: string;
    employee_projects: { projects: ProjectRef | ProjectRef[] | null }[];
  };

  const employeesWithProjects = ((employees ?? []) as unknown as EmpRow[]).map((emp) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    activeProjects: (emp.employee_projects ?? [])
      .flatMap((ep) => (Array.isArray(ep.projects) ? ep.projects : ep.projects ? [ep.projects] : []))
      .filter(
        (p): p is ProjectRef =>
          p !== null &&
          p.id_engagement !== id &&
          (!p.end_date || new Date(p.end_date) >= today)
      )
      .map((p) => ({ name: p.name, color: p.color ?? "#6366f1" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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
