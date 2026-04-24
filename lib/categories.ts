export const CATEGORIES = ["Staff", "Senior", "Manager", "Senior-Manager", "Externo"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  Staff: "Staff",
  Senior: "Senior",
  Manager: "Manager",
  "Senior-Manager": "Senior Manager",
  Externo: "Externo",
};

/** Maximum vacation days per category per year */
export const CATEGORY_DAYS: Record<Category, number> = {
  Staff: 26,
  Senior: 26,
  Manager: 31,
  "Senior-Manager": 31,
  Externo: 22,
};

export const COMPANIES = [
  "Azertium",
  "Winning-Results",
  "RedCommerce",
  "Change the Block",
] as const;
export type Company = (typeof COMPANIES)[number];
