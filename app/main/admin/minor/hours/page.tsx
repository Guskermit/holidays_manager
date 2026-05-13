import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BackNav } from "@/components/back-nav";
import { MinorHoursTable } from "@/components/admin/minor-hours-table";
import { strings } from "@/lib/strings";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the Monday of the week containing `date` as YYYY-MM-DD. */
function getMondayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MinorHoursAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: callerEmployee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!callerEmployee) redirect("/auth/login");
  if (callerEmployee.role !== "admin" && callerEmployee.role !== "super-admin") {
    redirect("/main");
  }

  // Verify admin is in a Minor project
  const { data: callerProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", callerEmployee.id);

  const callerProjectIds = (callerProjects ?? []).map((ep) => ep.project_id);

  let isMinorAdmin = false;
  if (callerProjectIds.length > 0) {
    const { data: minorProject } = await supabase
      .from("projects")
      .select("id_engagement")
      .in("id_engagement", callerProjectIds)
      .eq("is_minor", true)
      .maybeSingle();

    isMinorAdmin = !!minorProject;
  }

  if (!isMinorAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <p className="text-sm text-muted-foreground">{strings.minor.notMinorAdmin}</p>
      </div>
    );
  }

  // Determine the week to display
  const { week: weekParam } = await searchParams;
  const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? weekParam
    : getMondayIso(new Date());

  // Fetch active subprojects
  const { data: subprojects } = await supabase
    .from("minor_subprojects")
    .select("id, name, color")
    .eq("active", true)
    .order("name");

  const subprojectList = subprojects ?? [];

  // Fetch all employees assigned to any Minor project
  const { data: allMinorProjects } = await supabase
    .from("projects")
    .select("id_engagement")
    .eq("is_minor", true);

  const minorProjectIds = (allMinorProjects ?? []).map((p) => p.id_engagement);

  let employeesWithHours: {
    id: string;
    name: string;
    email: string;
    weekly_hours: number;
    hours: { [subprojectId: string]: number };
  }[] = [];

  if (minorProjectIds.length > 0) {
    // Get employees assigned to minor projects
    const { data: epRows } = await supabase
      .from("employee_projects")
      .select("employee_id")
      .in("project_id", minorProjectIds);

    const employeeIds = [...new Set((epRows ?? []).map((ep) => ep.employee_id))];

    if (employeeIds.length > 0) {
      // Fetch employee details
      const { data: employees } = await supabase
        .from("employees")
        .select("id, name, email, weekly_hours")
        .in("id", employeeIds)
        .order("name");

      // Fetch hours for those employees for the given week
      const { data: hoursRows } = await supabase
        .from("minor_hours")
        .select("employee_id, subproject_id, hours")
        .in("employee_id", employeeIds)
        .eq("week_start", weekStart);

      // Build a lookup: employee_id → subproject_id → hours
      const hoursLookup: Record<string, Record<string, number>> = {};
      for (const row of hoursRows ?? []) {
        if (!hoursLookup[row.employee_id]) hoursLookup[row.employee_id] = {};
        hoursLookup[row.employee_id][row.subproject_id] = Number(row.hours);
      }

      employeesWithHours = (employees ?? []).map((emp) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        weekly_hours: emp.weekly_hours ?? 42,
        hours: hoursLookup[emp.id] ?? {},
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.minor.adminHoursTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.minor.adminHoursSubtitle}</p>
      </div>

      <MinorHoursTable
        subprojects={subprojectList}
        employees={employeesWithHours}
        defaultWeekStart={weekStart}
      />
    </div>
  );
}
