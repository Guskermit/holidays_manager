"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────

export type EngagementRow = {
  id: string;
  client_id: string;
  engagement_code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  total_amount: number;
  estimated_expenses: number;
  created_at: string;
  updated_at: string;
  client_name?: string;
};

export type EmployeeRow = {
  id: string;
  name: string;
  category: string;
};

export type ImputacionRow = {
  id: string;
  employee_id: string;
  engagement_id: string;
  start_date: string;
  end_date: string | null;
  weekly_hours: number;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  engagement_name?: string;
  client_id?: string;
  client_name?: string;
};

// ── Auth helper ────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════
// ENGAGEMENTS
// ══════════════════════════════════════════════════════════════

export async function getEngagements(clientId?: string): Promise<{
  data?: EngagementRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  let query = supabase
    .from("engagements")
    .select("*")
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data: engagements, error } = await query;
  if (error) return { error: error.message };

  // Enrich with client name
  const enriched: EngagementRow[] = [];
  for (const e of (engagements ?? []) as any[]) {
    let clientName = "";
    const { data: client } = await supabase
      .from("projects")
      .select("name")
      .eq("id_engagement", e.client_id)
      .single();
    clientName = client?.name ?? e.client_id;

    enriched.push({
      ...e,
      client_name: clientName,
    });
  }

  return { data: enriched };
}

