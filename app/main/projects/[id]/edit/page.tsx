export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { BackNav } from "@/components/back-nav";

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

  if (emp?.role !== "admin") {
    redirect("/main");
  }

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
    supabase.from("employees").select("id, name, email").order("name"),
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

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">Edit project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update the details for{" "}
          <span className="font-medium text-foreground">{project.name}</span>.
        </p>
      </div>

      <ProjectForm employees={employees ?? []} initialValues={initialValues} />
    </div>
  );
}
