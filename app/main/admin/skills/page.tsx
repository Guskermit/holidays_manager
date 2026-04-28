import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { SkillsManager } from "@/components/admin/skills-manager";
import { strings } from "@/lib/strings";

export default async function AdminSkillsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin") redirect("/main");

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, category")
    .order("category")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.skills.adminPageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.skills.adminPageSubtitle}</p>
      </div>
      <SkillsManager skills={skills ?? []} />
    </div>
  );
}
