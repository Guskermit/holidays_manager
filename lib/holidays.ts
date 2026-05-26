export type Office = "madrid" | "barcelona" | "valencia" | "malaga" | "zaragoza" | "sevilla";

/**
 * Returns a Set of holiday strings "YYYY-MM-DD" for the given office,
 * reading from the `public_holidays` DB table (national + office-specific).
 *
 * Must be called server-side (uses Supabase server client).
 */
export async function getHolidaysForOfficeFromDB(
  office: Office,
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<Set<string>> {
  const { data } = await supabase
    .from("public_holidays")
    .select("date")
    .in("scope", ["national", office]);

  return new Set((data ?? []).map((r: { date: string }) => r.date));
}

/**
 * Returns a Record<office, string[]> with all holiday dates per office,
 * fetched in a single DB query.
 *
 * Must be called server-side (uses Supabase server client).
 */
export async function getAllOfficeHolidaysFromDB(
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<Record<string, string[]>> {
  const OFFICES: Office[] = ["madrid", "barcelona", "valencia", "malaga", "zaragoza", "sevilla"];
  const { data } = await supabase
    .from("public_holidays")
    .select("date, scope");

  const rows = data ?? [];
  const national = rows
    .filter((r: { date: string; scope: string }) => r.scope === "national")
    .map((r: { date: string }) => r.date);

  const result: Record<string, string[]> = {};
  for (const office of OFFICES) {
    const specific = rows
      .filter((r: { date: string; scope: string }) => r.scope === office)
      .map((r: { date: string }) => r.date);
    result[office] = [...national, ...specific];
  }
  return result;
}

/** True if the given date is a weekend */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** True if date is a holiday for the office */
export function isHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(toDateString(date));
}

/** True if date is a working day (not weekend, not holiday) */
export function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/** Count working days between two dates (inclusive) */
export function countWorkingDays(
  start: Date,
  end: Date,
  holidays: Set<string>
): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  while (current <= endNorm) {
    if (isWorkingDay(current, holidays)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const OFFICE_LABELS: Record<Office, string> = {
  madrid: "Madrid",
  barcelona: "Barcelona",
  valencia: "Valencia",
  malaga: "Málaga",
  zaragoza: "Zaragoza",
  sevilla: "Sevilla",
};
