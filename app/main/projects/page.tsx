import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, PencilIcon } from "lucide-react";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function ProjectsPage() {
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

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      `
      id_engagement,
      name,
      start_date,
      end_date,
      color,
      icon_url,
      employee_projects (
        employee_id,
        employees ( name )
      )
    `
    )
    .order("start_date", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-500">
        {strings.projects.errorLoading(error.message)}
      </p>
    );
  }

  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const isActive = (endDate: string | null) =>
    !endDate || new Date(endDate) >= new Date();

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{strings.projects.listTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {strings.projects.listCount(projects?.length ?? 0)}
          </p>
        </div>
        <Button asChild>
          <Link href="/main/projects/new">
            <PlusIcon className="size-4" />
            {strings.projects.newButton}
          </Link>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3 w-12"></th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colId}</th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colName}</th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colStart}</th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colEnd}</th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colStatus}</th>
                <th className="text-left font-medium px-4 py-3">{strings.projects.colEmployees}</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr
                  key={project.id_engagement}
                  className="hover:bg-muted/30"
                  style={{ borderLeft: `3px solid ${project.color ?? "#6366f1"}` }}
                >
                  <td className="px-4 py-3">
                    <div
                      className="size-8 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: project.color ?? "#6366f1" }}
                    >
                      {project.icon_url ? (
                        <img
                          src={project.icon_url}
                          alt={project.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span>{project.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {project.id_engagement}
                  </td>
                  <td className="px-4 py-3 font-medium">{project.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(project.start_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(project.end_date)}
                  </td>
                  <td className="px-4 py-3">
                    {isActive(project.end_date) ? (
                      <Badge variant="default">{strings.projects.badgeActive}</Badge>
                    ) : (
                      <Badge variant="secondary">{strings.projects.badgeFinished}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project.employee_projects.length > 0 ? (
                      <span className="text-muted-foreground">
                        {strings.projects.employeeCount(project.employee_projects.length)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/main/projects/${project.id_engagement}/edit`}>
                        <PencilIcon className="size-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 gap-3 text-center">
          <p className="text-muted-foreground text-sm">{strings.projects.emptyState}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/main/projects/new">
              <PlusIcon className="size-4" />
              {strings.projects.emptyCreate}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
