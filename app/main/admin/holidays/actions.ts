"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type Office } from "@/lib/holidays";

type Scope = "national" | Office;

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.getClaims();
  if (error || !authData?.claims) return { supabase: null, error: "Unauthorized" };
  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();
  if (emp?.role !== "admin" && emp?.role !== "super-admin") return { supabase: null, error: "Forbidden" };
  return { supabase, error: null };
}

// ── Create ─────────────────────────────────────────────────────────────────────
export async function createHoliday(formData: FormData) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const date  = formData.get("date") as string;
  const name  = formData.get("name") as string;
  const scope = formData.get("scope") as string;

  if (!date || !name || !scope) return { error: "Datos incompletos" };

  const { error } = await supabase
    .from("public_holidays")
    .insert({ date, name, scope });

  if (error) return { error: error.message };
  revalidatePath("/main/admin/holidays");
  return { error: null };
}

// ── Update ─────────────────────────────────────────────────────────────────────
export async function updateHoliday(formData: FormData) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const id   = formData.get("id") as string;
  const date = formData.get("date") as string;
  const name = formData.get("name") as string;

  if (!id || !date || !name) return { error: "Datos incompletos" };

  const { error } = await supabase
    .from("public_holidays")
    .update({ date, name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/main/admin/holidays");
  return { error: null };
}

// ── Delete ─────────────────────────────────────────────────────────────────────
export async function deleteHoliday(id: string) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr };

  const { error } = await supabase
    .from("public_holidays")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/main/admin/holidays");
  return { error: null };
}

// ── Import from Nager.Date API ─────────────────────────────────────────────────
// Nager.Date is a free, open-source public holiday API (https://date.nager.at)
// No API key required. Returns national (Spain) holidays only.
// Regional/local holidays must be managed manually.

const NAGER_SCOPE_MAP: Record<string, Scope> = {
  national: "national",
};

export async function importHolidaysFromApi(year: number, scope: Scope) {
  const { supabase, error: authErr } = await requireAdmin();
  if (!supabase) return { error: authErr, imported: 0 };

  // Nager.Date only provides national-level holidays for ES
  if (scope !== "national") {
    return {
      error: "La API solo proporciona festivos nacionales. Los festivos por centro de trabajo deben gestionarse manualmente.",
      imported: 0,
    };
  }

  let apiData: { date: string; localName: string; name: string }[];
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    apiData = await res.json();
  } catch (e: unknown) {
    return { error: `Error al conectar con la API: ${e instanceof Error ? e.message : String(e)}`, imported: 0 };
  }

  // Filter to national-only (type === 'Public') and insert
  const rows = apiData
    .filter((h) => h.date && h.localName)
    .map((h) => ({ date: h.date, name: h.localName, scope: "national" }));

  if (rows.length === 0) return { error: "La API no devolvió festivos", imported: 0 };

  const { error, data } = await supabase
    .from("public_holidays")
    .upsert(rows, { onConflict: "date,scope", ignoreDuplicates: false })
    .select("id");

  if (error) return { error: error.message, imported: 0 };

  revalidatePath("/main/admin/holidays");
  return { error: null, imported: data?.length ?? rows.length };
}
