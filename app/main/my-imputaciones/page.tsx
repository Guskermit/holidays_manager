import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { MyImputacionesTable } from "@/components/my-imputaciones-table";
import { getMyImputaciones } from "./actions";

export default async function MyImputacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const currentYear = params.year
    ? parseInt(params.year, 10)
    : new Date().getFullYear();

  const result = await getMyImputaciones(currentYear);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <BackNav />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Mis imputaciones</h1>
        <p className="text-muted-foreground">
          Vista general de tus engagements y ausencias planificadas.
          {result.data?.employeeName && (
            <> {result.data.employeeName} · </>
          )}
          <span className="font-medium">
            {result.data?.weeklyHoursTarget ?? 42}h/semana
          </span>
        </p>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <a
          href={`/main/my-imputaciones?year=${currentYear - 1}`}
          className="px-2 py-1 rounded text-xs hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {currentYear - 1}
        </a>
        <span className="text-sm font-semibold px-3 py-1 rounded bg-muted">
          {currentYear}
        </span>
        <a
          href={`/main/my-imputaciones?year=${currentYear + 1}`}
          className="px-2 py-1 rounded text-xs hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {currentYear + 1} →
        </a>
      </div>

      {result.error ? (
        <div className="rounded-xl border p-8 text-center">
          <p className="text-sm text-destructive">{result.error}</p>
        </div>
      ) : result.data ? (
        <MyImputacionesTable data={result.data} />
      ) : null}
    </div>
  );
}
