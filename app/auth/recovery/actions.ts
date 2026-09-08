"use server";

/**
 * Password recovery server actions.
 *
 * Flow:
 * 1. Employee enters email on /auth/forgot-password
 * 2. System generates a unique code, notifies the employee's managers
 * 3. Manager communicates the code to the employee verbally
 * 4. Employee enters code + new password on /auth/recovery
 * 5. System verifies the code and updates the password
 */

import { createClient } from "@/lib/supabase/server";
import { createEmployeeNotification } from "@/lib/notifications";

/** Generate a random 8-character uppercase alphanumeric code */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}

/**
 * Request a password recovery code.
 * Finds the employee by email, generates a code, and notifies their managers.
 */
export async function requestPasswordRecovery(email: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  // 1. Find the employee by email
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, name, user_id")
    .ilike("email", email.trim())
    .single();

  if (empError || !employee) {
    return { error: "No se encontró ninguna cuenta con ese email." };
  }

  if (!employee.user_id) {
    return { error: "Esta cuenta no tiene un usuario asociado." };
  }

  // 2. Find the employee's managers (direct manager + project managers)
  //    Same logic as notifyManagersVacationRequested
  const managerIds = new Set<string>();

  // Direct manager
  const { data: empData } = await supabase
    .from("employees")
    .select("manager_id")
    .eq("id", employee.id)
    .single();

  if (empData?.manager_id) {
    managerIds.add(empData.manager_id);
  }

  // Project managers — find projects the employee is assigned to
  const { data: empProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", employee.id);

  const projectIds = (empProjects ?? []).map((ep) => ep.project_id);

  if (projectIds.length > 0) {
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

  // Don't notify yourself if you're your own manager
  managerIds.delete(employee.id);

  if (managerIds.size === 0) {
    return {
      error:
        "No se encontraron managers para tu cuenta. Contacta con un administrador.",
    };
  }

  // 3. Generate a unique code (retry once if collision)
  let code = generateCode();
  const { data: existing } = await supabase
    .from("password_recovery_codes")
    .select("id")
    .eq("code", code)
    .eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    code = generateCode();
  }

  // 4. Insert the recovery code (expires in 24 hours)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase
    .from("password_recovery_codes")
    .insert({
      employee_id: employee.id,
      code,
      is_used: false,
      expires_at: expiresAt,
    });

  if (insertError) {
    return { error: "Error al generar el código de recuperación." };
  }

  // 5. Notify each manager with the code
  for (const managerId of managerIds) {
    await createEmployeeNotification({
      title: "🔑 Código de recuperación de contraseña",
      message: `El empleado ${employee.name} ha solicitado recuperación de contraseña.\n\nCódigo: ${code}\n\nComunica este código al empleado para que pueda restablecer su contraseña en /auth/recovery.`,
      employeeId: managerId,
      createdBy: employee.id,
    });
  }

  return { success: true };
}

/**
 * Verify a recovery code and update the password.
 */
export async function verifyRecoveryCode(params: {
  code: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { code, newPassword, confirmPassword } = params;

  // 1. Validate passwords match
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  if (newPassword.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();

  // 2. Find the recovery code
  const { data: recoveryCode, error: codeError } = await supabase
    .from("password_recovery_codes")
    .select("id, employee_id, is_used, expires_at")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (codeError || !recoveryCode) {
    return { error: "Código de recuperación no válido." };
  }

  // 3. Validate code
  if (recoveryCode.is_used) {
    return { error: "Este código ya ha sido utilizado. Solicita uno nuevo." };
  }

  if (new Date(recoveryCode.expires_at) < new Date()) {
    return { error: "Este código ha expirado. Solicita uno nuevo." };
  }

  // 4. Get the employee's auth user_id
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", recoveryCode.employee_id)
    .single();

  if (empError || !employee?.user_id) {
    return { error: "No se pudo encontrar el usuario asociado." };
  }

  // 5. Update the password via the SECURITY DEFINER function
  const { error: updateError } = await supabase.rpc("update_user_password", {
    p_user_id: employee.user_id,
    p_new_password: newPassword,
  });

  if (updateError) {
    return { error: "Error al actualizar la contraseña." };
  }

  // 6. Mark the code as used
  await supabase
    .from("password_recovery_codes")
    .update({ is_used: true })
    .eq("id", recoveryCode.id);

  return { success: true };
}
