import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";
import { BackNav } from "@/components/back-nav";

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

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, email, office, role")
    .eq("id", id)
    .single();

  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">Edit employee</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update details for{" "}
          <span className="font-medium text-foreground">{employee.name}</span>.
        </p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  );
}
