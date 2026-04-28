"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SKILL_CATEGORIES } from "@/lib/categories";

async function getAdminClient() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return null;
  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();
  if (emp?.role !== "admin") return null;
  return supabase;
}

export async function createSkill(
  name: string,
  category: string
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Skill name cannot be empty" };
  if (!(SKILL_CATEGORIES as readonly string[]).includes(category))
    return { error: "Invalid category" };

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Not authorized" };

  const { error } = await supabase
    .from("skills")
    .insert({ name: trimmed, category });

  if (error) {
    if (error.code === "23505") return { error: "A skill with that name already exists in this category" };
    return { error: error.message };
  }

  revalidatePath("/main/admin/skills");
  revalidatePath("/main/skills");
  return {};
}

export async function deleteSkill(skillId: string): Promise<{ error?: string }> {
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Not authorized" };

  const { error } = await supabase
    .from("skills")
    .delete()
    .eq("id", skillId);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/skills");
  revalidatePath("/main/skills");
  return {};
}
