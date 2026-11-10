import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/employees/[email]/time-off
 *
 * Public (unsecured) endpoint.
 * Given an employee email, returns their time-off data for a given year:
 *   - vacations (approved + pending requests, with type)
 *   - official holidays (national + employee's office)
 *   - non-working days (holidays + approved time-off, weekends excluded)
 *
 * Query params:
 *   - year (optional) Defaults to the current year.
 *
 * Example:
 *   GET /api/employees/ana@acme.com/time-off?year=2026
 */

type VacationType = "vacation" | "bootcamp" | "medical_leave" | "other";

function vacationType(row: {
  is_bootcamp?: boolean;
  is_medical_leave?: boolean;
  is_other?: boolean;
}): VacationType {
  if (row.is_bootcamp) return "bootcamp";
  if (row.is_medical_leave) return "medical_leave";
  if (row.is_other) return "other";
  return "vacation";
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Inclusive list of YYYY-MM-DD dates between two dates, weekends excluded */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    const dateStr = current.toISOString().slice(0, 10);
    if (!isWeekend(dateStr)) dates.push(dateStr);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email).trim();

  if (!decodedEmail) {
    return NextResponse.json(
      { error: "Missing required path param: email" },
      { status: 400 }
    );
  }

  const yearParam = request.nextUrl.searchParams.get("year")?.trim();
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year param. Expected an integer between 2000 and 2100." },
      { status: 400 }
    );
  }

  // Public read-only — uses the anon key, relies on public RLS policies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // ── 1. Find the employee by email ─────────────────────────
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, name, email, office, category")
    .ilike("email", decodedEmail)
    .limit(1);

  if (empErr) {
    return NextResponse.json(
      { error: `Error fetching employee: ${empErr.message}` },
      { status: 500 }
    );
  }

  const employee = employees?.[0];
  if (!employee) {
    return NextResponse.json(
      { error: `Employee with email "${decodedEmail}" not found.` },
      { status: 404 }
    );
  }

  // ── 2. Fetch the employee's vacation requests ─────────────
  const { data: vacations, error: vacErr } = await supabase
    .from("vacation_requests")
    .select(
      "start_date, end_date, days_requested, status, is_bootcamp, is_medical_leave, is_other, year"
    )
    .eq("employee_id", employee.id)
    .eq("year", year)
    .in("status", ["approved", "pending"])
    .order("start_date", { ascending: true });

  if (vacErr) {
    return NextResponse.json(
      { error: `Error fetching vacations: ${vacErr.message}` },
      { status: 500 }
    );
  }

  // ── 3. Fetch official holidays (national + office) ────────
  const scopes = employee.office ? ["national", employee.office] : ["national"];
  const { data: holidays, error: holErr } = await supabase
    .from("public_holidays")
    .select("date, name, scope")
    .eq("year", year)
    .in("scope", scopes)
    .order("date", { ascending: true });

  if (holErr) {
    return NextResponse.json(
      { error: `Error fetching holidays: ${holErr.message}` },
      { status: 500 }
    );
  }

  // ── 4. Build non-working days (weekends excluded) ─────────
  const nonWorkingSet = new Set<string>();

  for (const holiday of holidays ?? []) {
    if (!isWeekend(holiday.date)) nonWorkingSet.add(holiday.date);
  }

  for (const vacation of vacations ?? []) {
    if (vacation.status !== "approved") continue;
    for (const date of dateRange(vacation.start_date, vacation.end_date)) {
      nonWorkingSet.add(date);
    }
  }

  // ── 5. Return response ────────────────────────────────────
  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      office: employee.office,
      category: employee.category,
    },
    year,
    vacations: (vacations ?? []).map((v) => ({
      start_date: v.start_date,
      end_date: v.end_date,
      days_requested: v.days_requested,
      status: v.status,
      type: vacationType(v),
    })),
    public_holidays: (holidays ?? []).map((h) => ({
      date: h.date,
      name: h.name,
      scope: h.scope,
    })),
    non_working_days: Array.from(nonWorkingSet).sort(),
  },{headers: { "Access-Control-Allow-Origin": "*" }}); // Cache for 1 hour
}
