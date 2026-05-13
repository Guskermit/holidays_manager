"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getMinorAdmin() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) redirect("/auth/login");
  if (employee.role !== "admin" && employee.role !== "super-admin") {
    return { error: "Not authorized" as string, employee: null, supabase };
  }

  // Check that this admin is assigned to a Minor project
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
      return { error: "Not authorized: not a Minor project admin" as string, employee: null, supabase };
    }
  } else {
    return { error: "Not authorized: not assigned to any project" as string, employee: null, supabase };
  }

  return { error: null, employee, supabase };
}

// ── Server actions ────────────────────────────────────────────────────────────

export async function createSubproject(
  formData: FormData
): Promise<{ error?: string }> {
  const { error, supabase } = await getMinorAdmin();
  if (error) return { error };

  const name  = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string)?.trim() || "#6366f1";
  if (!name) return { error: "Name is required" };

  const { error: dbError } = await supabase!
    .from("minor_subprojects")
    .insert({ name, color });

  if (dbError) return { error: dbError.message };

  revalidatePath("/main/admin/minor");
  return {};
}

export async function updateSubproject(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { error, supabase } = await getMinorAdmin();
  if (error) return { error };

  const name   = (formData.get("name")   as string)?.trim();
  const active = formData.get("active") === "true";
  const color  = (formData.get("color")  as string)?.trim() || "#6366f1";

  if (!name) return { error: "Name is required" };

  const { error: dbError } = await supabase!
    .from("minor_subprojects")
    .update({ name, active, color, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return { error: dbError.message };

  revalidatePath("/main/admin/minor");
  return {};
}

export async function deleteSubproject(
  id: string
): Promise<{ error?: string }> {
  const { error, supabase } = await getMinorAdmin();
  if (error) return { error };

  const { error: dbError } = await supabase!
    .from("minor_subprojects")
    .delete()
    .eq("id", id);

  if (dbError) return { error: dbError.message };

  revalidatePath("/main/admin/minor");
  return {};
}
