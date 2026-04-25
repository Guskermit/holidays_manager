import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, PencilIcon } from "lucide-react";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { DeleteOpportunityButton } from "@/components/pricing/delete-opportunity-button";
import { DuplicateOpportunityButton } from "@/components/pricing/duplicate-opportunity-button";

export default async function PricingPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") redirect("/main");

  const { data: opportunities, error } = await supabase
    .from("opportunities")
    .select(`
      id, client, name, start_date, end_date, margin,
      opportunity_employees ( id )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-sm text-red-500">{strings.pricing.errorLoading(error.message)}</p>;
  }

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{strings.pricing.pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{strings.pricing.pageSubtitle}</p>
        </div>
        <Button asChild>
          <Link href="/main/pricing/new">
            <PlusIcon className="size-4 mr-1.5" />
            {strings.pricing.newButton}
          </Link>
        </Button>
      </div>

      {opportunities && opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.pricing.noOpportunities}</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3">{strings.pricing.colClient}</th>
                <th className="text-left font-medium px-4 py-3">{strings.pricing.colProject}</th>
                <th className="text-left font-medium px-4 py-3">{strings.pricing.colDates}</th>
                <th className="text-right font-medium px-4 py-3">{strings.pricing.colMargin}</th>
                <th className="text-right font-medium px-4 py-3">{strings.pricing.colTeamSize}</th>
                <th className="text-right font-medium px-4 py-3">{strings.pricing.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(opportunities ?? []).map((opp) => (
                <tr key={opp.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{opp.client}</td>
                  <td className="px-4 py-3">{opp.name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(opp.start_date)} → {formatDate(opp.end_date)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Badge variant="outline">{opp.margin}%</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {(opp.opportunity_employees as any[]).length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/main/pricing/${opp.id}`}>
                          <PencilIcon className="size-3.5 mr-1" />
                          {strings.common.edit}
                        </Link>
                      </Button>
                      <DuplicateOpportunityButton id={opp.id} />
                      <DeleteOpportunityButton id={opp.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
