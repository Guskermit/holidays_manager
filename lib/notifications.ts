/**
 * In-app notification utility — creates notifications in the database
 * that employees can see in the notification bell.
 *
 * These are separate from Slack notifications and work alongside them.
 *
 * IMPORTANT: Notifications are created using a service-role client
 * (bypasses RLS) because the `notifications` table has an admin-only
 * INSERT policy.  Non-admin users (e.g. employees requesting password
 * recovery) must still be able to create notifications for their
 * managers/admins.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Create an in-app notification for a specific employee.
 * Uses the service-role client to bypass RLS (the `notifications` table
 * has an admin-only INSERT policy, but non-admin users need to create
 * notifications — e.g. employees requesting password recovery).
 */
export async function createEmployeeNotification(params: {
  title: string;
  message: string;
  employeeId: string;
  createdBy: string;
  vacationRequestId?: string;
}): Promise<void> {
  const { title, message, employeeId, createdBy, vacationRequestId } = params;
  const supabase = createServiceClient();

  // Create the notification
  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      title,
      message,
      created_by: createdBy,
      target_type: "employee",
      target_id: employeeId,
      is_active: true,
      recurrence: "none",
      ...(vacationRequestId ? { vacation_request_id: vacationRequestId } : {}),
    })
    .select("id")
    .single();

  if (error || !notification) return;

  // Expand recipients (will just be the one employee)
  await supabase.rpc("create_notification_recipients", {
    p_notification_id: notification.id,
  });
}

/**
 * Notify employee when their vacation request is approved.
 */
export async function notifyVacationApprovedInApp(params: {
  employeeId: string;
  adminId: string;
  startDate: string;
  endDate: string;
  days: number;
  isBootcamp?: boolean;
  isMedicalLeave?: boolean;
}): Promise<void> {
  const { employeeId, adminId, startDate, endDate, days, isBootcamp, isMedicalLeave } = params;

  let title = "✅ Vacaciones aprobadas";
  let message = `Tus vacaciones del ${fmtDate(startDate)} al ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""}) han sido aprobadas.`;

  if (isBootcamp) {
    title = "✅ Bootcamp aprobado";
    message = `Tu solicitud de bootcamp del ${fmtDate(startDate)} al ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""}) ha sido aprobada.`;
  } else if (isMedicalLeave) {
    title = "✅ Baja médica aprobada";
    message = `Tu baja médica del ${fmtDate(startDate)} al ${fmtDate(endDate)} ha sido aprobada.`;
  }

  await createEmployeeNotification({
    title,
    message,
    employeeId,
    createdBy: adminId,
  });
}

/**
 * Notify employee when their vacation request is rejected.
 */
export async function notifyVacationRejectedInApp(params: {
  employeeId: string;
  adminId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}): Promise<void> {
  const { employeeId, adminId, startDate, endDate, reason } = params;

  const reasonText = reason ? `\nMotivo: ${reason}` : "";

  await createEmployeeNotification({
    title: "❌ Vacaciones rechazadas",
    message: `Tus vacaciones del ${fmtDate(startDate)} al ${fmtDate(endDate)} han sido rechazadas.${reasonText}`,
    employeeId,
    createdBy: adminId,
  });
}

/**
 * Notify employee when their vacation request is cancelled by admin.
 */