export async function createEngagement(input: {
  clientId: string;
  engagementCode: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  totalAmount?: number;
  estimatedExpenses?: number;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("engagements")
    .insert({
      client_id: input.clientId,
      engagement_code: input.engagementCode,
      name: input.name,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      total_amount: input.totalAmount ?? 0,
      estimated_expenses: input.estimatedExpenses ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return { id: data.id };
}

export async function updateEngagement(
  id: string,
  input: {
    clientId: string;
    engagementCode: string;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    totalAmount?: number;
    estimatedExpenses?: number;
  }
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("engagements")
    .update({
      client_id: input.clientId,
      engagement_code: input.engagementCode,
      name: input.name,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      total_amount: input.totalAmount ?? 0,
      estimated_expenses: input.estimatedExpenses ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return {};
}

export async function deleteEngagement(
  id: string
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("engagements")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return {};
}

// ══════════════════════════════════════════════════════════════
// IMPUTACIONES (Employee ↔ Engagement assignments)
// ══════════════════════════════════════════════════════════════

export async function getImputaciones(clientId?: string): Promise<{
  data?: ImputacionRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const query = supabase
    .from("employee_imputations")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: imputaciones, error } = await query;
  if (error) return { error: error.message };

  // Enrich with employee name, engagement name, and client info
  const enriched: ImputacionRow[] = [];
  for (const imp of (imputaciones ?? []) as any[]) {
    let employeeName = "";
    let engagementName = "";
    let clientIdVal = "";
    let clientName = "";

    const { data: emp } = await supabase
      .from("employees")
      .select("name")
      .eq("id", imp.employee_id)
      .single();
    employeeName = emp?.name ?? "";

    const { data: eng } = await supabase
      .from("engagements")
      .select("name, client_id")
      .eq("id", imp.engagement_id)
      .single();
    engagementName = eng?.name ?? "";
    clientIdVal = eng?.client_id ?? "";

    if (clientIdVal) {
      const { data: client } = await supabase
        .from("projects")
        .select("name")
        .eq("id_engagement", clientIdVal)
        .single();
      clientName = client?.name ?? clientIdVal;
    }

    // Filter by client if specified
    if (clientId && clientIdVal !== clientId) continue;

    enriched.push({
      ...imp,
      employee_name: employeeName,
      engagement_name: engagementName,
      client_id: clientIdVal,
      client_name: clientName,
    });
  }

  return { data: enriched };
}

export async function createImputacion(input: {
  employeeId: string;
  engagementId: string;
  startDate: string;
  endDate?: string | null;
  weeklyHours: number;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("employee_imputations")
    .insert({
      employee_id: input.employeeId,
      engagement_id: input.engagementId,
      start_date: input.startDate,
      end_date: input.endDate || null,
      weekly_hours: input.weeklyHours,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return { id: data.id };
}

export async function updateImputacion(
  id: string,
  input: {
    employeeId: string;
    engagementId: string;
    startDate: string;
    endDate?: string | null;
    weeklyHours: number;
  }
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("employee_imputations")
    .update({
      employee_id: input.employeeId,
      engagement_id: input.engagementId,
      start_date: input.startDate,
      end_date: input.endDate || null,
      weekly_hours: input.weeklyHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return {};
}

export async function deleteImputacion(
  id: string
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("employee_imputations")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return {};
}

// ══════════════════════════════════════════════════════════════
// CLIENT EMPLOYEES
// ══════════════════════════════════════════════════════════════

export async function getEmployeesByClient(clientId: string): Promise<{
  data?: EmployeeRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: employeeProjects, error } = await supabase
    .from("employee_projects")
    .select("employee_id, employees(id, name, category)")
    .eq("project_id", clientId);

  if (error) return { error: error.message };

  const employees: EmployeeRow[] = [];
  for (const ep of employeeProjects ?? []) {
    const emp = (ep as any).employees;
    if (emp) {
      employees.push({ id: emp.id, name: emp.name, category: emp.category ?? "Staff" });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = employees.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return { data: unique };
}

// ══════════════════════════════════════════════════════════════
// ALL EMPLOYEES (for adding to client)
// ══════════════════════════════════════════════════════════════

export async function getAllEmployees(): Promise<{
  data?: EmployeeRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, category")
    .order("name");

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((e: any) => ({
      id: e.id,
      name: e.name,
      category: e.category ?? "Staff",
    })),
  };
}

export async function assignEmployeeToClient(
  employeeId: string,
  clientId: string
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("employee_projects")
    .upsert(
      { employee_id: employeeId, project_id: clientId },
      { onConflict: "employee_id,project_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/main/admin/imputaciones");
  return {};
}

// ══════════════════════════════════════════════════════════════
// ASSIGNED EMPLOYEE IDS for an engagement
// ══════════════════════════════════════════════════════════════

export async function getAssignedEmployeeIds(
  engagementId: string
): Promise<{ data?: string[]; error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("employee_imputations")
    .select("employee_id")
    .eq("engagement_id", engagementId);

  if (error) return { error: error.message };

  const ids = [...new Set((data ?? []).map((r: any) => r.employee_id as string))];
  return { data: ids };
}

// ══════════════════════════════════════════════════════════════
// ENGAGEMENT HOURS SETTINGS
// ══════════════════════════════════════════════════════════════

export type HoursSettingsRow = {
  category: string;
  regular_hours: number;
  summer_hours: number;
};

export async function getHoursSettings(): Promise<{
  data?: HoursSettingsRow[];
  error?: string;
}> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("engagement_hours_settings")
    .select("*")
    .order("category");

  if (error) return { error: error.message };
  return { data: data as HoursSettingsRow[] };
}

export async function updateHoursSettings(
  settings: { category: string; regularHours: number; summerHours: number }[]
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  for (const s of settings) {
    const { error } = await supabase
      .from("engagement_hours_settings")
      .update({
        regular_hours: s.regularHours,
        summer_hours: s.summerHours,
        updated_at: new Date().toISOString(),
      })
      .eq("category", s.category);

    if (error) return { error: error.message };
  }

  revalidatePath("/main/admin/vacation-settings");
  return {};
}

// ══════════════════════════════════════════════════════════════
// ENGAGEMENT DETAIL (employee list with categories)
// ══════════════════════════════════════════════════════════════

export type EngagementEmployee = {
  id: string;
  name: string;
  category: string;
  office: string | null;
};

export async function getEngagementEmployees(
  engagementId: string
): Promise<{ data?: EngagementEmployee[]; error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  // Get employees assigned via imputaciones
  const { data: imps, error } = await supabase
    .from("employee_imputations")
    .select("employee_id, employees(id, name, category, office)")
    .eq("engagement_id", engagementId);

  if (error) return { error: error.message };

  const employees: EngagementEmployee[] = [];
  for (const imp of imps ?? []) {
    const emp = (imp as any).employees;
    if (emp) {
      employees.push({
        id: emp.id,
        name: emp.name,
        category: emp.category ?? "Staff",
        office: emp.office ?? null,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return {
    data: employees.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    }),
  };
}

// ══════════════════════════════════════════════════════════════
// HOLIDAYS + VACATIONS for a date range
// ══════════════════════════════════════════════════════════════

export async function getHolidaysInRange(
  start: string,
  end: string
): Promise<{ data?: string[]; error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("public_holidays")
    .select("date")
    .gte("date", start)
    .lte("date", end)
    .in("scope", ["national"]);

  if (error) return { error: error.message };
  return { data: (data ?? []).map((r: any) => r.date as string) };
}

export async function getApprovedVacationsInRange(
  start: string,
  end: string
): Promise<
  { data?: { employee_id: string; start_date: string; end_date: string }[]; error?: string }
> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase
    .from("vacation_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", end)
    .gte("end_date", start);

  if (error) return { error: error.message };
  return { data: data as any };
}

// ══════════════════════════════════════════════════════════════
// BATCH SAVE imputaciones for an engagement
// ══════════════════════════════════════════════════════════════

export async function saveEngagementImputaciones(
  engagementId: string,
  assignments: {
    employeeId: string;
    startDate: string;
    endDate: string | null;
    weeklyHours: number;
  }[]
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  // Delete existing imputaciones for this engagement
  await supabase
    .from("employee_imputations")
    .delete()
    .eq("engagement_id", engagementId);

  // Insert new ones
  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      engagement_id: engagementId,
      employee_id: a.employeeId,
      start_date: a.startDate,
      end_date: a.endDate,
      weekly_hours: a.weeklyHours,
    }));

    const { error } = await supabase
      .from("employee_imputations")
      .insert(rows);

    if (error) return { error: error.message };
  }

  revalidatePath("/main/admin/imputaciones");
  return {};
}
