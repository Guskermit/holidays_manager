import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/engagements/[code]
 *
 * Public (unsecured) endpoint.
 * Given an engagement_code, returns the engagement details and the list
 * of employees with their imputaciones (weekly hours by date range).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Public read-only — uses the anon key, relies on public RLS policies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // ── 1. Find the engagement by code ────────────────────────
  const { data: engagement, error: engErr } = await supabase
    .from("engagements")
    .select("id, engagement_code, name, client_id, start_date, end_date, total_amount, estimated_expenses")
    .eq("engagement_code", code)
    .single();

  if (engErr || !engagement) {
    return NextResponse.json(
      { error: `Engagement with code "${code}" not found.` },
      { status: 404 }
    );
  }

  // ── 2. Resolve client name ────────────────────────────────
  let clientName = engagement.client_id;
  const { data: clientRow } = await supabase
    .from("projects")
    .select("name")
    .eq("id_engagement", engagement.client_id)
    .single();
  if (clientRow?.name) clientName = clientRow.name;

  // ── 3. Fetch employees assigned to this engagement ────────
  const { data: imputaciones, error: impErr } = await supabase
    .from("employee_imputations")
    .select(
      `
      employee_id,
      start_date,
      end_date,
      weekly_hours,
      employees ( id, name, category, office )
    `
    )
    .eq("engagement_id", engagement.id);

  if (impErr) {
    return NextResponse.json(
      { error: `Error fetching imputaciones: ${impErr.message}` },
      { status: 500 }
    );
  }

  // ── 4. Group by employee ──────────────────────────────────
  type EmpRow = {
    id: string;
    name: string;
    category: string;
    office: string | null;
  };

  const employeeMap = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      office: string | null;
      imputaciones: {
        start_date: string;
        end_date: string | null;
        weekly_hours: number;
      }[];
    }
  >();

  type ImputacionWithEmployee = {
    employee_id: string;
    start_date: string;
    end_date: string | null;
    weekly_hours: number;
    employees: EmpRow[] | null;
  };

  for (const row of (imputaciones ?? []) as unknown as ImputacionWithEmployee[]) {
    const emp = row.employees?.[0] ?? null;
    if (!emp) continue;

    if (!employeeMap.has(emp.id)) {
      employeeMap.set(emp.id, {
        id: emp.id,
        name: emp.name,
        category: emp.category ?? "Staff",
        office: emp.office ?? null,
        imputaciones: [],
      });
    }

    employeeMap.get(emp.id)!.imputaciones.push({
      start_date: row.start_date,
      end_date: row.end_date,
      weekly_hours: row.weekly_hours,
    });
  }

  const employees = Array.from(employeeMap.values());

  // ── 5. Return response ────────────────────────────────────
  return NextResponse.json({
    engagement: {
      id: engagement.id,
      code: engagement.engagement_code,
      name: engagement.name,
      client_id: engagement.client_id,
      client_name: clientName,
      start_date: engagement.start_date,
      end_date: engagement.end_date,
      total_amount: engagement.total_amount,
      estimated_expenses: engagement.estimated_expenses,
    },
    employees,
  });
}
