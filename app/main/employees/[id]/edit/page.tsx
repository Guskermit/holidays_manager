import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (currentEmployee?.role !== "admin") {
    redirect("/main");
  }

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, name, email, office, role, category, company, cost_per_hour")
    .eq("id", id)
    .single();

  if (empError) console.error("[edit employee] query error:", empError.message, empError.code);
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">{strings.employees.editTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.employees.editSubtitle(employee.name)}
        </p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  );
}
