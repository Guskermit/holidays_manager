import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { OpportunityForm } from "@/components/pricing/opportunity-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditOpportunityPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") redirect("/main");

  const [{ data: opp }, { data: employees }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(`
        id, client, name, description, margin, start_date, end_date,
        opportunity_employees (
          employee_id, cost_per_hour, revenue_per_hour, hours
        )
      `)
      .eq("id", id)
      .single(),
    supabase.from("employees").select("id, name, email, category, cost_per_hour").order("name"),
  ]);

  if (!opp) notFound();

  const initial = {
    id: opp.id,
    client: opp.client,
    name: opp.name,
    description: opp.description ?? "",
    margin: opp.margin,
    startDate: opp.start_date,
    endDate: opp.end_date,
    employees: (opp.opportunity_employees as any[]).map((oe) => ({
      employeeId: oe.employee_id,
      costPerHour: oe.cost_per_hour,
      revenuePerHour: oe.revenue_per_hour ?? null,
      hours: (oe.hours ?? {}) as Record<string, number>,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.pricing.editTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.pricing.editSubtitle}</p>
      </div>
      <OpportunityForm allEmployees={(employees ?? []).map((e: any) => ({ ...e, costPerHour: e.cost_per_hour ?? null }))} initial={initial} />
    </div>
  );
}
