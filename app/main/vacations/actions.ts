"use server";

import { createClient } from "@/lib/supabase/server";

export async function requestVacation(
  employeeId: string,
  startDate: string,
  endDate: string,
  daysRequested: number,
  year: number
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Verify the employee belongs to the current user
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { error: "Not authenticated." };

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("user_id", authData.claims.sub)
    .single();

  if (empError || !employee) {
    return { error: "Employee not found or access denied." };
  }

  // Check balance
  const { data: balance } = await supabase
    .from("vacation_balances")
    .select("total_days, used_days, pending_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (balance) {
    const remaining = balance.total_days - balance.used_days - balance.pending_days;
    if (daysRequested > remaining) {
      return { error: `Insufficient vacation balance. You have ${remaining} days remaining.` };
    }
  }

  // Create the request
  const { error: insertError } = await supabase.from("vacation_requests").insert({
    employee_id: employeeId,
    start_date: startDate,
    end_date: endDate,
    days_requested: daysRequested,
    status: "pending",
    year,
  });

  if (insertError) return { error: insertError.message };

  // Update pending_days in balance (upsert)
  if (balance) {
    await supabase
      .from("vacation_balances")
      .update({ pending_days: balance.pending_days + daysRequested })
      .eq("employee_id", employeeId)
      .eq("year", year);
  }

  return {};
}
