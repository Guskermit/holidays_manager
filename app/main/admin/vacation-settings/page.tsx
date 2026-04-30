import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationSettingsForm } from "@/components/admin/vacation-settings-form";
import { BackNav } from "@/components/back-nav";
import { CATEGORIES, CATEGORY_DAYS, type Category } from "@/lib/categories";
import { strings } from "@/lib/strings";

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

  // Read current settings from DB
  const { data: rows } = await supabase
    .from("category_vacation_days")
    .select("category, vacation_days");

  // Build a map with DB values, falling back to hardcoded defaults
  const currentDays = Object.fromEntries(
    CATEGORIES.map((cat) => {
      const row = (rows ?? []).find((r) => r.category === cat);
      return [cat, row?.vacation_days ?? CATEGORY_DAYS[cat]];
    })
  ) as Record<Category, number>;

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.admin.vacationSettings.pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.admin.vacationSettings.pageSubtitle}
        </p>
      </div>
      <VacationSettingsForm currentDays={currentDays} />
    </div>
  );
}
