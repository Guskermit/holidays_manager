"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Get current employee's notifications ───────────────────

export async function getMyNotifications(): Promise<{
  data?: {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    created_by_name: string;
    target_type: string;
    target_name: string | null;
  }[];
  error?: string;
  unreadCount?: number;
}> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found" };

  // Get all notification recipients for this employee, with notification details
  const { data: recipients, error } = await supabase
    .from("notification_recipients")
    .select(`
      id,
      is_read,
      read_at,
      created_at,
      notification:notifications (
        id,
        title,
        message,
        target_type,
        target_id,
        created_at,
        created_by,
        is_active
      )
    `)
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  // Enrich with creator name and target name
  const enriched = [];
  for (const r of (recipients ?? []) as any[]) {
    const notif = r.notification as any;
    if (!notif || !notif.is_active) continue;

    let createdByName = "";
    let targetName: string | null = null;

    const { data: creator } = await supabase
      .from("employees")
      .select("name")
      .eq("id", notif.created_by)
      .single();
    createdByName = creator?.name ?? "";

    if (notif.target_type === "project" && notif.target_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("name")
        .eq("id_engagement", notif.target_id)
        .single();
      targetName = proj?.name ?? null;
    } else if (notif.target_type === "employee" && notif.target_id) {
      const { data: targEmp } = await supabase
        .from("employees")
        .select("name")
        .eq("id", notif.target_id)
        .single();
      targetName = targEmp?.name ?? null;
    }

    enriched.push({
      id: r.id,
      notification_id: notif.id,
      title: notif.title,
      message: notif.message,
      is_read: r.is_read,
      read_at: r.read_at,
      created_at: r.created_at,
      created_by_name: createdByName,
      target_type: notif.target_type,
      target_name: targetName,
    });
  }

  const unreadCount = enriched.filter((n) => !n.is_read).length;

  return { data: enriched, unreadCount };
}

// ── Mark one notification as read ──────────────────────────

export async function markAsRead(
  recipientId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return { error: "Not authenticated" };

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found" };

  const { error } = await supabase
    .from("notification_recipients")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", recipientId)
    .eq("employee_id", employee.id);

  if (error) return { error: error.message };

  revalidatePath("/main");
  return {};
}

// ── Mark all as read ───────────────────────────────────────

export async function markAllAsRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return { error: "Not authenticated" };

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) return { error: "Employee not found" };

  const { error } = await supabase
    .from("notification_recipients")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("employee_id", employee.id)
    .eq("is_read", false);

  if (error) return { error: error.message };

  revalidatePath("/main");
  return {};
}
