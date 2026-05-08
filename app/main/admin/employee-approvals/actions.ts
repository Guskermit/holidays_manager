"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getAdminSupabase() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return null;

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") return null;
  return supabase;
}

export async function approveEmployee(employeeId: string): Promise<{ error?: string }> {
  const supabase = await getAdminSupabase();
  if (!supabase) redirect("/main");

  const { error } = await supabase
    .from("employees")
    .update({ approved: true })
    .eq("id", employeeId);

  if (error) return { error: error.message };
  revalidatePath("/main/admin/employee-approvals");
  return {};
}

export async function rejectEmployee(employeeId: string): Promise<{ error?: string }> {
  const supabase = await getAdminSupabase();
  if (!supabase) redirect("/main");

  // Delete the employee row; the auth user remains but they will stay blocked.
  // An admin can clean up from the Supabase dashboard if needed.
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId);

  if (error) return { error: error.message };
  revalidatePath("/main/admin/employee-approvals");
  return {};
}
