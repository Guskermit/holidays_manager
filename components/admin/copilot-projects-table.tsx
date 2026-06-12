"use client";

import { useMemo, useState } from "react";
import { strings } from "@/lib/strings";

type EmployeeCopilotRow = {
  id: string;
  name: string;
  email: string;
  hasCopilot: boolean;
  engagement: string | null;
};

type ProjectCopilotGroup = {
  idEngagement: string;
  name: string;
  employees: EmployeeCopilotRow[];
};

type Props = {
  projects: ProjectCopilotGroup[];
};

type LicenseFilter = "all" | "with" | "without";
type SortBy = "employee" | "engagement";
type SortDirection = "asc" | "desc";

export function CopilotProjectsTable({ projects }: Props) {
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("employee");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredAndSortedProjects = useMemo(() => {
    const comparator = (a: EmployeeCopilotRow, b: EmployeeCopilotRow) => {
      const factor = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "employee") {
        return factor * a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }

      const aEng = (a.engagement ?? "").trim();
      const bEng = (b.engagement ?? "").trim();
      const emptyToEnd = (value: string) => (value ? value : "~~~~");
      return factor * emptyToEnd(aEng).localeCompare(emptyToEnd(bEng), "es", { sensitivity: "base" });
    };

    return projects
      .map((project) => {
        const filteredEmployees = project.employees.filter((emp) => {
          if (licenseFilter === "with") return emp.hasCopilot;
          if (licenseFilter === "without") return !emp.hasCopilot;
          return true;
        });

        return {
          ...project,
          employees: [...filteredEmployees].sort(comparator),
        };
      })
      .filter((project) => project.employees.length > 0);
  }, [projects, licenseFilter, sortBy, sortDirection]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
        <div className="grid gap-1.5">
          <label htmlFor="copilot-license-filter" className="text-xs font-medium text-muted-foreground">
            {strings.copilot.managerFilterLicenseLabel}
          </label>
          <select
            id="copilot-license-filter"
            value={licenseFilter}
            onChange={(e) => setLicenseFilter(e.target.value as LicenseFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{strings.copilot.managerFilterLicenseAll}</option>
            <option value="with">{strings.copilot.managerFilterLicenseWith}</option>
            <option value="without">{strings.copilot.managerFilterLicenseWithout}</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="copilot-sort-by" className="text-xs font-medium text-muted-foreground">
            {strings.copilot.managerSortByLabel}
          </label>
          <select
            id="copilot-sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="employee">{strings.copilot.managerSortByEmployee}</option>
            <option value="engagement">{strings.copilot.managerSortByEngagement}</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="copilot-sort-direction" className="text-xs font-medium text-muted-foreground">
            {strings.copilot.managerSortDirectionLabel}
          </label>
          <select
            id="copilot-sort-direction"
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as SortDirection)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="asc">{strings.copilot.managerSortDirectionAsc}</option>
            <option value="desc">{strings.copilot.managerSortDirectionDesc}</option>
          </select>
        </div>
      </div>

      {filteredAndSortedProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.copilot.managerEmpty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredAndSortedProjects.map((project) => (
            <section key={project.idEngagement} className="rounded-md border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40">
                <h2 className="font-semibold">{project.name}</h2>
                <p className="text-xs text-muted-foreground">{strings.copilot.managerProjectCount(project.employees.length)}</p>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left font-medium px-4 py-3">{strings.copilot.managerColEmployee}</th>
                    <th className="text-left font-medium px-4 py-3">{strings.copilot.managerColHasLicense}</th>
                    <th className="text-left font-medium px-4 py-3">{strings.copilot.managerColEngagement}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {project.employees.map((emp) => (
                    <tr key={`${project.idEngagement}-${emp.id}`} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {emp.hasCopilot ? strings.copilot.optionYes : strings.copilot.optionNo}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.engagement?.trim() || strings.common.noData}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
