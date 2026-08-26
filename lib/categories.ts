export const CATEGORIES = ["Staff", "Senior", "Manager", "Senior-Manager", "Externo", "Socio", "Intern"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Category display order for sorting employees by role */
export const CATEGORY_SORT_ORDER: Record<string, number> = {
  "Senior-Manager": 0,
  Manager: 1,
  Senior: 2,
  Staff: 3,
  Externo: 4,
  Socio: 5,
  Intern: 6,
};

/** Sort employees by category role (Senior-Manager → Manager → Senior → Staff → Externo → Socio → Intern) */
export function sortEmployeesByCategory<T extends { category: string }>(employees: T[]): T[] {
  return [...employees].sort(
    (a, b) => (CATEGORY_SORT_ORDER[a.category] ?? 99) - (CATEGORY_SORT_ORDER[b.category] ?? 99)
  );
}

export const PREDEFINED_SPECIALIZATIONS = [
  "Product Owner",
  "FrontEnd",
  "BackEnd",
  "QA",
  "APP ANDROID",
  "APP IOS",
  "CONTENT",
  "MANAGEMENT",
  "MARKETING",
] as const;
export type Specialization = (typeof PREDEFINED_SPECIALIZATIONS)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  Staff: "Staff",
  Senior: "Senior",
  Manager: "Manager",
  "Senior-Manager": "Senior Manager",
  Externo: "Externo",
  Socio: "Socio",
  Intern: "Becario",
};

/** Default vacation days per category (used as fallback if DB is unavailable) */
export const CATEGORY_DAYS: Record<Category, number> = {
  Staff: 26,
  Senior: 26,
  Manager: 31,
  "Senior-Manager": 31,
  Externo: 22,
  Socio: 31,
  Intern: 0,
};

/**
 * Reads vacation days for a category from the DB.
 * Falls back to CATEGORY_DAYS if the DB row is missing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCategoryDays(supabase: any, category: string | null): Promise<number> {
  const cat = (CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as Category)
    : "Staff";
  const { data } = await supabase
    .from("category_vacation_days")
    .select("vacation_days")
    .eq("category", cat)
    .single();
  return data?.vacation_days ?? CATEGORY_DAYS[cat];
}

export const COMPANIES = [
  "Azertium",
  "Winning-Results",
  "RedCommerce",
  "Change the Block",
  "Plain Concepts",
] as const;
export type Company = (typeof COMPANIES)[number];

/** Ordered list of skill categories */
export const SKILL_CATEGORIES = [
  "Frontend",
  "Backend",
  "BBDD",
  "Infra/DevOps",
  "Arquitectura",
  "IA/Data",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
