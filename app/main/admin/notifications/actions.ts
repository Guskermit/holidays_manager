"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────

export type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_by: string;
  target_type: "all" | "project" | "employee";
  target_id: string | null;
  is_active: boolean;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  target_name?: string;
};

export type NotificationRecipientRow = {
  id: string;
  notification_id: string;
  employee_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type CreateNotificationInput = {
  title: string;
  message: string;
  targetType: "all" | "project" | "employee";
  targetId?: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
};

// ── Helpers ────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role, name")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") {
    return { supabase, employee: null, error: "Not authorized" as const };
  }

  return { supabase, employee: emp, error: null as string | null };
}

// ── Get all notifications (admin) ──────────────────────────

export async function getNotifications(): Promise<{
  data?: NotificationRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  // Enrich with creator name and target name
  const enriched: NotificationRow[] = [];
  for (const n of (notifications ?? []) as any[]) {
    let creatorName = "";
    let targetName = "";

    // Fetch creator
    const { data: creator } = await supabase
      .from("employees")
      .select("name")
      .eq("id", n.created_by)
      .single();
    creatorName = creator?.name ?? "Unknown";

    // Fetch target name
    if (n.target_type === "project" && n.target_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id_engagement", n.target_id)
        .single();
      targetName = project?.name ?? n.target_id;
    } else if (n.target_type === "employee" && n.target_id) {
      const { data: targetEmp } = await supabase
        .from("employees")
        .select("name")
        .eq("id", n.target_id)
        .single();
      targetName = targetEmp?.name ?? n.target_id;
    }

    enriched.push({
      ...n,
      creator_name: creatorName,
      target_name: targetName,
    });
  }

  return { data: enriched };
}

// ── Create notification ────────────────────────────────────

export async function createNotification(
  input: CreateNotificationInput
): Promise<{ error?: string; id?: string }> {
  const { supabase, employee, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const nextRunAt =
    input.recurrence !== "none" ? thisComputeNextRun(input.recurrence) : null;

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      title: input.title,
      message: input.message,
      created_by: employee!.id,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      is_active: true,
      recurrence: input.recurrence,
      next_run_at: nextRunAt,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Expand recipients
  const { error: recipError } = await supabase.rpc(
    "create_notification_recipients",
    { p_notification_id: notification.id }
  );

  if (recipError) return { error: recipError.message };

  revalidatePath("/main/admin/notifications");
  revalidatePath("/main");
  return { id: notification.id };
}

// ── Update notification ────────────────────────────────────

export async function updateNotification(
  id: string,
  input: CreateNotificationInput
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const nextRunAt =
    input.recurrence !== "none" ? thisComputeNextRun(input.recurrence) : null;

  const { error } = await supabase
    .from("notifications")
    .update({
      title: input.title,
      message: input.message,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      recurrence: input.recurrence,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Re-expand recipients
  await supabase
    .from("notification_recipients")
    .delete()
    .eq("notification_id", id);

  const { error: recipError } = await supabase.rpc(
    "create_notification_recipients",
    { p_notification_id: id }
  );

  if (recipError) return { error: recipError.message };

  revalidatePath("/main/admin/notifications");
  revalidatePath("/main");
  return {};
}

// ── Toggle active ──────────────────────────────────────────

export async function toggleNotificationActive(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("notifications")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/notifications");
  revalidatePath("/main");
  return {};
}

// ── Delete notification ────────────────────────────────────

export async function deleteNotification(
  id: string
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/notifications");
  revalidatePath("/main");
  return {};
}

// ── Copy notification ──────────────────────────────────────

export async function copyNotification(
  id: string
): Promise<{ error?: string; newId?: string }> {
  const { supabase, employee, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: original, error: fetchError } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) return { error: "Notification not found" };

  const nextRunAt =
    original.recurrence !== "none"
      ? thisComputeNextRun(original.recurrence)
      : null;

  const { data: copied, error: copyError } = await supabase
    .from("notifications")
    .insert({
      title: `${original.title} (copia)`,
      message: original.message,
      created_by: employee!.id,
      target_type: original.target_type,
      target_id: original.target_id,
      is_active: true,
      recurrence: original.recurrence,
      next_run_at: nextRunAt,
    })
    .select("id")
    .single();

  if (copyError) return { error: copyError.message };

  // Expand recipients for the copy
  await supabase.rpc("create_notification_recipients", {
    p_notification_id: copied.id,
  });

  revalidatePath("/main/admin/notifications");
  revalidatePath("/main");
  return { newId: copied.id };
}

// ── Helpers ────────────────────────────────────────────────

function thisComputeNextRun(
  recurrence: "daily" | "weekly" | "monthly"
): string {
  const now = new Date();
  switch (recurrence) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
}
