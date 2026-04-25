import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

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
        <h1 className="text-2xl font-bold">{strings.projects.newTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.projects.newSubtitle}
        </p>
      </div>

      <ProjectForm employees={employees ?? []} />
    </div>
  );
}
