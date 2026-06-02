"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const idEngagement = (formData.get("id_engagement") as string).trim();
  const name = (formData.get("name") as string).trim();
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const color = (formData.get("color") as string) || "#6366f1";
  const isMinor = formData.get("is_minor") === "true";
  const employeeIds = formData.getAll("employee_ids") as string[];

  // Upload icon if provided
  let iconUrl: string | null = null;
  const iconFile = formData.get("icon") as File | null;
  if (iconFile && iconFile.size > 0) {
    const ext = iconFile.name.split(".").pop();
    const path = `${idEngagement}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("project-icons")
      .upload(path, iconFile, { upsert: true });

    if (uploadError) {
      return { error: `Icon upload failed: ${uploadError.message}` };
    }

    iconUrl = supabase.storage.from("project-icons").getPublicUrl(path).data.publicUrl;
  }

  const { error: projectError } = await supabase.from("projects").insert({
    id_engagement: idEngagement,
    name,
    start_date: startDate,
    end_date: endDate,
    color,
    icon_url: iconUrl,
    is_minor: isMinor,
  });

  if (projectError) {
    return { error: projectError.message };
  }

  if (employeeIds.length > 0) {
    const assignments = employeeIds.map((employeeId) => ({
      employee_id: employeeId,
      project_id: idEngagement,
    }));

    const { error: assignError } = await supabase
      .from("employee_projects")
      .upsert(assignments, { onConflict: "employee_id,project_id", ignoreDuplicates: true });

    if (assignError) {
      return { error: assignError.message };
    }
  }

  redirect("/main/projects");
}

export async function updateProject(
  idEngagement: string,
  formData: FormData
) {
  const supabase = await createClient();

  const name = (formData.get("name") as string).trim();
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const color = (formData.get("color") as string) || "#6366f1";
  const isMinor = formData.get("is_minor") === "true";
  const employeeIds = formData.getAll("employee_ids") as string[];

  // Upload new icon if provided
  let iconUrl: string | null = (formData.get("existing_icon_url") as string) || null;
  const iconFile = formData.get("icon") as File | null;
  if (iconFile && iconFile.size > 0) {
    const ext = iconFile.name.split(".").pop();
    const path = `${idEngagement}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("project-icons")
      .upload(path, iconFile, { upsert: true });

    if (uploadError) {
      return { error: `Icon upload failed: ${uploadError.message}` };
    }

    iconUrl = supabase.storage.from("project-icons").getPublicUrl(path).data.publicUrl;
  }

  const { error: projectError } = await supabase
    .from("projects")
    .update({ name, start_date: startDate, end_date: endDate, color, icon_url: iconUrl, is_minor: isMinor })
    .eq("id_engagement", idEngagement);

  if (projectError) {
    return { error: projectError.message };
  }

  // Update employee assignments without wiping team assignments:
  // Only delete removed employees (CASCADE would destroy their employee_project_teams)
  // and insert newly added ones. Existing records are left untouched.
  const { data: currentAssignments, error: fetchError } = await supabase
    .from("employee_projects")
    .select("employee_id")
    .eq("project_id", idEngagement);

  if (fetchError) {
    return { error: fetchError.message };
  }

  const currentIds = new Set((currentAssignments ?? []).map((a) => a.employee_id));
  const newIds = new Set(employeeIds);

  const toRemove = [...currentIds].filter((id) => !newIds.has(id));
  const toAdd = [...newIds].filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("employee_projects")
      .delete()
      .eq("project_id", idEngagement)
      .in("employee_id", toRemove);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  if (toAdd.length > 0) {
    const assignments = toAdd.map((employeeId) => ({
      employee_id: employeeId,
      project_id: idEngagement,
    }));

    const { error: assignError } = await supabase
      .from("employee_projects")
      .insert(assignments);

    if (assignError) {
      return { error: assignError.message };
    }
  }

  redirect("/main/projects");
}

// ── Team CRUD ──────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { supabase: null, error: "Unauthorized" };
  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();
  if (emp?.role !== "admin" && emp?.role !== "super-admin") return { supabase: null, error: "Forbidden" };
  return { supabase, error: null };
}

export async function createTeam(projectId: string, name: string) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr, team: null };

  const { data, error } = await supabase
    .from("project_teams")
    .insert({ project_id: projectId, name: name.trim() })
    .select("id, name")
    .single();

  if (error) return { error: error.message, team: null };
  return { error: null, team: data as { id: string; name: string } };
}

export async function updateTeam(teamId: string, name: string) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const { error } = await supabase
    .from("project_teams")
    .update({ name: name.trim() })
    .eq("id", teamId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteTeam(teamId: string) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const { error } = await supabase
    .from("project_teams")
    .delete()
    .eq("id", teamId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function assignEmployeeTeam(
  employeeId: string,
  projectId: string,
  teamIds: string[]
) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const normalizedTeamIds = Array.from(new Set(teamIds.filter(Boolean)));

  // Ensure requested teams exist and belong to the project being edited.
  if (normalizedTeamIds.length > 0) {
    const { data: validTeams, error: validTeamsError } = await supabase
      .from("project_teams")
      .select("id")
      .eq("project_id", projectId)
      .in("id", normalizedTeamIds);

    if (validTeamsError) return { error: validTeamsError.message };
    if ((validTeams ?? []).length !== normalizedTeamIds.length) {
      return { error: "Algunos equipos no pertenecen al proyecto." };
    }
  }

  const { data: employeeProject, error: employeeProjectError } = await supabase
    .from("employee_projects")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("project_id", projectId)
    .single();

  if (employeeProjectError || !employeeProject) {
    return { error: employeeProjectError?.message ?? "No existe la asignación del empleado al proyecto." };
  }

  const { error: clearError } = await supabase
    .from("employee_project_teams")
    .delete()
    .eq("employee_project_id", employeeProject.id);

  if (clearError) return { error: clearError.message };

  if (normalizedTeamIds.length > 0) {
    const rows = normalizedTeamIds.map((teamId) => ({
      employee_project_id: employeeProject.id,
      team_id: teamId,
    }));

    const { error: insertError } = await supabase
      .from("employee_project_teams")
      .insert(rows);

    if (insertError) return { error: insertError.message };
  }

  // Keep legacy column synchronized while old reads still exist.
  const { error } = await supabase
    .from("employee_projects")
    .update({ team_id: normalizedTeamIds[0] ?? null })
    .eq("id", employeeProject.id);

  if (error) return { error: error.message };
  return { error: null };
}
