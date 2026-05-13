import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackNav } from "@/components/back-nav";
import { MinorSubprojectsManager } from "@/components/admin/minor-subprojects-manager";
import { strings } from "@/lib/strings";
import { BarChart2Icon } from "lucide-react";

export default async function MinorAdminPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) redirect("/auth/login");
  if (employee.role !== "admin" && employee.role !== "super-admin") redirect("/main");

  // Verify this admin is assigned to a Minor project
  const { data: employeeProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", employee.id);

  const projectIds = (employeeProjects ?? []).map((ep) => ep.project_id);

  if (projectIds.length > 0) {
    const { data: minorProject } = await supabase
      .from("projects")
      .select("id_engagement")
      .in("id_engagement", projectIds)
      .eq("is_minor", true)
      .maybeSingle();

    if (!minorProject) {
      return (
        <div className="flex flex-col gap-6">
          <BackNav />
          <p className="text-sm text-muted-foreground">{strings.minor.notMinorAdmin}</p>
        </div>
      );
    }
  } else {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <p className="text-sm text-muted-foreground">{strings.minor.notMinorAdmin}</p>
      </div>
    );
  }

  const { data: subprojects } = await supabase
    .from("minor_subprojects")
    .select("id, name, active, color")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{strings.minor.adminSubprojectsTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{strings.minor.adminSubprojectsSubtitle}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/main/admin/minor/hours">
            <BarChart2Icon className="size-4 mr-1.5" />
            {strings.minor.adminHoursDashboardCardLink}
          </Link>
        </Button>
      </div>

      <MinorSubprojectsManager subprojects={subprojects ?? []} />
    </div>
  );
}
