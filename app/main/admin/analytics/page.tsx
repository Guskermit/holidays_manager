/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import {
  AnalyticsDashboard,
  type AnalyticsData,
} from "@/components/admin/analytics-dashboard";
import { StaleSkillsNotifier } from "@/components/admin/stale-skills-notifier";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin") redirect("/main");

  const [
    { data: employees },
    { data: projects },
    { data: empSkills },
    { data: vacRequests },
    { data: allSkillsDB },
  ] = await Promise.all([
    supabase.from("employees").select("id, category"),
    supabase
      .from("projects")
      .select("id_engagement, name, color, end_date, employee_projects(employee_id)")
      .order("name"),
    supabase.from("employee_skills").select("employee_id, skill_id, level, skills(id, name, category)"),
    supabase
      .from("vacation_requests")
      .select("status, days_requested, year, start_date"),
    supabase.from("skills").select("id, name, category").order("category, name"),
  ]);

  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Employees by category ──────────────────────────────────────
  const categoryCount = new Map<string, number>();
  for (const emp of employees ?? []) {
    const cat = (emp as any).category ?? "Sin categoría";
    categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }
  const categoryStats = [...categoryCount.entries()]
    .map(([cat, count]) => ({
      label: CATEGORY_LABELS[cat as Category] ?? cat,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Active projects + employees per project ────────────────────
  const allProjects: any[] = projects ?? [];
  const activeProjects = allProjects.filter(
    (p) => !p.end_date || new Date(p.end_date) >= today
  );

  const projectStats = activeProjects
    .map((p) => ({
      name: p.name as string,
      color: (p.color as string | null) ?? "#6366f1",
      count: ((p.employee_projects as any[]) ?? []).length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Top skills ─────────────────────────────────────────────────
  const skillCount = new Map<string, number>();
  for (const es of empSkills ?? []) {
    const name = (es as any).skills?.name as string | undefined;
    if (name) skillCount.set(name, (skillCount.get(name) ?? 0) + 1);
  }
  const topSkills = [...skillCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // ── Advanced skills analysis ───────────────────────────────────
  type LevelCounts = [number, number, number, number];
  interface SkillStats {
    name: string; category: string; count: number;
    levelCounts: LevelCounts; levelSum: number;
  }
  const skillStatsMap = new Map<string, SkillStats>();
  const empsByCategory = new Map<string, Set<string>>();

  for (const row of empSkills ?? []) {
    const skillInfo = (row as any).skills as { id: string; name: string; category: string } | null;
    if (!skillInfo) continue;
    const skillId = (row as any).skill_id as string;
    const empId = (row as any).employee_id as string;
    const level = Math.min(3, Math.max(0, ((row as any).level as number) ?? 0)) as 0|1|2|3;

    if (!skillStatsMap.has(skillId)) {
      skillStatsMap.set(skillId, { name: skillInfo.name, category: skillInfo.category, count: 0, levelCounts: [0,0,0,0], levelSum: 0 });
    }
    const s = skillStatsMap.get(skillId)!;
    s.count++;
    s.levelCounts[level]++;
    s.levelSum += level;

    if (!empsByCategory.has(skillInfo.category)) empsByCategory.set(skillInfo.category, new Set());
    empsByCategory.get(skillInfo.category)!.add(empId);
  }

  const skillsByCategoryDB = new Map<string, { id: string; name: string }[]>();
  for (const s of (allSkillsDB ?? []) as any[]) {
    if (!skillsByCategoryDB.has(s.category)) skillsByCategoryDB.set(s.category, []);
    skillsByCategoryDB.get(s.category)!.push({ id: s.id, name: s.name });
  }

  const skillsByCategory = [...skillsByCategoryDB.entries()]
    .map(([category, dbSkills]) => {
      const activeSkills = dbSkills
        .map((sk) => {
          const st = skillStatsMap.get(sk.id);
          return { name: sk.name, count: st?.count ?? 0, avgLevel: st ? st.levelSum / st.count : 0, levels: (st?.levelCounts ?? [0,0,0,0]) as LevelCounts };
        })
        .filter((sk) => sk.count > 0)
        .sort((a, b) => b.count - a.count);

      const empsInCat = empsByCategory.get(category)?.size ?? 0;
      let totalLvlSum = 0, totalAssign = 0;
      for (const sk of activeSkills) { totalLvlSum += sk.avgLevel * sk.count; totalAssign += sk.count; }

      return { category, employeeCount: empsInCat, avgLevel: totalAssign > 0 ? totalLvlSum / totalAssign : 0, totalSkillsInDB: dbSkills.length, skills: activeSkills };
    })
    .sort((a, b) => b.employeeCount - a.employeeCount);

  const uncoveredSkills = ((allSkillsDB ?? []) as any[])
    .filter((s) => !skillStatsMap.has(s.id) || skillStatsMap.get(s.id)!.count === 0)
    .map((s) => ({ name: s.name as string, category: s.category as string }));

  const allEmpIdsWithSkills = new Set<string>();
  for (const row of empSkills ?? []) allEmpIdsWithSkills.add((row as any).employee_id as string);
  const totalWithSkills = allEmpIdsWithSkills.size;

  // ── Vacation stats ─────────────────────────────────────────────
  const thisYearReqs: any[] = (vacRequests ?? []).filter(
    (r: any) => r.year === currentYear
  );
  const approvedReqs = thisYearReqs.filter((r) => r.status === "approved");
  const approvedDays = approvedReqs.reduce(
    (sum: number, r: any) => sum + (r.days_requested ?? 0),
    0
  );
  const pendingCount = thisYearReqs.filter((r: any) => r.status === "pending").length;

  // By status
  const statusMap = new Map<string, { count: number; days: number }>();
  for (const req of thisYearReqs) {
    const s = statusMap.get(req.status) ?? { count: 0, days: 0 };
    s.count++;
    s.days += req.days_requested ?? 0;
    statusMap.set(req.status, s);
  }
  const vacationByStatus = (
    ["approved", "pending", "rejected", "cancelled"] as const
  ).map((status) => ({
    status,
    label: {
      approved: "Aprobadas",
      pending: "Pendientes",
      rejected: "Rechazadas",
      cancelled: "Canceladas",
    }[status],
    count: statusMap.get(status)?.count ?? 0,
    days: statusMap.get(status)?.days ?? 0,
  }));

  // Monthly distribution of approved requests
  const MONTH_LABELS = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const monthlyApproved = MONTH_LABELS.map((label) => ({ label, count: 0 }));
  for (const req of approvedReqs) {
    if (req.start_date) {
      const month = new Date(req.start_date + "T00:00:00").getMonth();
      monthlyApproved[month].count++;
    }
  }

  const analyticsData: AnalyticsData = {
    kpis: {
      totalEmployees: (employees ?? []).length,
      activeProjects: activeProjects.length,
      approvedDaysThisYear: approvedDays,
      pendingRequests: pendingCount,
    },
    categoryStats,
    projectStats,
    topSkills,
    vacationByStatus,
    monthlyApproved,
    year: currentYear,
    skillsAnalysis: {
      byCategory: skillsByCategory,
      uncoveredSkills,
      totalWithSkills,
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen de datos del equipo y vacaciones · {currentYear}
        </p>
      </div>
      <AnalyticsDashboard data={analyticsData} />

      {/* ── Admin actions ── */}
      <div className="rounded-xl border p-6 flex flex-col gap-3">
        <h2 className="font-semibold">Notificaciones Slack</h2>
        <p className="text-sm text-muted-foreground">
          Envía un recordatorio a la persona responsable para todos los empleados que llevan más de un
          año sin actualizar sus skills (o que nunca los han registrado).
        </p>
        <StaleSkillsNotifier />
      </div>
    </div>
  );
}
