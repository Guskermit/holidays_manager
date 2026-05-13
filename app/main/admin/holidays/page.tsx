import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HolidaysManager } from "@/components/admin/holidays-manager";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function AdminHolidaysPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "super-admin") {
    redirect("/main");
  }

  const currentYear = new Date().getFullYear();

  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("id, date, name, scope")
    .order("date");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <BackNav />

      <div>
        <h1 className="text-2xl font-bold">{strings.admin.holidays.pageTitle}</h1>
        <p className="text-muted-foreground mt-1">{strings.admin.holidays.pageSubtitle}</p>
      </div>

      <HolidaysManager
        holidays={holidays ?? []}
        currentYear={currentYear}
      />
    </div>
  );
}
