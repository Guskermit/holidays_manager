import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkillsEditor } from "@/components/skills/skills-editor";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function SkillsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  // Resolve current employee
  const { data: employee } = await supabase
    .from("employees")
    .select("id, name")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{strings.skills.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{strings.vacations.noProfile}</p>
      </div>
    );
  }

  // Fetch all skills and this employee's selected skills in parallel
  const [{ data: allSkills }, { data: myLinks }] = await Promise.all([
    supabase.from("skills").select("id, name").order("name"),
    supabase
      .from("employee_skills")
      .select("skill_id")
      .eq("employee_id", employee.id),
  ]);

  const mySkillIds = new Set((myLinks ?? []).map((r) => r.skill_id));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.skills.pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.skills.pageSubtitle}
        </p>
      </div>

      <SkillsEditor
        allSkills={allSkills ?? []}
        mySkillIds={mySkillIds}
      />
    </div>
  );
}
