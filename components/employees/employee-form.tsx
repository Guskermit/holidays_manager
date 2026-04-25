"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OFFICE_LABELS, type Office } from "@/lib/holidays";
import { CATEGORIES, CATEGORY_LABELS, COMPANIES, type Category } from "@/lib/categories";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { updateEmployee } from "@/app/main/employees/actions";

type Props = {
  employee: {
    id: string;
    name: string;
    email: string;
    office: string;
    role: string;
    category: string;
    company: string | null;
    cost_per_hour: number | null;
  };
};

const OFFICES = Object.entries(OFFICE_LABELS) as [Office, string][];
const ROLES = ["employee", "admin"] as const;

export function EmployeeForm({ employee }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(employee.office);
  const [selectedRole, setSelectedRole] = useState(employee.role);
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    (CATEGORIES as readonly string[]).includes(employee.category)
      ? (employee.category as Category)
      : "Staff"
  );
  const [selectedCompany, setSelectedCompany] = useState(employee.company ?? "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateEmployee(employee.id, formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
      {/* Name */}
      <div className="grid gap-2">
        <Label htmlFor="name">{strings.employees.formNameLabel}</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={employee.name}
        />
      </div>

      {/* Email — read-only, managed by auth */}
      <div className="grid gap-2">
        <Label htmlFor="email">{strings.employees.formEmailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={employee.email}
          readOnly
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          {strings.employees.formEmailReadOnly}
        </p>
      </div>

      {/* Office */}
      <div className="grid gap-3">
        <Label>{strings.employees.formOfficeLabel}</Label>
        <div className="flex flex-wrap gap-2">
          {OFFICES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedOffice(value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm border transition-colors",
                selectedOffice === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="office" value={selectedOffice} />
      </div>

      {/* Role */}
      <div className="grid gap-3">
        <Label>{strings.employees.formRoleLabel}</Label>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={cn(
                "px-4 py-2 rounded-full text-sm border transition-colors capitalize",
                selectedRole === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={selectedRole} />
      </div>

      {/* Category */}
      <div className="grid gap-3">
        <Label>{strings.employees.formCategoryLabel}</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setSelectedCategory(c); if (c !== "Externo") setSelectedCompany(""); }}
              className={cn(
                "px-4 py-2 rounded-full text-sm border transition-colors",
                selectedCategory === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <input type="hidden" name="category" value={selectedCategory} />
      </div>

      {/* Company (only for Externo) */}
      {selectedCategory === "Externo" && (
        <div className="grid gap-3">
          <Label>{strings.employees.formCompanyLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {COMPANIES.map((co) => (
              <button
                key={co}
                type="button"
                onClick={() => setSelectedCompany(co)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm border transition-colors",
                  selectedCompany === co
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-accent"
                )}
              >
                {co}
              </button>
            ))}
          </div>
          <input type="hidden" name="company" value={selectedCompany} />
        </div>
      )}

      {/* Cost per hour */}
      <div className="grid gap-2">
        <Label htmlFor="cost_per_hour">{strings.employees.formCostPerHourLabel}</Label>
        <Input
          id="cost_per_hour"
          name="cost_per_hour"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          defaultValue={employee.cost_per_hour ?? ""}
          className="max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">{strings.employees.formCostPerHourHint}</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? strings.common.saving : strings.common.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/main/employees")}
        >
          {strings.common.cancel}
        </Button>
      </div>
    </form>
  );
}
