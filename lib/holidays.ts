/**
 * Spanish public holidays for 2025 and 2026.
 * Sources: BOE (national), and each community's official gazette.
 *
 * Format: "YYYY-MM-DD"
 *
 * Offices supported: madrid | barcelona | valencia | malaga | zaragoza
 */

export type Office = "madrid" | "barcelona" | "valencia" | "malaga" | "zaragoza";

/** National holidays (all offices) */
const NATIONAL: string[] = [
  // 2025
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-08-15", // Asunción de la Virgen
  "2025-10-12", // Fiesta Nacional de España
  "2025-11-01", // Todos los Santos
  "2025-12-06", // Día de la Constitución
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01", // Año Nuevo
  "2026-01-06", // Reyes Magos
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-08-15", // Asunción de la Virgen
  "2026-10-12", // Fiesta Nacional de España
  "2026-11-01", // Todos los Santos
  "2026-12-06", // Día de la Constitución
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
  // 2027
  "2027-01-01", // Año Nuevo
  "2027-01-06", // Reyes Magos
  "2027-03-26", // Viernes Santo
  "2027-05-01", // Día del Trabajo
  "2027-08-15", // Asunción de la Virgen
  "2027-10-12", // Fiesta Nacional de España
  "2027-11-01", // Todos los Santos
  "2027-12-06", // Día de la Constitución
  "2027-12-08", // Inmaculada Concepción
  "2027-12-25", // Navidad
  // 2028
  "2028-01-01", // Año Nuevo
  "2028-01-06", // Reyes Magos
  "2028-04-14", // Viernes Santo
  "2028-05-01", // Día del Trabajo
  "2028-08-15", // Asunción de la Virgen
  "2028-10-12", // Fiesta Nacional de España
  "2028-11-01", // Todos los Santos
  "2028-12-06", // Día de la Constitución
  "2028-12-08", // Inmaculada Concepción
  "2028-12-25", // Navidad
];

/** Community of Madrid (national + autonómicos + locales Madrid capital) */
const MADRID_EXTRA: string[] = [
  // 2025
  "2025-03-21", // Jueves Santo
  "2025-05-02", // Fiesta de la Comunidad de Madrid
  "2025-11-10", // Almudena (local Madrid capital — lunes siguiente a 9 Nov)
  "2025-12-26", // puente
  // 2026
  "2026-03-19", // San José (Jueves Santo cae en 2 abr — se recupera)
  "2026-04-02", // Jueves Santo
  "2026-05-15", // San Isidro (patrón de Madrid)
  "2026-11-09", // Almudena
  // 2027
  "2027-03-25", // Jueves Santo
  "2027-05-03", // Fiesta de la Comunidad de Madrid (2 may cae domingo → lunes 3)
  "2027-11-09", // Almudena
  // 2028
  "2028-04-13", // Jueves Santo
  "2028-05-02", // Fiesta de la Comunidad de Madrid
  "2028-11-09", // Almudena
];

/** Cataluña (Barcelona) */
const BARCELONA_EXTRA: string[] = [
  // 2025
  "2025-04-21", // Lunes de Pascua
  "2025-06-24", // San Juan
  "2025-09-11", // Diada Nacional de Catalunya
  "2025-09-24", // La Mercè (local Barcelona)
  "2025-12-26", // San Esteban
  // 2026
  "2026-04-06", // Lunes de Pascua
  "2026-06-24", // San Juan
  "2026-09-11", // Diada Nacional de Catalunya
  "2026-09-24", // La Mercè
  "2026-12-26", // San Esteban
  // 2027
  "2027-03-29", // Lunes de Pascua
  "2027-06-24", // San Juan
  "2027-09-11", // Diada Nacional de Catalunya
  "2027-09-24", // La Mercè
  "2027-12-26", // San Esteban
  // 2028
  "2028-04-17", // Lunes de Pascua
  "2028-06-24", // San Juan
  "2028-09-11", // Diada Nacional de Catalunya
  "2028-09-24", // La Mercè
  "2028-12-26", // San Esteban
];

