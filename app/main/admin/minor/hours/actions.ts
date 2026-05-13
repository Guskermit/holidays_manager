"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notifyMinorIncompleteHours } from "@/lib/slack";

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
