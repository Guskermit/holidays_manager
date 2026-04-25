"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { createProject, updateProject } from "@/app/main/projects/actions";
import { strings } from "@/lib/strings";

const COLOR_PALETTE = [
  { label: "Indigo",  value: "#6366f1" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Cyan",    value: "#06b6d4" },
  { label: "Emerald", value: "#10b981" },
  { label: "Lime",    value: "#84cc16" },
  { label: "Amber",   value: "#f59e0b" },
  { label: "Orange",  value: "#f97316" },
  { label: "Red",     value: "#ef4444" },
  { label: "Pink",    value: "#ec4899" },
  { label: "Purple",  value: "#a855f7" },
  { label: "Slate",   value: "#64748b" },
  { label: "Stone",   value: "#78716c" },
];

type Employee = {
  id: string;
  name: string;
  email: string;
};

type InitialValues = {
  idEngagement: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  iconUrl: string | null;
  assignedEmployeeIds: string[];
};

type Props = {
  employees: Employee[];
  initialValues?: InitialValues;
};

export function ProjectForm({ employees, initialValues }: Props) {
  const isEdit = !!initialValues;

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set(initialValues?.assignedEmployeeIds ?? [])
  );
  const [selectedColor, setSelectedColor] = useState(
    initialValues?.color ?? COLOR_PALETTE[0].value
  );
  const [iconPreview, setIconPreview] = useState<string | null>(
    initialValues?.iconUrl ?? null
  );
  const iconInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setIconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("color", selectedColor);
    selectedEmployees.forEach((id) => formData.append("employee_ids", id));

    const result = isEdit
      ? await updateProject(initialValues.idEngagement, formData)
      : await createProject(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">

      {/* Icon + color preview */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => iconInputRef.current?.click()}
          className="relative flex-shrink-0 size-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: iconPreview ? "transparent" : selectedColor + "33" }}
          title={strings.projects.formIconUploadTitle}
        >
          {iconPreview ? (
            <img src={iconPreview} alt={strings.projects.formIconAlt} className="size-full object-cover" />
          ) : (
            <span className="text-2xl" style={{ color: selectedColor }}>📁</span>
          )}
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{strings.projects.formIconLabel}</span>
          <span className="text-xs text-muted-foreground">
            {strings.projects.formIconHint}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 w-fit"
            onClick={() => iconInputRef.current?.click()}
          >
            {strings.projects.formIconChoose}
          </Button>
        </div>
        <input
          ref={iconInputRef}
          name="icon"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleIconChange}
        />
        <input
          type="hidden"
          name="existing_icon_url"
          value={initialValues?.iconUrl ?? ""}
        />
      </div>

      {/* Color picker */}
      <div className="grid gap-3">
        <Label>{strings.projects.formColorLabel}</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setSelectedColor(c.value)}
              className={cn(
                "size-8 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedColor === c.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {strings.projects.formColorSelected}{" "}
          <span
            className="inline-block size-3 rounded-full align-middle mr-1"
            style={{ backgroundColor: selectedColor }}
          />
          {COLOR_PALETTE.find((c) => c.value === selectedColor)?.label}
        </p>
        <input type="hidden" name="color" value={selectedColor} />
      </div>

      {/* ID Engagement — read-only in edit mode */}
      <div className="grid gap-2">
        <Label htmlFor="id_engagement">{strings.projects.formIdLabel}</Label>
        <Input
          id="id_engagement"
          name="id_engagement"
          placeholder={strings.projects.formIdPlaceholder}
          required
          defaultValue={initialValues?.idEngagement}
          readOnly={isEdit}
          className={cn(isEdit && "bg-muted cursor-not-allowed")}
        />
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            {strings.projects.formIdHint}
          </p>
        )}
      </div>

      {/* Project name */}
      <div className="grid gap-2">
        <Label htmlFor="name">{strings.projects.formNameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={strings.projects.formNamePlaceholder}
          required
          defaultValue={initialValues?.name}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="start_date">{strings.projects.formStartLabel}</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={initialValues?.startDate}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end_date">{strings.projects.formEndLabel}</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={initialValues?.endDate}
          />
        </div>
      </div>

      {/* Employee assignment */}
      <div className="grid gap-3">
        <Label>{strings.projects.formEmployeesLabel}</Label>
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.projects.formEmployeesEmpty}</p>
        ) : (
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 cursor-pointer"
                onClick={() => toggleEmployee(employee.id)}
              >
                <Checkbox
                  id={`emp-${employee.id}`}
                  checked={selectedEmployees.has(employee.id)}
                  onCheckedChange={() => toggleEmployee(employee.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{employee.name}</span>
                  <span className="text-xs text-muted-foreground">{employee.email}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedEmployees.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {strings.projects.formEmployeesCount(selectedEmployees.size)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? isEdit ? strings.common.saving : strings.projects.submitCreating
            : isEdit ? strings.common.save : strings.projects.submitCreate}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/main/projects")}>
          {strings.common.cancel}
        </Button>
      </div>
    </form>
  );
}
