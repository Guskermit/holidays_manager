import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { EngagementCalendar } from "@/components/admin/engagement-calendar";
import type {
  EngagementRow,
  EngagementEmployee,
  HoursSettingsRow,
} from "@/app/main/admin/imputaciones/actions";

export default async function EngagementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ engagementId: string }>;
  searchParams: Promise<{ employees?: string }>;
}) {
  const { engagementId } = await params;
  const { employees: empParam } = await searchParams;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (
    currentEmployee?.role !== "admin" &&
    currentEmployee?.role !== "super-admin"
  )
    redirect("/main");

  // Fetch engagement
  const { data: engData } = await supabase
    .from("engagements")
    .select("*")
    .eq("id", engagementId)
    .single();

  if (!engData) redirect("/main/admin/imputaciones");

  // Fetch client name
  const { data: clientData } = await supabase
    .from("projects")
    .select("name")
    .eq("id_engagement", engData.client_id)
    .single();

  const engagement: EngagementRow = {
    ...engData,
    client_name: clientData?.name ?? engData.client_id,
  };

  // Fetch employees — from query params (selected in manager) or from existing imputaciones
  const selectedEmpIds = empParam ? empParam.split(",").filter(Boolean) : [];

  let employees: EngagementEmployee[] = [];

  if (selectedEmpIds.length > 0) {
    // Fetch the selected employees directly
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name, category, office")
      .in("id", selectedEmpIds);

    employees = (emps ?? []).map((e: { id: string; name: string; category: string | null; office: string | null }) => ({
      id: e.id,
      name: e.name,
      category: e.category ?? "Staff",
      office: e.office ?? null,
    }));
  } else {
    // Fallback: fetch employees already assigned via imputaciones
    const { data: imps } = await supabase
      .from("employee_imputations")
      .select("employee_id, employees(id, name, category, office)")
      .eq("engagement_id", engagementId);

    const empMap = new Map<string, EngagementEmployee>();
    type ImpWithEmployee = { employee_id: string; employees: EngagementEmployee[] | null };
    for (const imp of (imps ?? []) as unknown as ImpWithEmployee[]) {
      const emp = imp.employees?.[0] ?? null;
      if (emp && !empMap.has(emp.id)) {
        empMap.set(emp.id, {
          id: emp.id,
          name: emp.name,
          category: emp.category ?? "Staff",
          office: emp.office ?? null,
        });
      }
    }
    employees = Array.from(empMap.values());
  }

  // Fetch existing imputaciones for this engagement
  const { data: existingImps } = await supabase
    .from("employee_imputations")
    .select("employee_id, start_date, end_date, weekly_hours")
    .eq("engagement_id", engagementId);

  // Fetch hours settings
  const { data: hoursRows } = await supabase
    .from("engagement_hours_settings")
    .select("category, regular_hours, summer_hours");

  // Fetch all holidays (national + office-specific) in the engagement date range
  const { data: holidayRows } = await supabase
    .from("public_holidays")
    .select("date, scope")
    .gte("date", engData.start_date ?? "2000-01-01")
    .lte("date", engData.end_date ?? "2099-12-31");

  // Group holidays by office: { madrid: [...], barcelona: [...], ... }
  const holidaysByOffice: Record<string, string[]> = {};
  for (const row of holidayRows ?? []) {
    const r = row as { date: string; scope: string };
    if (r.scope === "national") {
      // National holidays apply to all offices
      for (const office of ["madrid", "barcelona", "valencia", "malaga", "zaragoza", "sevilla"]) {
        if (!holidaysByOffice[office]) holidaysByOffice[office] = [];
        holidaysByOffice[office].push(r.date);
      }
    } else {
      if (!holidaysByOffice[r.scope]) holidaysByOffice[r.scope] = [];
      holidaysByOffice[r.scope].push(r.date);
    }
  }

  // Fetch approved vacations in the engagement date range
  const { data: vacationRows } = await supabase
    .from("vacation_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", engData.end_date ?? "2099-12-31")
    .gte("end_date", engData.start_date ?? "2000-01-01");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <EngagementCalendar
        engagement={engagement}
        employees={employees}
        existingImputaciones={(existingImps as { employee_id: string; start_date: string; end_date: string | null; weekly_hours: number }[]) ?? []}
        hoursSettings={(hoursRows as HoursSettingsRow[]) ?? []}
        holidaysByOffice={holidaysByOffice}
        vacations={(vacationRows as { employee_id: string; start_date: string; end_date: string }[]) ?? []}
      />
    </div>
  );
}
