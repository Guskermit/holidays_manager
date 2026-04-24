export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { BackNav } from "@/components/back-nav";

export default async function NewProjectPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") {
    redirect("/main");
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">New project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the details and assign team members.
        </p>
      </div>

      <ProjectForm employees={employees ?? []} />
    </div>
  );
}
