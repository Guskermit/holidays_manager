"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendVacationApprovedEmail, sendVacationRejectedEmail } from "@/lib/email";

async function getAdminEmployee() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { supabase: null, adminId: null };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") return { supabase: null, adminId: null };
  return { supabase, adminId: emp.id };
}

export async function approveVacationRequest(requestId: string): Promise<{ error?: string }> {
  const { supabase, adminId } = await getAdminEmployee();
  if (!supabase || !adminId) return { error: "Not authorized" };

  // Fetch the request + employee email
  const { data: req } = await supabase
    .from("vacation_requests")
    .select(`
      id, status, days_requested, start_date, end_date, year, employee_id,
      employees!vacation_requests_employee_id_fkey ( name, email )
    `)
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Request not found" };
  if (req.status !== "pending") return { error: "Only pending requests can be approved" };

  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({ status: "approved", approved_by: adminId, resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updErr) return { error: updErr.message };

  // Update balance: pending → used
  await supabase
    .from("vacation_balances")
    .update({
      used_days: supabase.rpc("coalesce", []) as any, // plain update below
    })
    .eq("employee_id", req.employee_id)
    .eq("year", req.year);

  // Use separate increments to avoid RPC dependency
  const { data: bal } = await supabase
    .from("vacation_balances")
    .select("used_days, pending_days")
    .eq("employee_id", req.employee_id)
    .eq("year", req.year)
    .single();

  if (bal) {
    await supabase
      .from("vacation_balances")
      .update({
        used_days: bal.used_days + req.days_requested,
        pending_days: Math.max(0, bal.pending_days - req.days_requested),
      })
      .eq("employee_id", req.employee_id)
      .eq("year", req.year);
  }

  // Send email (non-blocking — don't fail the action if email fails)
  const empRaw = Array.isArray(req.employees) ? req.employees[0] : req.employees;
  const emp = empRaw as { name: string; email: string } | null | undefined;
  if (emp?.email) {
    try {
      await sendVacationApprovedEmail({
        to: emp.email,
        employeeName: emp.name,
        startDate: req.start_date,
        endDate: req.end_date,
        daysRequested: req.days_requested,
      });
    } catch (_) {}
  }

  revalidatePath("/main/admin/vacation-requests");
  return {};
}

export async function rejectVacationRequest(
  requestId: string,
  reason: string
): Promise<{ error?: string }> {
  const { supabase, adminId } = await getAdminEmployee();
  if (!supabase || !adminId) return { error: "Not authorized" };

  const { data: req } = await supabase
    .from("vacation_requests")
    .select(`
      id, status, days_requested, start_date, end_date, year, employee_id,
      employees!vacation_requests_employee_id_fkey ( name, email )
    `)
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Request not found" };
  if (req.status !== "pending") return { error: "Only pending requests can be rejected" };

  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({
      status: "rejected",
      approved_by: adminId,
      resolved_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", requestId);

  if (updErr) return { error: updErr.message };

  // Return days to balance
  const { data: bal } = await supabase
    .from("vacation_balances")
    .select("pending_days")
    .eq("employee_id", req.employee_id)
    .eq("year", req.year)
    .single();

  if (bal) {
    await supabase
      .from("vacation_balances")
      .update({ pending_days: Math.max(0, bal.pending_days - req.days_requested) })
      .eq("employee_id", req.employee_id)
      .eq("year", req.year);
  }

  // Send email
  const empRaw = Array.isArray(req.employees) ? req.employees[0] : req.employees;
  const emp = empRaw as { name: string; email: string } | null | undefined;
  if (emp?.email) {
    try {
      await sendVacationRejectedEmail({
        to: emp.email,
        employeeName: emp.name,
        startDate: req.start_date,
        endDate: req.end_date,
        daysRequested: req.days_requested,
        reason: reason || undefined,
      });
    } catch (_) {}
  }

  revalidatePath("/main/admin/vacation-requests");
  return {};
}
