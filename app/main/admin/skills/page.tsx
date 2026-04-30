import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { SkillsManager } from "@/components/admin/skills-manager";
import { strings } from "@/lib/strings";
import { SKILL_CATEGORIES } from "@/lib/categories";

export default async function AdminSkillsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (emp?.role !== "admin" && emp?.role !== "super-admin") redirect("/main");

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, category")
    .order("category")
    .order("name");

  // Merge predefined categories with any custom ones already in DB
  const dbCategories = [...new Set((skills ?? []).map((s) => s.category))];
  const allCategories = [
    ...SKILL_CATEGORIES,
    ...dbCategories.filter((c) => !(SKILL_CATEGORIES as readonly string[]).includes(c)),
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.skills.adminPageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.skills.adminPageSubtitle}</p>
      </div>
      <SkillsManager skills={skills ?? []} categories={allCategories} />
    </div>
  );
}
