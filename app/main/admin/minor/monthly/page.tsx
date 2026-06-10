import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackNav } from "@/components/back-nav";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { strings } from "@/lib/strings";

type SummaryRow = {
  subprojectId: string;
  subprojectName: string;
  subprojectColor: string;
  employeesCount: number;
  monthlyHours: number[];
  quarterlyHours: number[];
  totalYearHours: number;
};

const MONTH_NAMES_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MONTH_NAMES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function getYearParamValue(value?: string): number {
  if (value && /^\d{4}$/.test(value)) return Number(value);
  const today = new Date();
  return today.getFullYear();
}

function getYearRange(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function monthIndexFromWeekStart(weekStart: string): number {
  const [year, month] = weekStart.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return -1;
  return month - 1;
}

export default async function MinorMonthlySummaryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: callerEmployee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!callerEmployee) redirect("/auth/login");
  if (callerEmployee.role !== "admin" && callerEmployee.role !== "super-admin") {
    redirect("/main");
  }

  const { data: callerProjects } = await supabase
    .from("employee_projects")
    .select("project_id")
    .eq("employee_id", callerEmployee.id);

  const callerProjectIds = (callerProjects ?? []).map((ep) => ep.project_id);

  let isMinorAdmin = false;
  if (callerProjectIds.length > 0) {
    const { data: minorProject } = await supabase
      .from("projects")
      .select("id_engagement")
      .in("id_engagement", callerProjectIds)
      .eq("is_minor", true)
      .maybeSingle();

    isMinorAdmin = !!minorProject;
  }

  if (!isMinorAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <BackNav />
        <p className="text-sm text-muted-foreground">{strings.minor.notMinorAdmin}</p>
      </div>
    );
  }

  const { year: yearParam } = await searchParams;
  const yearValue = getYearParamValue(yearParam);
  const { start, end } = getYearRange(yearValue);

  const [{ data: subprojects }, { data: hoursRows }] = await Promise.all([
    supabase
      .from("minor_subprojects")
      .select("id, name, color")
      .order("name"),
    supabase
      .from("minor_hours")
      .select("subproject_id, employee_id, hours, week_start")
      .gte("week_start", start)
      .lte("week_start", end),
  ]);

  const summaryMap = new Map<string, {
    monthlyHours: number[];
    employees: Set<string>;
  }>();

  for (const row of hoursRows ?? []) {
    if (!summaryMap.has(row.subproject_id)) {
      summaryMap.set(row.subproject_id, { monthlyHours: Array(12).fill(0), employees: new Set<string>() });
    }

    const current = summaryMap.get(row.subproject_id)!;
    const monthIndex = monthIndexFromWeekStart(row.week_start);
    if (monthIndex >= 0 && monthIndex < 12) {
      current.monthlyHours[monthIndex] += Number(row.hours);
    }
    current.employees.add(row.employee_id);
  }

  const subprojectLookup = new Map((subprojects ?? []).map((sp) => [sp.id, sp]));

  const summaryRows: SummaryRow[] = Array.from(summaryMap.entries())
    .map(([subprojectId, value]) => {
      const meta = subprojectLookup.get(subprojectId);
      const quarterlyHours = [
        value.monthlyHours[0] + value.monthlyHours[1] + value.monthlyHours[2],
        value.monthlyHours[3] + value.monthlyHours[4] + value.monthlyHours[5],
        value.monthlyHours[6] + value.monthlyHours[7] + value.monthlyHours[8],
        value.monthlyHours[9] + value.monthlyHours[10] + value.monthlyHours[11],
      ];
      const totalYearHours = value.monthlyHours.reduce((sum, hours) => sum + hours, 0);
      return {
        subprojectId,
        subprojectName: meta?.name ?? "Subproyecto",
        subprojectColor: meta?.color ?? "#6366f1",
        employeesCount: value.employees.size,
        monthlyHours: value.monthlyHours,
        quarterlyHours,
        totalYearHours,
      };
    })
    .sort((a, b) => b.totalYearHours - a.totalYearHours);

  const quarterTotals = summaryRows.reduce(
    (totals, row) => {
      for (let i = 0; i < 4; i += 1) totals[i] += row.quarterlyHours[i];
      return totals;
    },
    [0, 0, 0, 0] as number[]
  );

  const prevYear = yearValue - 1;
  const nextYear = yearValue + 1;

  return (
    <div className="flex flex-col gap-6">
      <BackNav />

      <div>
        <h1 className="text-2xl font-bold">{strings.minor.adminMonthlyTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{strings.minor.adminMonthlySubtitle}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" title={strings.minor.adminMonthlyPrevMonth}>
            <Link href={`/main/admin/minor/monthly?year=${prevYear}`}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <span className="text-base font-semibold min-w-[220px] text-center">
            {strings.minor.adminMonthlyMonthOf(String(yearValue))}
          </span>
          <Button asChild variant="outline" size="icon" title={strings.minor.adminMonthlyNextMonth}>
            <Link href={`/main/admin/minor/monthly?year=${nextYear}`}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {summaryRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.minor.adminMonthlyNoData}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3">{strings.minor.adminMonthlyColSubproject}</th>
                <th className="text-center font-medium px-3 py-3">{strings.minor.adminMonthlyColEmployees}</th>
                {MONTH_NAMES_SHORT.map((monthName, idx) => (
                  <th key={monthName} className="text-center font-medium px-3 py-3 whitespace-nowrap" title={MONTH_NAMES_LONG[idx]}>
                    {monthName}
                  </th>
                ))}
                {Array.from({ length: 4 }).map((_, idx) => (
                  <th key={`q-${idx + 1}`} className="text-center font-medium px-3 py-3 whitespace-nowrap">
                    {strings.minor.adminMonthlyQuarterLabel(idx + 1)}
                  </th>
                ))}
                <th className="text-center font-medium px-3 py-3">{strings.minor.adminMonthlyColTotalHours}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaryRows.map((row) => (
                <tr key={row.subprojectId} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: row.subprojectColor }}
                      />
                      {row.subprojectName}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">{row.employeesCount}</td>
                  {row.monthlyHours.map((monthHours, idx) => (
                    <td key={`${row.subprojectId}-${idx}`} className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                      {monthHours > 0 ? (monthHours % 1 === 0 ? monthHours : monthHours.toFixed(1)) : "—"}
                    </td>
                  ))}
                  {row.quarterlyHours.map((quarterHours, idx) => (
                    <td key={`${row.subprojectId}-q${idx + 1}`} className="px-3 py-3 text-center tabular-nums font-medium">
                      {quarterHours > 0 ? (quarterHours % 1 === 0 ? quarterHours : quarterHours.toFixed(1)) : "—"}
                      {quarterTotals[idx] > 0 && (
                        (() => {
                          const sharePct = (quarterHours / quarterTotals[idx]) * 100;
                          const over21 = (sharePct / 100) * 21;
                          return (
                            <>
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                {sharePct.toFixed(1)}%
                              </span>
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                {over21.toFixed(1)} / 21
                              </span>
                            </>
                          );
                        })()
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">
                    {row.totalYearHours % 1 === 0 ? row.totalYearHours : row.totalYearHours.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
