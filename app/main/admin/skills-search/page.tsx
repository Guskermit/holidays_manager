/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkillsSearch, type EmployeeRow, type ProjectItem, type SpecializationItem } from "@/components/admin/skills-search";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function AdminSkillsSearchPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") {
    redirect("/main");
  }

  // Fetch all skills, specializations, and employees in parallel
  const [
    { data: allSkills },
    { data: allSpecializations },
    { data: rawEmployees },
  ] = await Promise.all([
    supabase.from("skills").select("id, name").order("name"),
    supabase.from("specializations").select("id, name").order("name"),
    supabase
      .from("employees")
      .select(`
        id,
        name,
        email,
        category,
        employee_skills ( skill_id, level ),
        employee_specializations ( specialization_id ),
        employee_projects (
          projects (
            id_engagement,
            name,
            color,
            end_date
          )
        )
      `)
      .order("name"),
  ]);

  // Shape data for the client component
  const employees: EmployeeRow[] = (rawEmployees ?? []).map((emp: any) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    category: emp.category ?? null,
    skills: (emp.employee_skills ?? []).map((es: any) => ({
      skillId: es.skill_id as string,
      level: (es.level ?? 1) as number,
    })),
    specializationIds: (emp.employee_specializations ?? []).map(
      (es: any) => es.specialization_id as string
    ),
    projects: (emp.employee_projects ?? [])
      .map((ep: any) => ep.projects)
      .filter(Boolean)
      .map((p: any): ProjectItem => ({
        id_engagement: p.id_engagement,
        name: p.name,
        color: p.color ?? null,
        end_date: p.end_date ?? null,
      })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.skills.searchPageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.skills.searchPageSubtitle}
        </p>
      </div>

      <SkillsSearch allSkills={allSkills ?? []} allSpecializations={(allSpecializations ?? []) as SpecializationItem[]} employees={employees} />
    </div>
  );
}
