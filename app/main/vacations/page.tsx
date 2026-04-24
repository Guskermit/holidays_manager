import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VacationCalendar } from "@/components/vacations/vacation-calendar";
import { requestVacation } from "@/app/main/vacations/actions";
import { type Office } from "@/lib/holidays";
import { CATEGORY_DAYS, type Category } from "@/lib/categories";
import Link from "next/link";
import { LayoutListIcon } from "lucide-react";
import { BackNav } from "@/components/back-nav";

export default async function VacationsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, office, category")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Vacations</h1>
        <p className="text-sm text-muted-foreground">
          Your employee profile has not been set up yet. Please contact an administrator.
        </p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const maxDays = CATEGORY_DAYS[(employee.category as Category) ?? "Staff"] ?? 26;

  const { data: requests } = await supabase
    .from("vacation_requests")
    .select("id, start_date, end_date, days_requested, status, year")
    .eq("employee_id", employee.id)
    .order("start_date", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">My vacations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hi, {employee.name}. Select your vacation days below.
          </p>
        </div>
        <Link
          href="/main/vacations/summary"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LayoutListIcon className="size-4" />
          Team overview
        </Link>
      </div>

      <VacationCalendar
        employeeId={employee.id}
        office={(employee.office as Office) ?? "madrid"}
        requests={requests ?? []}
        maxDays={maxDays}
        onSubmit={requestVacation}
      />
    </div>
  );
}
