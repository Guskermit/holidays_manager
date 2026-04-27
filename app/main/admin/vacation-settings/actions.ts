"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CATEGORIES } from "@/lib/categories";

export async function updateVacationSettings(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") return { error: "Not authorized" };

  for (const category of CATEGORIES) {
    const raw = formData.get(category) as string;
    const days = parseInt(raw, 10);
    if (isNaN(days) || days < 1) return { error: `Invalid value for ${category}` };

    const { error } = await supabase
      .from("category_vacation_days")
      .update({ vacation_days: days, updated_at: new Date().toISOString() })
      .eq("category", category);

    if (error) return { error: error.message };
  }

  revalidatePath("/main/admin/vacation-settings");
  return {};
}
