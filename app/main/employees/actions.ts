"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CATEGORY_DAYS, CATEGORIES, type Category } from "@/lib/categories";

export async function updateEmployee(
  employeeId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  // Verify caller is admin
  const { data: caller } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (caller?.role !== "admin") {
    return { error: "Not authorized" };
  }

  const name        = (formData.get("name")         as string)?.trim();
  const office      = (formData.get("office")       as string)?.trim();
  const role        = (formData.get("role")         as string)?.trim();
  const category    = (formData.get("category")     as string)?.trim();
  const company     = (formData.get("company")      as string | null)?.trim() || null;
  const costRaw     = (formData.get("cost_per_hour") as string)?.trim();
  const costPerHour = costRaw !== "" && costRaw != null ? parseFloat(costRaw) : null;

  if (!name || !office || !role || !category) {
    return { error: "All fields are required" };
  }

  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Invalid category" };
  }

  if (category === "Externo" && !company) {
    return { error: "Company is required for external employees" };
  }

  const { error } = await supabase
    .from("employees")
    .update({
      name,
      office,
      role,
      category,
      company: category === "Externo" ? company : null,
      cost_per_hour: costPerHour,
    })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  // Update vacation balance total_days for current year based on new category
  const maxDays = CATEGORY_DAYS[category as Category];
  const currentYear = new Date().getFullYear();
  await supabase
    .from("vacation_balances")
    .upsert(
      { employee_id: employeeId, year: currentYear, total_days: maxDays },
      { onConflict: "employee_id,year", ignoreDuplicates: false }
    );

  redirect("/main/employees");
}
