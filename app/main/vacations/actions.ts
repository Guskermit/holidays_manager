"use server";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_DAYS, type Category } from "@/lib/categories";

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
    .select("id, category")
    .eq("id", employeeId)
    .eq("user_id", authData.claims.sub)
    .single();

  if (empError || !employee) {
    return { error: "Employee not found or access denied." };
  }

  // Compute category-based maximum days
  const maxDays = CATEGORY_DAYS[(employee.category as Category) ?? "Staff"] ?? 26;

  // Sum all approved + pending days for the year
  const { data: existingRequests } = await supabase
    .from("vacation_requests")
    .select("days_requested")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("status", ["approved", "pending"]);

  const usedAndPending = (existingRequests ?? []).reduce(
    (sum, r) => sum + r.days_requested,
    0
  );
  const remaining = maxDays - usedAndPending;

  if (daysRequested > remaining) {
    return {
      error: `Insufficient vacation balance. You have ${remaining} of ${maxDays} days remaining.`,
    };
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

  // Update or create balance
  const { data: balance } = await supabase
    .from("vacation_balances")
    .select("pending_days, total_days")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (balance) {
    await supabase
      .from("vacation_balances")
      .update({ pending_days: balance.pending_days + daysRequested })
      .eq("employee_id", employeeId)
      .eq("year", year);
  } else {
    await supabase.from("vacation_balances").insert({
      employee_id: employeeId,
      year,
      total_days: maxDays,
      pending_days: daysRequested,
    });
  }

  return {};
}
