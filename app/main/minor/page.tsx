import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BackNav } from "@/components/back-nav";
import { MinorHoursForm } from "@/components/minor/hours-form";
import { strings } from "@/lib/strings";
import { getEffectiveEmployee } from "@/lib/impersonation";

function getMondayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MinorHoursPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: realEmployee } = await supabase
    .from("employees")
    .select("id, role, weekly_hours")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!realEmployee) redirect("/auth/login");

  const { effectiveId } = await getEffectiveEmployee(supabase, {
    id: realEmployee.id,
    role: realEmployee.role ?? "employee",
  });

  // Get the effective employee's data
  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, weekly_hours")
    .eq("id", effectiveId)
    .single();

  if (!employee) redirect("/main");

  // Verify the employee is assigned to a Minor project
  const { data: employeeProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", effectiveId);

  const projectIds = (employeeProjects ?? []).map((ep) => ep.project_id);

  let isMinorMember = false;
  if (projectIds.length > 0) {
    const { data: minorProject } = await supabase
      .from("projects")
      .select("id_engagement")
      .in("id_engagement", projectIds)
      .eq("is_minor", true)
      .maybeSingle();

    isMinorMember = !!minorProject;
  }

  if (!isMinorMember) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <p className="text-sm text-muted-foreground">{strings.minor.notMinorMember}</p>
      </div>
    );
  }

  // Fetch active subprojects
  const { data: subprojects } = await supabase
    .from("minor_subprojects")
    .select("id, name, color")
    .eq("active", true)
    .order("name");

  // Determine current month range (fetch a 3-month window so the client
  // can navigate without extra round-trips — we'll pass all available hours)
  const today    = new Date();
  const minYear  = today.getFullYear();
  const minMonth = today.getMonth() - 1; // one month back
  const maxMonth = today.getMonth() + 1; // one month forward

  // Build the date range to fetch
  const rangeStart = new Date(minYear, minMonth, 1);
  const rangeEnd   = new Date(minYear, maxMonth + 1, 0); // last day of maxMonth

  const { data: hours } = await supabase
    .from("minor_hours")
    .select("subproject_id, week_start, hours")
    .eq("employee_id", effectiveId)
    .gte("week_start", rangeStart.toISOString().slice(0, 10))
    .lte("week_start", rangeEnd.toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.minor.pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.minor.pageSubtitle}</p>
      </div>

      <MinorHoursForm
        subprojects={subprojects ?? []}
        weeklyHours={employee.weekly_hours ?? 42}
        initialHours={(hours ?? []).map((h) => ({
          subproject_id: h.subproject_id,
          week_start: h.week_start,
          hours: Number(h.hours),
        }))}
        defaultWeekStart={getMondayIso(today)}
      />
    </div>
  );
}
