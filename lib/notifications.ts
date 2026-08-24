/**
 * In-app notification utility — creates notifications in the database
 * that employees can see in the notification bell.
 *
 * These are separate from Slack notifications and work alongside them.
 */

import { createClient } from "@/lib/supabase/server";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Create an in-app notification for a specific employee.
 * Uses the service role client to bypass RLS (called from server actions).
 */
export async function createEmployeeNotification(params: {
  title: string;
  message: string;
  employeeId: string;
  createdBy: string;
}): Promise<void> {
  const { title, message, employeeId, createdBy } = params;
  const supabase = await createClient();

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
}): Promise<void> {
  const {
    employeeId,
    employeeName,
    startDate,
    endDate,
    days,
    isBootcamp,
    isMedicalLeave,
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
    // 3. Find admins/super-admins assigned to those projects
    const { data: projectMembers } = await supabase
      .from("employee_projects")
      .select("employee_id")
      .in("project_id", projectIds);

    const memberIds = [
      ...new Set((projectMembers ?? []).map((pm) => pm.employee_id)),
    ];

    if (memberIds.length > 0) {
      const { data: admins } = await supabase
        .from("employees")
        .select("id")
        .in("id", memberIds)
        .in("role", ["admin", "super-admin"]);

      (admins ?? []).forEach((a) => managerIds.add(a.id));
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
    });
  }
}
