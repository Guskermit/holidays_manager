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
      .insert(assignments);

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
    .update({ name, start_date: startDate, end_date: endDate, color, icon_url: iconUrl })
    .eq("id_engagement", idEngagement);

  if (projectError) {
    return { error: projectError.message };
  }

  // Replace employee assignments: delete all then re-insert
  const { error: deleteError } = await supabase
    .from("employee_projects")
    .delete()
    .eq("project_id", idEngagement);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (employeeIds.length > 0) {
    const assignments = employeeIds.map((employeeId) => ({
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
