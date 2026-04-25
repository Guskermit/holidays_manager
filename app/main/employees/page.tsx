import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { OFFICE_LABELS } from "@/lib/holidays";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";

export default async function EmployeesPage() {
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

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, office, role, created_at")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{strings.employees.listTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {strings.employees.listCount(employees?.length ?? 0)}
          </p>
        </div>
      </div>

      {employees && employees.length > 0 ? (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3">{strings.employees.colName}</th>
                <th className="text-left font-medium px-4 py-3">{strings.employees.colEmail}</th>
                <th className="text-left font-medium px-4 py-3">{strings.employees.colOffice}</th>
                <th className="text-left font-medium px-4 py-3">{strings.employees.colRole}</th>
                <th className="text-left font-medium px-4 py-3">{strings.employees.colJoined}</th>
                <th className="text-left font-medium px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {OFFICE_LABELS[emp.office as keyof typeof OFFICE_LABELS] ?? emp.office}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={emp.role === "admin" ? "default" : "secondary"}>
                      {emp.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(emp.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/main/employees/${emp.id}/edit`}>
                        <PencilIcon className="size-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">{strings.employees.empty}</p>
      )}
    </div>
  );
}
