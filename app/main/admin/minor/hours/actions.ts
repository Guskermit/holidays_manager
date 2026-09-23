"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notifyMinorIncompleteHours } from "@/lib/slack";

type MonthlyEmployeeHours = {
  id: string;
  name: string;
  email: string;
  weekly_hours: number;
  hours: { [subprojectId: string]: number };
  exit_date: string | null;
  weeksInMonth: number;
};

/**
 * Returns aggregated monthly hours for all Minor employees.
 * The month is derived from the provided weekStart (the Monday of any week in the target month).
 */
export async function getMonthlyMinorHours(weekStart: string): Promise<{
  data?: MonthlyEmployeeHours[];
  error?: string;
}> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated" };

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Not found" };
  if (employee.role !== "admin" && employee.role !== "super-admin") {
    return { error: "Not authorized" };
  }

  // Derive month range from weekStart
  const [y, m] = weekStart.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Count how many Mondays fall in this month (for the weekly_hours target)
  const weeksInMonth = (() => {
    let count = 0;
    const d = new Date(y, m - 1, 1);
    while (d.getMonth() === m - 1) {
      if (d.getDay() === 1) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  // Fetch active subprojects
  const { data: subprojects } = await supabase
    .from("minor_subprojects")
    .select("id")
    .eq("active", true);

  const subprojectIds = (subprojects ?? []).map((sp) => sp.id);
  if (subprojectIds.length === 0) return { data: [] };

  // Fetch employees in Minor projects
  const { data: allMinorProjects } = await supabase
    .from("projects")
    .select("id_engagement")
    .eq("is_minor", true);

  const minorProjectIds = (allMinorProjects ?? []).map((p) => p.id_engagement);
  if (minorProjectIds.length === 0) return { data: [] };

  const { data: epRows } = await supabase
    .from("employee_projects")
    .select("employee_id")
    .in("project_id", minorProjectIds);

  const employeeIds = [...new Set((epRows ?? []).map((ep) => ep.employee_id))];
  if (employeeIds.length === 0) return { data: [] };

  // Fetch employee details
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, weekly_hours, exit_date")
    .in("id", employeeIds)
    .order("name");

  // Fetch all hours for the month
  const PAGE_SIZE = 1000;
  let offset = 0;
  let allHours: { employee_id: string; subproject_id: string; hours: number }[] = [];
  while (true) {
    const { data: page } = await supabase
      .from("minor_hours")
      .select("employee_id, subproject_id, hours")
      .in("employee_id", employeeIds)
      .gte("week_start", monthStart)
      .lte("week_start", monthEnd)
      .range(offset, offset + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    allHours = allHours.concat(page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Aggregate hours by employee + subproject
  const hoursLookup: Record<string, Record<string, number>> = {};
  for (const row of allHours) {
    if (!hoursLookup[row.employee_id]) hoursLookup[row.employee_id] = {};
    hoursLookup[row.employee_id][row.subproject_id] =
      (hoursLookup[row.employee_id][row.subproject_id] ?? 0) + Number(row.hours);
  }

  const result: MonthlyEmployeeHours[] = (employees ?? []).map((emp) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    weekly_hours: emp.weekly_hours ?? 42,
    hours: hoursLookup[emp.id] ?? {},
    exit_date: emp.exit_date ?? null,
    weeksInMonth,
  }));

  return { data: result };
}

/**
 * Sends a Slack notification listing employees who haven't completed
 * their Minor hours for the given week.
 */
export async function notifyIncompleteMinorHours(params: {
  weekStart: string;
  incompleteEmployees: {
    name: string;
    email: string;
    hoursLogged: number;
    hoursTarget: number;
  }[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Not found" };
  if (employee.role !== "admin" && employee.role !== "super-admin") {
    return { error: "Not authorized" };
  }

  // Verify admin is in a minor project
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

    if (!minorProject) return { error: "Not a Minor project admin" };
  } else {
    return { error: "Not assigned to any project" };
  }

  await notifyMinorIncompleteHours(params);
  return {};
}
