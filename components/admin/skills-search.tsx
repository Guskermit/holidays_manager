"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, XIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";

export type SkillItem = {
  id: string;
  name: string;
};

export type ProjectItem = {
  id_engagement: string;
  name: string;
  color: string | null;
  end_date: string | null;
};

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  category: string | null;
  skillIds: string[];
  projects: ProjectItem[];
};

type Props = {
  allSkills: SkillItem[];
  employees: EmployeeRow[];
};

export function SkillsSearch({ allSkills, employees }: Props) {
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearFilters = () => setSelectedSkillIds(new Set());

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const downloadCsv = () => {
    const headers = [
      strings.skills.searchColEmployee,
      "Email",
      strings.skills.searchColCategory,
      strings.skills.searchColProjects,
      strings.skills.searchColSkills,
    ];

    const rows = filteredEmployees.map((emp) => {
      const activeProjects = emp.projects
        .filter((p) => !p.end_date || new Date(p.end_date) >= new Date())
        .map((p) => p.name)
        .join(", ");
      const skillNames = allSkills
        .filter((s) => emp.skillIds.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      const category = emp.category
        ? (CATEGORY_LABELS[emp.category as Category] ?? emp.category)
        : "";
      return [
        escapeCsv(emp.name),
        escapeCsv(emp.email),
        escapeCsv(category),
        escapeCsv(activeProjects),
        escapeCsv(skillNames),
      ].join(",");
    });

    const csv = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skills-search-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter employees: must have ALL selected skills
  const filteredEmployees =
    selectedSkillIds.size === 0
      ? []
      : employees.filter((emp) =>
          [...selectedSkillIds].every((sid) => emp.skillIds.includes(sid))
        );

  const isFiltering = selectedSkillIds.size > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Skill filter pool */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{strings.skills.searchFilterLabel}</span>
            <span className="text-xs text-muted-foreground">{strings.skills.searchFilterHint}</span>
          </div>
          {selectedSkillIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon className="size-3.5 mr-1" />
              {strings.skills.searchClearFilters}
            </Button>
          )}
        </div>

        {allSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.skills.searchNoSkillsPool}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allSkills.map((skill) => {
              const selected = selectedSkillIds.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                      : "border-input hover:bg-accent hover:border-primary"
                  )}
                >
                  {selected && <CheckIcon className="size-3.5 shrink-0" />}
                  {skill.name}
                  {selected && <XIcon className="size-3 shrink-0 ml-0.5 opacity-70" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results */}
      {!isFiltering ? (
        <p className="text-sm text-muted-foreground">{strings.skills.searchNoFilters}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {strings.skills.searchResultsCount(filteredEmployees.length)}
          </p>

          {filteredEmployees.length > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <DownloadIcon className="size-3.5 mr-1.5" />
                {strings.skills.searchExportCsv}
              </Button>
            </div>
          )}

          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{strings.skills.searchNoResults}</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left font-medium px-4 py-3">{strings.skills.searchColEmployee}</th>
                    <th className="text-left font-medium px-4 py-3">{strings.skills.searchColCategory}</th>
                    <th className="text-left font-medium px-4 py-3">{strings.skills.searchColProjects}</th>
                    <th className="text-left font-medium px-4 py-3">{strings.skills.searchColSkills}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.map((emp) => {
                    const activeProjects = emp.projects.filter(
                      (p) => !p.end_date || new Date(p.end_date) >= new Date()
                    );
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">{emp.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {emp.category
                            ? CATEGORY_LABELS[emp.category as Category] ?? emp.category
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {activeProjects.length === 0 ? (
                            <span className="text-muted-foreground">{strings.skills.searchNoProjects}</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {activeProjects.map((p) => (
                                <span
                                  key={p.id_engagement}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border"
                                >
                                  <span
                                    className="size-2 rounded-full shrink-0"
                                    style={{ backgroundColor: p.color ?? "#6366f1" }}
                                  />
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {allSkills
                              .filter((s) => emp.skillIds.includes(s.id))
                              .map((s) => (
                                <Badge
                                  key={s.id}
                                  variant={selectedSkillIds.has(s.id) ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {s.name}
                                </Badge>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
