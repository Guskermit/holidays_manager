import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSettingsForm } from "@/components/admin/vacation-settings-form";
import { BackNav } from "@/components/back-nav";
import { CATEGORIES, CATEGORY_DAYS, type Category } from "@/lib/categories";
import { strings } from "@/lib/strings";
import type { HoursSettingsRow } from "@/app/main/admin/imputaciones/actions";

// Default hours fallback per category: [regular, summer]
const DEFAULT_HOURS: Record<Category, [number, number]> = {
  Staff: [42, 30],
  Senior: [42, 30],
  Manager: [29, 21],
  "Senior-Manager": [21, 15],
  Externo: [42, 30],
  Socio: [42, 30],
  Intern: [42, 30],
};

export default async function AdminVacationSettingsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") redirect("/main");

  // Read current vacation days settings from DB
  const { data: rows } = await supabase
    .from("category_vacation_days")
    .select("category, vacation_days");

  const currentDays = Object.fromEntries(
    CATEGORIES.map((cat) => {
      const row = (rows ?? []).find((r) => r.category === cat);
      return [cat, row?.vacation_days ?? CATEGORY_DAYS[cat]];
    })
  ) as Record<Category, number>;

  // Read current hours settings from DB
  const { data: hoursRows } = await supabase
    .from("engagement_hours_settings")
    .select("category, regular_hours, summer_hours");

  const currentHours = {} as Record<Category, { regular: number; summer: number }>;
  for (const cat of CATEGORIES) {
    const row = (hoursRows as HoursSettingsRow[] | null)?.find((r) => r.category === cat);
    const fallback = DEFAULT_HOURS[cat];
    currentHours[cat] = {
      regular: row?.regular_hours ?? fallback[0],
      summer: row?.summer_hours ?? fallback[1],
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.admin.vacationSettings.pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.admin.vacationSettings.pageSubtitle}
        </p>
      </div>
      <VacationSettingsForm currentDays={currentDays} currentHours={currentHours} />
    </div>
  );
}
