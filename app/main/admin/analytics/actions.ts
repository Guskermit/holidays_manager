"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyStaleSkills } from "@/lib/slack";

const STALE_DAYS = 365;

export type StaleSkillsResult = {
  error?: string;
  notified?: number;
  staleEmployees?: { name: string; email: string; daysSinceUpdate: number | null }[];
};

export async function sendStaleSkillsNotifications(): Promise<StaleSkillsResult> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin") return { error: "Not authorized" };

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, name, email, skills_updated_at")
    .order("name");

  if (empError) return { error: empError.message };

  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  const staleEmployees = ((employees as any[]) ?? [])
    .filter((emp: any) => {
      if (!emp.skills_updated_at) return true; // never updated
      return now - new Date(emp.skills_updated_at).getTime() > staleMs;
    })
    .map((emp: any) => {
      const daysSinceUpdate = emp.skills_updated_at
        ? Math.floor((now - new Date(emp.skills_updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { name: emp.name, email: emp.email, daysSinceUpdate };
    });

  if (staleEmployees.length === 0) {
    return { notified: 0, staleEmployees: [] };
  }

  await notifyStaleSkills(staleEmployees);

  return { notified: staleEmployees.length, staleEmployees };
}
