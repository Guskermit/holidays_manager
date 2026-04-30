"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function startImpersonation(employeeId: string) {
  const supabase = await createClient();

  // Verify caller is super-admin
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const { data: caller } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (caller?.role !== "super-admin") return { error: "Not authorized" };

  // Verify target employee exists
  const { data: target } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .single();

  if (!target) return { error: "Employee not found" };

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, employeeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  redirect("/main");
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/main");
}
