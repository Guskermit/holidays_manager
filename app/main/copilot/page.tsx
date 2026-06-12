import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { CopilotLicenseForm } from "@/components/copilot/copilot-license-form";

export default async function CopilotPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, has_copilot, copilot_engagement, copilot_clients")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <h1 className="text-2xl font-bold">{strings.copilot.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{strings.vacations.noProfile}</p>
      </div>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("name")
    .order("name", { ascending: true });

  const clientsFromProjects = (projects ?? [])
    .map((project) => project.name?.trim())
    .filter((label): label is string => Boolean(label));

  const clientOptions = Array.from(
    new Set([
      ...clientsFromProjects,
      ...(employee.copilot_clients ?? []),
    ])
  ).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.copilot.pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.copilot.pageSubtitle}</p>
      </div>

      <CopilotLicenseForm
        initialHasCopilot={employee.has_copilot}
        initialEngagement={employee.copilot_engagement ?? ""}
        initialClients={employee.copilot_clients ?? []}
        clientOptions={clientOptions}
      />
    </div>
  );
}
