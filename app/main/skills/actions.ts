"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PREDEFINED_SPECIALIZATIONS } from "@/lib/categories";

async function getEmployeeId(supabase: Awaited<ReturnType<typeof createClient>>, sub: string) {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", sub)
    .single();
  return data?.id ?? null;
}

// ── Skills ────────────────────────────────────────────────────────────────────

/**
 * Add a skill to the global pool (if new) and assign it to the current
 * employee at level 1. Returns the real skill ID.
 */
export async function addSkill(name: string): Promise<{ skillId?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Skill name cannot be empty" };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const employeeId = await getEmployeeId(supabase, authData.claims.sub);
  if (!employeeId) return { error: "Employee profile not found" };

  let skillId: string;
  const { data: existing } = await supabase
    .from("skills")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    skillId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("skills")
      .insert({ name: trimmed })
      .select("id")
      .single();
    if (insertErr || !inserted) return { error: insertErr?.message ?? "Failed to create skill" };
    skillId = inserted.id;
  }

  const { error: linkErr } = await supabase
    .from("employee_skills")
    .upsert(
      { employee_id: employeeId, skill_id: skillId, level: 1 },
      { onConflict: "employee_id,skill_id", ignoreDuplicates: true }
    );

  if (linkErr) return { error: linkErr.message };

  revalidatePath("/main/skills");
  return { skillId };
}

/** Update the expertise level (0-3) of a skill already assigned to the current employee. */
export async function updateSkillLevel(
  skillId: string,
  level: number
): Promise<{ error?: string }> {
  if (level < 0 || level > 3) return { error: "Invalid level" };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const employeeId = await getEmployeeId(supabase, authData.claims.sub);
  if (!employeeId) return { error: "Employee profile not found" };

  const { error } = await supabase
    .from("employee_skills")
    .update({ level })
    .eq("employee_id", employeeId)
    .eq("skill_id", skillId);

  if (error) return { error: error.message };

  revalidatePath("/main/skills");
  return {};
}

/** Remove a skill from the current employee's profile. */
export async function removeSkill(skillId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const employeeId = await getEmployeeId(supabase, authData.claims.sub);
  if (!employeeId) return { error: "Employee profile not found" };

  const { error } = await supabase
    .from("employee_skills")
    .delete()
    .eq("employee_id", employeeId)
    .eq("skill_id", skillId);

  if (error) return { error: error.message };

  revalidatePath("/main/skills");
  return {};
}

// ── Specializations ───────────────────────────────────────────────────────────

/**
 * Add a specialization to the global pool (if new) and assign it to the
 * current employee. Returns the real specialization ID.
 */
export async function addSpecialization(
  name: string
): Promise<{ specializationId?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Specialization name cannot be empty" };
  if (!(PREDEFINED_SPECIALIZATIONS as readonly string[]).includes(trimmed))
    return { error: "Invalid specialization" };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const employeeId = await getEmployeeId(supabase, authData.claims.sub);
  if (!employeeId) return { error: "Employee profile not found" };

  let specializationId: string;
  const { data: existing } = await supabase
    .from("specializations")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    specializationId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("specializations")
      .insert({ name: trimmed })
      .select("id")
      .single();
    if (insertErr || !inserted)
      return { error: insertErr?.message ?? "Failed to create specialization" };
    specializationId = inserted.id;
  }

  const { error: linkErr } = await supabase
    .from("employee_specializations")
    .upsert(
      { employee_id: employeeId, specialization_id: specializationId },
      { onConflict: "employee_id,specialization_id", ignoreDuplicates: true }
    );

  if (linkErr) return { error: linkErr.message };

  revalidatePath("/main/skills");
  return { specializationId };
}

/** Remove a specialization from the current employee's profile. */
export async function removeSpecialization(
  specializationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const employeeId = await getEmployeeId(supabase, authData.claims.sub);
  if (!employeeId) return { error: "Employee profile not found" };

  const { error } = await supabase
    .from("employee_specializations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("specialization_id", specializationId);

  if (error) return { error: error.message };

  revalidatePath("/main/skills");
  return {};
}

