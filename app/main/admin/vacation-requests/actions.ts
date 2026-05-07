"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  notifyVacationApproved,
  notifyVacationRejected,
  notifyVacationCancelled,
} from "@/lib/slack";

async function getAdminEmployee() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return { supabase: null, adminId: null };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") return { supabase: null, adminId: null };
  return { supabase, adminId: emp.id };
}

export async function approveVacationRequest(requestId: string): Promise<{ error?: string }> {
  const { supabase, adminId } = await getAdminEmployee();
  if (!supabase || !adminId) return { error: "Not authorized" };

  const { data: req } = await supabase
    .from("vacation_requests")
    .select("id, status, days_requested, year, employee_id, start_date, end_date")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Request not found" };
  if (req.status !== "pending") return { error: "Only pending requests can be approved" };

  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({ status: "approved", approved_by: adminId, resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updErr) return { error: updErr.message };

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

  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", req.employee_id)
    .single();
  await notifyVacationApproved({
    employeeName: emp?.name ?? "Empleado",
    startDate: req.start_date,
    endDate: req.end_date,
    days: req.days_requested,
  });

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
    .select("id, status, days_requested, year, employee_id, start_date, end_date")
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

  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", req.employee_id)
    .single();
  await notifyVacationRejected({
    employeeName: emp?.name ?? "Empleado",
    startDate: req.start_date,
    endDate: req.end_date,
    reason: reason || null,
  });

  revalidatePath("/main/admin/vacation-requests");
  return {};
}

export async function cancelApprovedRequest(requestId: string): Promise<{ error?: string }> {
  const { supabase, adminId } = await getAdminEmployee();
  if (!supabase || !adminId) return { error: "Not authorized" };

  const { data: req } = await supabase
    .from("vacation_requests")
    .select("id, status, days_requested, year, employee_id, start_date, end_date")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Request not found" };
  if (req.status !== "approved") return { error: "Only approved requests can be cancelled" };

  const { error: updErr } = await supabase
    .from("vacation_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updErr) return { error: updErr.message };

  // Return used days back to balance
  const { data: bal } = await supabase
    .from("vacation_balances")
    .select("used_days")
    .eq("employee_id", req.employee_id)
    .eq("year", req.year)
    .single();

  if (bal) {
    await supabase
      .from("vacation_balances")
      .update({ used_days: Math.max(0, bal.used_days - req.days_requested) })
      .eq("employee_id", req.employee_id)
      .eq("year", req.year);
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", req.employee_id)
    .single();
  await notifyVacationCancelled({
    employeeName: emp?.name ?? "Empleado",
    startDate: req.start_date,
    endDate: req.end_date,
    days: req.days_requested,
  });

  revalidatePath("/main/admin/vacation-requests");
  return {};
}
