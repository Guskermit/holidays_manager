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

  if (emp?.role !== "admin" && emp?.role !== "super-admin") return { error: "Not authorized" };

  const currentYear = new Date().getFullYear();

  for (const category of CATEGORIES) {
    const raw = formData.get(category) as string;
    const days = parseInt(raw, 10);
    if (isNaN(days) || days < 0) return { error: `Invalid value for ${category}` };

    const { error } = await supabase
      .from("category_vacation_days")
      .update({ vacation_days: days, updated_at: new Date().toISOString() })
      .eq("category", category);

    if (error) return { error: error.message };

    // Propagate the new total_days to all existing vacation_balances for this year
    const { data: affectedEmployees } = await supabase
      .from("employees")
      .select("id")
      .eq("category", category);

    if (affectedEmployees && affectedEmployees.length > 0) {
      const ids = affectedEmployees.map((e) => e.id);
      await supabase
        .from("vacation_balances")
        .update({ total_days: days })
        .eq("year", currentYear)
        .in("employee_id", ids);
    }
  }

  revalidatePath("/main/admin/vacation-settings");
  return {};
}
