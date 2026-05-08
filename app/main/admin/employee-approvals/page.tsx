import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { EmployeeApprovalsTable } from "@/components/admin/employee-approvals-table";

export default async function EmployeeApprovalsPage() {
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

  const { data: pending } = await supabase
    .from("employees")
    .select("id, name, email, category, office, company, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.admin.approvalsTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.admin.approvalsSubtitle}
        </p>
      </div>
      <EmployeeApprovalsTable employees={pending ?? []} />
    </div>
  );
}
