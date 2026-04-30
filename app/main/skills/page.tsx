import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkillsEditor } from "@/components/skills/skills-editor";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { getEffectiveEmployee } from "@/lib/impersonation";

export default async function SkillsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  // Resolve current employee
  const { data: realEmployee } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("user_id", authData.claims.sub)
    .single();

  const { effectiveId, isImpersonating } = await getEffectiveEmployee(supabase, {
    id: realEmployee?.id ?? "",
    role: realEmployee?.role ?? "employee",
  });

  const { data: employee } = isImpersonating
    ? await supabase.from("employees").select("id, name").eq("id", effectiveId).single()
    : { data: realEmployee };

  if (!employee) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{strings.skills.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{strings.vacations.noProfile}</p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    { data: allSkills },
    { data: myLinks },
    { data: allSpecializations },
    { data: mySpecLinks },
  ] = await Promise.all([
    supabase.from("skills").select("id, name, category").order("category").order("name"),
    supabase
      .from("employee_skills")
      .select("skill_id, level")
      .eq("employee_id", employee.id),
    supabase.from("specializations").select("id, name").order("name"),
    supabase
      .from("employee_specializations")
      .select("specialization_id")
      .eq("employee_id", employee.id),
  ]);

  const mySkills = (myLinks ?? []).map((r) => ({ skillId: r.skill_id, level: r.level as number }));
  const mySpecializationIds = new Set((mySpecLinks ?? []).map((r) => r.specialization_id as string));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.skills.pageTitle}</h1>
      </div>

      <SkillsEditor
        allSkills={allSkills ?? []}
        mySkills={mySkills}
        allSpecializations={allSpecializations ?? []}
        mySpecializationIds={mySpecializationIds}
      />
    </div>
  );
}