export async function notifyVacationCancelledInApp(params: {
  employeeId: string;
  adminId: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  const { employeeId, adminId, startDate, endDate } = params;

  await createEmployeeNotification({
    title: "🚫 Vacaciones canceladas",
    message: `Tus vacaciones del ${fmtDate(startDate)} al ${fmtDate(endDate)} han sido canceladas por un administrador.`,
    employeeId,
    createdBy: adminId,
  });
}

/**
 * Notify managers when an employee submits a vacation request.
 * Finds the employee's direct manager(s) and project admin(s),
 * then sends each an in-app notification.
 */
export async function notifyManagersVacationRequested(params: {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  isBootcamp?: boolean;
  isMedicalLeave?: boolean;
  vacationRequestId?: string;
}): Promise<void> {
  const {
    employeeId,
    employeeName,
    startDate,
    endDate,
    days,
    isBootcamp,
    isMedicalLeave,
    vacationRequestId,
  } = params;
  const supabase = await createClient();

  // 1. Find the employee's direct manager
  const { data: employee } = await supabase
    .from("employees")
    .select("manager_id")
    .eq("id", employeeId)
    .single();

  const managerIds = new Set<string>();
  if (employee?.manager_id) {
    managerIds.add(employee.manager_id);
  }

  // 2. Find projects the employee is assigned to
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", employeeId);

  const projectIds = (empProjects ?? []).map((ep) => ep.project_id);

  if (projectIds.length > 0) {
    // 3. Find project managers assigned to those projects
    const { data: projectMembers } = await supabase
      .from("employee_projects")
      .select("employee_id")
      .in("project_id", projectIds);

    const memberIds = [
      ...new Set((projectMembers ?? []).map((pm) => pm.employee_id)),
    ];

    if (memberIds.length > 0) {
      // System admins
      const { data: admins } = await supabase
        .from("employees")
        .select("id")
        .in("id", memberIds)
        .in("role", ["admin", "super-admin"]);

      (admins ?? []).forEach((a) => managerIds.add(a.id));

      // Employees with Manager / Senior-Manager category in the same projects
      const { data: catManagers } = await supabase
        .from("employees")
        .select("id")
        .in("id", memberIds)
        .in("category", ["Manager", "Senior-Manager"]);

      (catManagers ?? []).forEach((m) => managerIds.add(m.id));
    }
  }

  // Don't notify yourself
  managerIds.delete(employeeId);

  if (managerIds.size === 0) return;

  // Build the request type label
  let requestType = "vacaciones";
  if (isBootcamp) requestType = "bootcamp";
  else if (isMedicalLeave) requestType = "baja médica";

  const title = `📋 Solicitud de ${requestType} pendiente`;
  const message = `${employeeName} ha solicitado ${requestType} del ${fmtDate(startDate)} al ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""}). Revisa la solicitud.`;

  // 4. Send notification to each manager
  for (const managerId of managerIds) {
    await createEmployeeNotification({
      title,
      message,
      employeeId: managerId,
      createdBy: employeeId,
      vacationRequestId,
    });
  }
}

/**
 * Check if a manager/senior-manager has pending vacation requests from their
 * direct reports, and generate per-client notifications.
 *
 * Called on dashboard load — creates one notification per project/client:
 * "Tienes X notificaciones pendientes de aprobar para el cliente XXX"
 *
 * Deduplicates: won't create if an unread notification with the same
 * client name already exists for this manager.
 */
export async function notifyManagerPendingApprovals(managerId: string): Promise<void> {
  const supabase = await createClient();

  // 1. Find direct reports (employees whose manager_id = this manager)
  const { data: reports } = await supabase
    .from("employees")
    .select("id, name")
    .eq("manager_id", managerId);

  if (!reports || reports.length === 0) return;

  const reportIds = reports.map((r) => r.id);

  // 2. Find pending vacation requests from those reports
  const { data: pendingRequests } = await supabase
    .from("vacation_requests")
    .select("id, employee_id")
    .in("employee_id", reportIds)
    .eq("status", "pending");

  if (!pendingRequests || pendingRequests.length === 0) return;

  // 3. Find which projects each report is assigned to
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select("employee_id, project_id")
    .in("employee_id", reportIds);

  if (!empProjects || empProjects.length === 0) return;

  // 4. Batch-fetch project names
  const projectIds = [...new Set(empProjects.map((ep) => ep.project_id))];
  const { data: projects } = await supabase
    .from("projects")
    .select("id_engagement, name")
    .in("id_engagement", projectIds);

  const projectMap = new Map(
    (projects ?? []).map((p) => [p.id_engagement, p.name])
  );

  // 5. Build a map: employee_id → Set of project names
  const empProjectNames = new Map<string, Set<string>>();
  for (const ep of empProjects) {
    const name = projectMap.get(ep.project_id);
    if (!name) continue;
    if (!empProjectNames.has(ep.employee_id)) {
      empProjectNames.set(ep.employee_id, new Set());
    }
    empProjectNames.get(ep.employee_id)!.add(name);
  }

  // 6. Group pending requests by client/project name
  const clientPendingCount = new Map<string, number>();
  for (const req of pendingRequests) {
    const clientNames = empProjectNames.get(req.employee_id);
    if (!clientNames) continue;
    for (const clientName of clientNames) {
      clientPendingCount.set(clientName, (clientPendingCount.get(clientName) ?? 0) + 1);
    }
  }

  if (clientPendingCount.size === 0) return;

  // 7. Fetch existing unread notifications for this manager to deduplicate
  const { data: existingRecipients } = await supabase
    .from("notification_recipients")
    .select(`
      id,
      is_read,
      notification:notifications!inner (
        id,
        title,
        is_active,
        created_at
      )
    `)
    .eq("employee_id", managerId)
    .eq("is_read", false);

  type NotifJoin = { id: string; title: string; is_active: boolean; created_at: string };
  type RecipientRow = { id: string; is_read: boolean; notification: NotifJoin | NotifJoin[] };

  const existingTitles = new Set<string>();
  for (const r of (existingRecipients ?? []) as RecipientRow[]) {
    const notif = Array.isArray(r.notification) ? r.notification[0] : r.notification;
    if (notif?.is_active && notif?.title?.startsWith("📋 Tienes") && notif?.title?.includes("pendientes de aprobar")) {
      existingTitles.add(notif.title);
    }
  }

  // 8. Create notifications for each client (skip if already exists)
  for (const [clientName, count] of clientPendingCount) {
    const title = `📋 Tienes ${count} notificación${count !== 1 ? "es" : ""} pendientes de aprobar para el cliente ${clientName}`;

    // Skip if an unread notification with the same title already exists
    if (existingTitles.has(title)) continue;

    await createEmployeeNotification({
      title,
      message: `Hay ${count} solicitud${count !== 1 ? "es" : ""} de vacaciones pendiente${count !== 1 ? "s" : ""} de tus reportes directos en el cliente ${clientName}.`,
      employeeId: managerId,
      createdBy: managerId,
    });
  }
}

/**
 * Notify admins/super-admins about pending vacation requests from employees
 * assigned to their projects.
 *
 * Unlike notifyManagerPendingApprovals (which only checks direct reports),
 * this function finds all employees on the admin's projects with pending
 * vacation requests and generates per-client summary notifications.
 */
export async function notifyAdminPendingVacationApprovals(adminId: string): Promise<void> {
  const supabase = await createClient();

  // 1. Find projects where this admin is assigned
  const { data: adminProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", adminId);

  if (!adminProjects || adminProjects.length === 0) return;

  const projectIds = [...new Set(adminProjects.map((ep) => ep.project_id))];

  // 2. Find all employees on those projects
  const { data: projectMembers } = await supabase
    .from("employee_projects")
    .select("employee_id")
    .in("project_id", projectIds);

  if (!projectMembers || projectMembers.length === 0) return;

  const memberIds = [...new Set(projectMembers.map((pm) => pm.employee_id))];

  // 3. Find pending vacation requests from those employees
  const { data: pendingRequests } = await supabase
    .from("vacation_requests")
    .select("id, employee_id")
    .in("employee_id", memberIds)
    .eq("status", "pending");

  if (!pendingRequests || pendingRequests.length === 0) return;

  // 4. Find which projects each requesting employee is assigned to
  const requestingEmployeeIds = [...new Set(pendingRequests.map((r) => r.employee_id))];
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select("employee_id, project_id")
    .in("employee_id", requestingEmployeeIds)
    .in("project_id", projectIds);

  if (!empProjects || empProjects.length === 0) return;

  // 5. Batch-fetch project names
  const { data: projects } = await supabase
    .from("projects")
    .select("id_engagement, name")
    .in("id_engagement", projectIds);

  const projectMap = new Map(
    (projects ?? []).map((p) => [p.id_engagement, p.name])
  );

  // 6. Build a map: employee_id → Set of project names
  const empProjectNames = new Map<string, Set<string>>();
  for (const ep of empProjects) {
    const name = projectMap.get(ep.project_id);
    if (!name) continue;
    if (!empProjectNames.has(ep.employee_id)) {
      empProjectNames.set(ep.employee_id, new Set());
    }
    empProjectNames.get(ep.employee_id)!.add(name);
  }

  // 7. Group pending requests by client/project name
  const clientPendingCount = new Map<string, number>();
  for (const req of pendingRequests) {
    const clientNames = empProjectNames.get(req.employee_id);
    if (!clientNames) continue;
    for (const clientName of clientNames) {
      clientPendingCount.set(clientName, (clientPendingCount.get(clientName) ?? 0) + 1);
    }
  }

  if (clientPendingCount.size === 0) return;

  // 8. Fetch existing unread notifications to deduplicate
  const { data: existingRecipients } = await supabase
    .from("notification_recipients")
    .select(`
      id,
      is_read,
      notification:notifications!inner (
        id,
        title,
        is_active,
        created_at
      )
    `)
    .eq("employee_id", adminId)
    .eq("is_read", false);

  type NotifJoin = { id: string; title: string; is_active: boolean; created_at: string };
  type RecipientRow = { id: string; is_read: boolean; notification: NotifJoin | NotifJoin[] };

  const existingTitles = new Set<string>();
  for (const r of (existingRecipients ?? []) as RecipientRow[]) {
    const notif = Array.isArray(r.notification) ? r.notification[0] : r.notification;
    if (notif?.is_active && notif?.title?.startsWith("📋 Tienes") && notif?.title?.includes("pendientes de aprobar")) {
      existingTitles.add(notif.title);
    }
  }

  // 9. Create notifications for each client (skip if already exists)
  for (const [clientName, count] of clientPendingCount) {
    const title = `📋 Tienes ${count} notificación${count !== 1 ? "es" : ""} pendientes de aprobar para el cliente ${clientName}`;

    if (existingTitles.has(title)) continue;

    await createEmployeeNotification({
      title,
      message: `Hay ${count} solicitud${count !== 1 ? "es" : ""} de vacaciones pendiente${count !== 1 ? "s" : ""} de empleados en el cliente ${clientName}.`,
      employeeId: adminId,
      createdBy: adminId,
    });
  }
}

/**
 * Mark all unread notifications related to a vacation request as read
 * for every manager/admin who received them.
 *
 * Called when any manager approves or rejects a vacation request so that
 * the "Solicitud pendiente" notification disappears for all managers.
 */
export async function markVacationRequestNotificationsAsRead(
  vacationRequestId: string
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Find notification IDs linked to this vacation request
  const { data: notifRows } = await supabase
    .from("notifications")
    .select("id")
    .eq("vacation_request_id", vacationRequestId);

  if (!notifRows || notifRows.length === 0) return;

  const notifIds = notifRows.map((n) => n.id);

  // 2. Find unread recipients for those notifications
  const { data: rows } = await supabase
    .from("notification_recipients")
    .select("id")
    .eq("is_read", false)
    .in("notification_id", notifIds);

  if (!rows || rows.length === 0) return;

  const ids = rows.map((r) => r.id);

  // 3. Mark them all as read
  await supabase
    .from("notification_recipients")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in("id", ids);
}
