import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "impersonate_employee_id";

/** Returns the impersonated employee ID from cookie, or null if not impersonating. */
export async function getImpersonatedEmployeeId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
}

/**
 * Returns the effective employee context for a given authenticated user.
 * If the user is a super-admin and has an impersonation cookie set, returns
 * the impersonated employee's data. Otherwise returns the real employee.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEffectiveEmployee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  realEmployee: { id: string; role: string }
): Promise<{
  effectiveId: string;
  effectiveRole: string;
  isImpersonating: boolean;
  impersonatedName: string | null;
}> {
  if (realEmployee.role !== "super-admin") {
    return { effectiveId: realEmployee.id, effectiveRole: realEmployee.role, isImpersonating: false, impersonatedName: null };
  }

  const impersonatedId = await getImpersonatedEmployeeId();
  if (!impersonatedId) {
    return { effectiveId: realEmployee.id, effectiveRole: realEmployee.role, isImpersonating: false, impersonatedName: null };
  }

  const { data } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("id", impersonatedId)
    .single();

  if (!data) {
    return { effectiveId: realEmployee.id, effectiveRole: realEmployee.role, isImpersonating: false, impersonatedName: null };
  }

  return { effectiveId: data.id, effectiveRole: data.role, isImpersonating: true, impersonatedName: data.name };
}
