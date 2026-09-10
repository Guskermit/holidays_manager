import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { AdminEmployeeImputacionesView } from "@/components/admin/admin-employee-imputaciones-view";

export default async function AdminEmployeeImputacionesPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (
    currentEmployee?.role !== "admin" &&
    currentEmployee?.role !== "super-admin"
  )
    redirect("/main");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">
          {strings.admin.adminEmpImpTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.admin.adminEmpImpSubtitle}
        </p>
      </div>
      <AdminEmployeeImputacionesView />
    </div>
  );
}
