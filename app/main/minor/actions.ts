"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type HoursEntry = {
  subproject_id: string;
  week_start: string;
  hours: number;
};

export async function upsertMinorHours(
  entries: HoursEntry[]
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found" };

  if (entries.length === 0) return {};

  const rows = entries.map((e) => ({
    employee_id: employee.id,
    subproject_id: e.subproject_id,
    week_start: e.week_start,
    hours: e.hours,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("minor_hours")
    .upsert(rows, {
      onConflict: "employee_id,subproject_id,week_start",
      ignoreDuplicates: false,
    });

  if (error) return { error: error.message };
  return {};
}
