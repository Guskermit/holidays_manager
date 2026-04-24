"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OFFICE_LABELS, type Office } from "@/lib/holidays";
import { cn } from "@/lib/utils";
import { updateEmployee } from "@/app/main/employees/actions";

type Props = {
  employee: {
    id: string;
    name: string;
    email: string;
    office: string;
    role: string;
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
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={employee.name}
        />
      </div>

      {/* Email — read-only, managed by auth */}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={employee.email}
          readOnly
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          Email is managed by the authentication system and cannot be changed here.
        </p>
      </div>

      {/* Office */}
      <div className="grid gap-3">
        <Label>Office</Label>
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
        <Label>Role</Label>
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/main/employees")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
