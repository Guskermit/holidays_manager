"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const name   = (formData.get("name")   as string)?.trim();
  const office = (formData.get("office") as string)?.trim();
  const role   = (formData.get("role")   as string)?.trim();

  if (!name || !office || !role) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase
    .from("employees")
    .update({ name, office, role })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  redirect("/main/employees");
}
