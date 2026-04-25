"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OpportunityEmployeeInput = {
  employeeId: string;
  costPerHour: number;
  revenuePerHour: number | null; // null means use formula
  hours: Record<string, number>;
};

export type SaveOpportunityInput = {
  id?: string;
  client: string;
  name: string;
  description: string;
  margin: number;
  startDate: string;
  endDate: string;
  employees: OpportunityEmployeeInput[];
};

export async function saveOpportunity(
  input: SaveOpportunityInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return { error: "No autenticado" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") return { error: "Sin permisos" };

  let opportunityId = input.id;

  if (opportunityId) {
    // Update existing
    const { error } = await supabase
      .from("opportunities")
      .update({
        client: input.client,
        name: input.name,
        description: input.description || null,
        margin: input.margin,
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .eq("id", opportunityId);

    if (error) return { error: error.message };

    // Delete existing employees to replace with new set
    const { error: delErr } = await supabase
      .from("opportunity_employees")
      .delete()
      .eq("opportunity_id", opportunityId);

    if (delErr) return { error: delErr.message };
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        client: input.client,
        name: input.name,
        description: input.description || null,
        margin: input.margin,
        start_date: input.startDate,
        end_date: input.endDate,
        created_by: emp.id,
      })
      .select("id")
      .single();

    if (error || !data) return { error: error?.message ?? "Error desconocido" };
    opportunityId = data.id;
  }

  // Insert employees
  if (input.employees.length > 0) {
    const rows = input.employees.map((e) => ({
      opportunity_id: opportunityId!,
      employee_id: e.employeeId,
      cost_per_hour: e.costPerHour,
      revenue_per_hour: e.revenuePerHour,
      hours: e.hours,
    }));

    const { error } = await supabase.from("opportunity_employees").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/main/pricing");
  return { id: opportunityId! };
}

export async function deleteOpportunity(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return { error: "No autenticado" };

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") return { error: "Sin permisos" };

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/main/pricing");
  return {};
}

export async function duplicateOpportunity(
  id: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return { error: "No autenticado" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") return { error: "Sin permisos" };

  const { data: source, error: fetchErr } = await supabase
    .from("opportunities")
    .select(`
      client, name, description, margin, start_date, end_date,
      opportunity_employees ( employee_id, cost_per_hour, revenue_per_hour, hours )
    `)
    .eq("id", id)
    .single();

  if (fetchErr || !source) return { error: fetchErr?.message ?? "No encontrado" };

  const { data: newOpp, error: insertErr } = await supabase
    .from("opportunities")
    .insert({
      client: source.client,
      name: `${source.name} (copia)`,
      description: source.description,
      margin: source.margin,
      start_date: source.start_date,
      end_date: source.end_date,
      created_by: emp.id,
    })
    .select("id")
    .single();

  if (insertErr || !newOpp) return { error: insertErr?.message ?? "Error desconocido" };

  const employees = source.opportunity_employees as any[];
  if (employees.length > 0) {
    const rows = employees.map((e) => ({
      opportunity_id: newOpp.id,
      employee_id: e.employee_id,
      cost_per_hour: e.cost_per_hour,
      revenue_per_hour: e.revenue_per_hour ?? null,
      hours: e.hours,
    }));
    const { error: empErr } = await supabase.from("opportunity_employees").insert(rows);
    if (empErr) return { error: empErr.message };
  }

  revalidatePath("/main/pricing");
  return { id: newOpp.id };
}
