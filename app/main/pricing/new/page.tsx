import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OpportunityForm } from "@/components/pricing/opportunity-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function NewOpportunityPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") redirect("/main");

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, category, cost_per_hour")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.pricing.newTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.pricing.newSubtitle}</p>
      </div>
      <OpportunityForm allEmployees={(employees ?? []).map((e) => ({ ...e, costPerHour: e.cost_per_hour ?? null }))} />
    </div>
  );
}
