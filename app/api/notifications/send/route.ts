import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/notifications/send
 *
 * Public (unsecured) endpoint.
 * Creates an in-app notification for one or more employees by ID.
 *
 * Query params:
 *   - title     (required) Notification title
 *   - message   (required) Notification message body
 *   - employees (required) Comma-separated employee IDs (from holidays_manager)
 *   - from      (optional) Sender employee ID. Defaults to first admin
 *
 * Example:
 *   GET /api/notifications/send?title=Alerta&message=Urgente&employees=uuid1,uuid2
 */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const title = searchParams.get("title")?.trim();
  const message = searchParams.get("message")?.trim();
  const employeesParam = searchParams.get("employees")?.trim();
  const fromId = searchParams.get("from")?.trim();

  // ── Validate required params ──────────────────────────────
  if (!title) {
    return NextResponse.json(
      { error: "Missing required parameter: title" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json(
      { error: "Missing required parameter: message" },
      { status: 400 }
    );
  }
  if (!employeesParam) {
    return NextResponse.json(
      { error: "Missing required parameter: employees (comma-separated employee IDs)" },
      { status: 400 }
    );
  }

  const recipientIds = [
    ...new Set(
      employeesParam
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    ),
  ];

  if (recipientIds.length === 0) {
    return NextResponse.json(
      { error: "No valid employee IDs provided" },
      { status: 400 }
    );
  }

  // ── Supabase client (anon key — relies on public RLS policies) ──
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // ── Resolve recipient employees by ID ─────────────────────
  const { data: recipientRows, error: recErr } = await supabase
    .from("employees")
    .select("id, name, email")
    .in("id", recipientIds);

  if (recErr) {
    return NextResponse.json(
      { error: `Error looking up employees: ${recErr.message}` },
      { status: 500 }
    );
  }

  if (!recipientRows || recipientRows.length === 0) {
    return NextResponse.json(
      { error: "No employees found for the provided IDs" },
      { status: 404 }
    );
  }

  // ── Resolve sender (created_by) ───────────────────────────
  let createdBy: string | null = null;

  if (fromId) {
    createdBy = fromId;
  }

  // Fallback: first admin
  if (!createdBy) {
    const { data: admin } = await supabase
      .from("employees")
      .select("id")
      .eq("role", "admin")
      .order("created_at")
      .limit(1)
      .single();
    createdBy = admin?.id ?? null;
  }

  if (!createdBy) {
    return NextResponse.json(
      { error: "Could not determine a valid sender (no admin found)" },
      { status: 500 }
    );
  }

  // ── Create the notification ───────────────────────────────
  const firstRecipient = recipientRows[0];

  const { data: notification, error: notifErr } = await supabase
    .from("notifications")
    .insert({
      title,
      message,
      created_by: createdBy,
      target_type: "employee",
      target_id: firstRecipient.id,
      is_active: true,
      recurrence: "none",
    })
    .select("id")
    .single();

  if (notifErr || !notification) {
    return NextResponse.json(
      { error: `Error creating notification: ${notifErr?.message}` },
      { status: 500 }
    );
  }

  // ── Insert recipients ─────────────────────────────────────
  type RecipientRow = { id: string; name: string; email: string };
  const recipientRows2 = recipientRows.map((emp: RecipientRow) => ({
    notification_id: notification.id,
    employee_id: emp.id,
  }));

  const { error: recipErr } = await supabase
    .from("notification_recipients")
    .insert(recipientRows2);

  if (recipErr) {
    return NextResponse.json(
      {
        warning: `Notification created but recipients error: ${recipErr.message}`,
        notification_id: notification.id,
        recipients_notified: 0,
      },
      { status: 207 }
    );
  }

  // ── Success ───────────────────────────────────────────────
  return NextResponse.json({
    notification_id: notification.id,
    title,
    message,
    recipients_notified: recipientRows.length,
    recipients: recipientRows.map((emp: { id: string; name: string; email: string }) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
    })),
  });
}