/** Comunitat Valenciana (Valencia) */
const VALENCIA_EXTRA: string[] = [
  // 2025
  "2025-03-19", // San José
  "2025-04-21", // Lunes de Pascua
  "2025-04-28", // día festivo local Valencia ciudad (festivitat del 9 d'Octubre cae domingo, se traslada)
  "2025-10-09", // Dia de la Comunitat Valenciana
  // 2026
  "2026-03-19", // San José
  "2026-04-06", // Lunes de Pascua
  "2026-10-09", // Dia de la Comunitat Valenciana
  // 2027
  "2027-03-19", // San José
  "2027-03-29", // Lunes de Pascua
  "2027-10-09", // Dia de la Comunitat Valenciana
  // 2028
  "2028-03-19", // San José
  "2028-04-17", // Lunes de Pascua
  "2028-10-09", // Dia de la Comunitat Valenciana
];

/** Aragón (Zaragoza) */
const ZARAGOZA_EXTRA: string[] = [
  // 2025 — autonómicos Aragón
  "2025-04-17", // Jueves Santo
  "2025-04-23", // San Jorge (Día de Aragón)
  "2025-10-13", // Pilar (12 oct domingo → lunes 13)
  // 2025 — locales Zaragoza capital
  "2025-01-27", // Santo Tomás de Aquino (local)
  // 2026 — autonómicos Aragón
  "2026-04-02", // Jueves Santo
  "2026-04-23", // San Jorge (Día de Aragón)
  "2026-10-12", // El Pilar (ya en nacionales; se mantiene)
  // 2026 — locales Zaragoza capital
  "2026-01-27", // Santo Tomás de Aquino (local)
  "2026-10-13", // Fiesta local Zaragoza (traslado)
  // 2027 — autonómicos Aragón
  "2027-03-25", // Jueves Santo
  "2027-04-23", // San Jorge (Día de Aragón)
  "2027-10-12", // El Pilar (ya en nacionales; se mantiene)
  // 2027 — locales Zaragoza capital
  "2027-01-27", // Santo Tomás de Aquino (local)
  // 2028 — autonómicos Aragón
  "2028-04-13", // Jueves Santo
  "2028-04-23", // San Jorge (Día de Aragón)
  "2028-10-12", // El Pilar (ya en nacionales; se mantiene)
  // 2028 — locales Zaragoza capital
  "2028-01-27", // Santo Tomás de Aquino (local)
];

/** Andalucía (Málaga) */
const MALAGA_EXTRA: string[] = [
  // 2025
  "2025-02-28", // Día de Andalucía
  "2025-04-17", // Jueves Santo
  "2025-08-19", // Feria de Málaga (local — lunes feria)
  // 2026
  "2026-02-28", // Día de Andalucía (sábado → lunes 2 mar)
  "2026-03-02", // traslado Día de Andalucía
  "2026-04-02", // Jueves Santo
  "2026-08-19", // Feria de Málaga
  // 2027
  "2027-02-28", // Día de Andalucía (domingo → lunes 1 mar)
  "2027-03-01", // traslado Día de Andalucía
  "2027-03-25", // Jueves Santo
  "2027-08-23", // Feria de Málaga (lunes feria)
  // 2028
  "2028-02-28", // Día de Andalucía
  "2028-04-13", // Jueves Santo
  "2028-08-19", // Feria de Málaga (lunes feria)
];

const OFFICE_HOLIDAYS: Record<Office, string[]> = {
  madrid: [...NATIONAL, ...MADRID_EXTRA],
  barcelona: [...NATIONAL, ...BARCELONA_EXTRA],
  valencia: [...NATIONAL, ...VALENCIA_EXTRA],
  malaga: [...NATIONAL, ...MALAGA_EXTRA],
  zaragoza: [...NATIONAL, ...ZARAGOZA_EXTRA],
};

/** Returns a Set of holiday strings "YYYY-MM-DD" for the given office (hardcoded fallback) */
export function getHolidaysForOffice(office: Office): Set<string> {
  return new Set(OFFICE_HOLIDAYS[office]);
}

/**
 * Returns a Set of holiday strings "YYYY-MM-DD" for the given office,
 * reading from the `public_holidays` DB table (national + office-specific).
 * Falls back to the hardcoded list if the DB returns nothing.
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

  if (!data || data.length === 0) {
    // Fallback to hardcoded list
    return getHolidaysForOffice(office);
  }
  return new Set(data.map((r: { date: string }) => r.date));
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
};
