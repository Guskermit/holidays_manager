"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { updateVacationSettings } from "@/app/main/admin/vacation-settings/actions";
import { updateHoursSettings } from "@/app/main/admin/imputaciones/actions";
import { strings } from "@/lib/strings";
import { ClockIcon, CalendarIcon } from "lucide-react";

type Props = {
  currentDays: Record<Category, number>;
  currentHours: Record<Category, { regular: number; summer: number }>;
};

export function VacationSettingsForm({ currentDays, currentHours }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const hoursFormRef = useRef<HTMLFormElement>(null);

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

  const handleHoursSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const settings = CATEGORIES.map((cat) => ({
        category: cat,
        regularHours: parseFloat(formData.get(`${cat}-regular`) as string) || 0,
        summerHours: parseFloat(formData.get(`${cat}-summer`) as string) || 0,
      }));
      const result = await updateHoursSettings(settings);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* ── Vacation Days Section ───────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CalendarIcon className="size-4" />
          {strings.admin.vacationSettings.vacationDaysSection}
        </h2>
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
                  min={0}
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
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? strings.common.saving : strings.common.save}
          </Button>
        </div>
      </form>

      {/* ── Imputation Hours Section ────────────────────── */}
      <form ref={hoursFormRef} onSubmit={handleHoursSubmit} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ClockIcon className="size-4" />
          {strings.admin.vacationSettings.hoursSection}
        </h2>
        <p className="text-sm text-muted-foreground">
          {strings.admin.vacationSettings.hoursSectionDesc}
        </p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">
                  {strings.admin.vacationSettings.categoryCol}
                </th>
                <th className="text-center px-4 py-2 font-medium">
                  {strings.admin.vacationSettings.regularHoursCol}
                </th>
                <th className="text-center px-4 py-2 font-medium">
                  {strings.admin.vacationSettings.summerHoursCol}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td className="px-4 py-3 font-medium">
                    {CATEGORY_LABELS[cat]}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Input
                        name={`${cat}-regular`}
                        type="number"
                        min={0}
                        max={60}
                        step={0.5}
                        required
                        defaultValue={currentHours[cat].regular}
                        className="w-20 text-center"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Input
                        name={`${cat}-summer`}
                        type="number"
                        min={0}
                        max={60}
                        step={0.5}
                        required
                        defaultValue={currentHours[cat].summer}
                        className="w-20 text-center"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? strings.common.saving : strings.common.save}
          </Button>
        </div>
      </form>

      {/* ── Messages ────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-destructive rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2">
          {strings.admin.vacationSettings.saveSuccess}
        </p>
      )}
    </div>
  );
}
