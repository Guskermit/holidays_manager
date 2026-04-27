export const CATEGORIES = ["Staff", "Senior", "Manager", "Senior-Manager", "Externo", "Socio"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  Staff: "Staff",
  Senior: "Senior",
  Manager: "Manager",
  "Senior-Manager": "Senior Manager",
  Externo: "Externo",
  Socio: "Socio",
};

/** Default vacation days per category (used as fallback if DB is unavailable) */
export const CATEGORY_DAYS: Record<Category, number> = {
  Staff: 26,
  Senior: 26,
  Manager: 31,
  "Senior-Manager": 31,
  Externo: 22,
  Socio: 31,
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
] as const;
export type Company = (typeof COMPANIES)[number];
