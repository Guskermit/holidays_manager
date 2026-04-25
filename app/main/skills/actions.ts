"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Add a skill to the global pool (if new) and assign it to the current employee. */
export async function addSkill(name: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Skill name cannot be empty" };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  // Resolve current employee id
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee profile not found" };

  // Find existing skill (case-insensitive) or insert a new one
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

  // Assign to employee (ignore if already assigned)
  const { error: linkErr } = await supabase
    .from("employee_skills")
    .upsert(
      { employee_id: employee.id, skill_id: skillId },
      { onConflict: "employee_id,skill_id", ignoreDuplicates: true }
    );

  if (linkErr) return { error: linkErr.message };

  revalidatePath("/main/skills");
  return {};
}

/** Remove a skill from the current employee's profile. */
export async function removeSkill(skillId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee profile not found" };

  const { error } = await supabase
    .from("employee_skills")
    .delete()
    .eq("employee_id", employee.id)
    .eq("skill_id", skillId);

  if (error) return { error: error.message };

  revalidatePath("/main/skills");
  return {};
}
