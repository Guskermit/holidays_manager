"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { updateVacationSettings } from "@/app/main/admin/vacation-settings/actions";
import { strings } from "@/lib/strings";

type Props = {
  currentDays: Record<Category, number>;
};

export function VacationSettingsForm({ currentDays }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateVacationSettings(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
      <div className="rounded-md border divide-y">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center justify-between px-4 py-3 gap-4">
            <Label htmlFor={cat} className="text-sm font-medium w-40 shrink-0">
              {CATEGORY_LABELS[cat]}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={cat}
                name={cat}
                type="number"
                min={1}
                max={365}
                required
                defaultValue={currentDays[cat]}
                className="w-24 text-right"
              />
              <span className="text-sm text-muted-foreground shrink-0">
                {strings.admin.vacationSettings.daysSuffix}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {strings.admin.vacationSettings.saveSuccess}
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? strings.common.saving : strings.common.save}
        </Button>
      </div>
    </form>
  );
}
