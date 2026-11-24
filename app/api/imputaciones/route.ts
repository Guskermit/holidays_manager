import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PUT /api/imputaciones
 *
 * Receives the weekly imputation file from the external console
 * ("consola-imputaciones/semanal") and upserts it into
 * employee_console_imputations, which feeds the employee dashboard
 * and the read-only admin grid.
 *
 * Auth: secret token in header `x-api-key: <token>` or
 * `Authorization: Bearer <token>` (env IMPUTACIONES_API_TOKEN).
 *
 * Semantics: week replacement per employee. For each (email, lunes)
 * present in the payload, existing rows for that employee and week
 * are deleted first, and replaced with the incoming engagements. Rows
 * for weeks or employees not present in the payload are left untouched.
 * Unknown emails / engagement codes are stored anyway and reported
 * as incidences (HTTP 207).
 *
 * Example:
 *   curl -X PUT https://host/api/imputaciones \
 *     -H "x-api-key: $IMPUTACIONES_API_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"formato":"consola-imputaciones/semanal","personas":[...]}'
 */

// ── Types ──────────────────────────────────────────────────

type PayloadEngagement = {
  engagement?: unknown;
  horas?: unknown;
};

type PayloadWeek = {
  semana?: unknown;
  lunes?: unknown;
  viernes?: unknown;
  engagements?: unknown;
};

type PayloadPerson = {
  email?: unknown;
  semanas?: unknown;
};

type Payload = {
  formato?: unknown;
  version?: unknown;
  generado?: unknown;
  fechaCorte?: unknown;
  redondeo?: unknown;
  personas?: unknown;
};

type ConsoleRow = {
  email: string;
  employee_id: string | null;
  engagement_code: string;
  semana: string;
  lunes: string;
  viernes: string;
  horas: number;
  formato: string | null;
  version: string | null;
  generado: string | null;
  fecha_corte: string | null;
  redondeo: number | null;
};

const UPSERT_CHUNK_SIZE = 500;

// ── CORS ───────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, status: number = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

/** Preflight for cross-origin browser calls. */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Auth helpers ───────────────────────────────────────────

function getProvidedToken(request: NextRequest): string | null {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (apiKey) return apiKey;

  const auth = request.headers.get("authorization")?.trim();
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

/** Constant-time token comparison (hashed to hide length). */
function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

// ── Validation helpers ─────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** Monday (YYYY-MM-DD) of the ISO week containing the given date. */
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function badRequest(error: string): NextResponse {
  return jsonResponse({ error }, 400);
}

// ── PUT ────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  // ── Token auth ───────────────────────────────────────────
  const expectedToken = process.env.IMPUTACIONES_API_TOKEN;
  if (!expectedToken) {
    return jsonResponse(
      { error: "Server misconfiguration: IMPUTACIONES_API_TOKEN is not set" },
      500
    );
  }

  const providedToken = getProvidedToken(request);
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // ── Parse body ───────────────────────────────────────────
  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.personas)) {
    return badRequest("Missing required field: personas (array)");
  }
  if (payload.personas.length === 0) {
    return badRequest("personas must not be empty");
  }

  const formato = typeof payload.formato === "string" ? payload.formato : null;
  const version = typeof payload.version === "string" ? payload.version : null;
  const generado = isValidTimestamp(payload.generado) ? payload.generado : null;
  const fechaCorte = isValidDateString(payload.fechaCorte) ? payload.fechaCorte : null;
  const redondeo = typeof payload.redondeo === "number" ? payload.redondeo : null;

  // ── Validate & flatten ───────────────────────────────────
  const rows: ConsoleRow[] = [];
  const emails: string[] = [];
  const engagementCodes: string[] = [];
  const weeksToDelete = new Map<string, Set<string>>();

  for (let p = 0; p < payload.personas.length; p++) {
    const person = payload.personas[p] as PayloadPerson;

    if (!person || typeof person !== "object") {
      return badRequest(`personas[${p}] must be an object`);
    }
    if (typeof person.email !== "string" || person.email.trim().length === 0) {
      return badRequest(`personas[${p}].email is required`);
    }
    if (person.semanas !== undefined && !Array.isArray(person.semanas)) {
      return badRequest(`personas[${p}].semanas must be an array`);
    }

    const email = person.email.trim().toLowerCase();
    emails.push(email);

    const semanas = Array.isArray(person.semanas) ? person.semanas : [];

    for (let w = 0; w < semanas.length; w++) {
      const week = semanas[w] as PayloadWeek;
      const path = `personas[${p}].semanas[${w}]`;

      if (!week || typeof week !== "object") {
        return badRequest(`${path} must be an object`);
      }
      if (typeof week.semana !== "string" || week.semana.trim().length === 0) {
        return badRequest(`${path}.semana is required`);
      }
      if (!Array.isArray(week.engagements)) {
        return badRequest(`${path}.engagements must be an array`);
      }

      // Canonical week key: explicit lunes if present, else Monday of the
      // ISO week containing `semana` (works for Friday or Saturday values).
      let lunes: string;
      if (week.lunes !== undefined) {
        if (!isValidDateString(week.lunes)) {
          return badRequest(`${path}.lunes must be a YYYY-MM-DD date`);
        }
        lunes = week.lunes;
      } else {
        if (!isValidDateString(week.semana)) {
          return badRequest(`${path}.semana must be a YYYY-MM-DD date when lunes is not provided`);
        }
        lunes = mondayOf(week.semana);
      }

      let viernes: string;
      if (week.viernes !== undefined) {
        if (!isValidDateString(week.viernes)) {
          return badRequest(`${path}.viernes must be a YYYY-MM-DD date`);
        }
        viernes = week.viernes;
      } else {
        viernes = addDays(lunes, 4);
      }

      let emailSet = weeksToDelete.get(lunes);
      if (!emailSet) {
        emailSet = new Set<string>();
        weeksToDelete.set(lunes, emailSet);
      }
      emailSet.add(email);

      for (let e = 0; e < week.engagements.length; e++) {
        const eng = week.engagements[e] as PayloadEngagement;
        const engPath = `${path}.engagements[${e}]`;

        if (!eng || typeof eng !== "object") {
          return badRequest(`${engPath} must be an object`);
        }
        if (typeof eng.engagement !== "string" || eng.engagement.trim().length === 0) {
          return badRequest(`${engPath}.engagement is required`);
        }
        if (typeof eng.horas !== "number" || Number.isNaN(eng.horas) || eng.horas < 0) {
          return badRequest(`${engPath}.horas must be a number >= 0`);
        }

        const engagementCode = eng.engagement.trim();
        engagementCodes.push(engagementCode);

        rows.push({
          email,
          employee_id: null, // resolved below
          engagement_code: engagementCode,
          semana: week.semana.trim(),
          lunes,
          viernes,
          horas: eng.horas,
          formato,
          version,
          generado,
          fecha_corte: fechaCorte,
          redondeo,
        });
      }
    }
  }

  // ── Supabase (service role — RLS bypassed after token check) ──
  const supabase = createServiceClient();
  if (!supabase) {
    return jsonResponse(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set" },
      500
    );
  }

  // ── Resolve emails → employee_id ─────────────────────────
  const uniqueEmails = [...new Set(emails)];
  const emailToId = new Map<string, string>();

  if (uniqueEmails.length > 0) {
    const { data: employees, error } = await supabase
      .from("employees")
      .select("id, email")
      .in("email", uniqueEmails);

    if (error) {
      return jsonResponse(
        { error: `Error looking up employees: ${error.message}` },
        500
      );
    }

    for (const emp of employees ?? []) {
      emailToId.set(emp.email.toLowerCase(), emp.id);
    }

    // Fallback for case differences not covered by the exact match
    const missing = uniqueEmails.filter((e) => !emailToId.has(e));
    for (const email of missing) {
      const { data } = await supabase
        .from("employees")
        .select("id, email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (data) emailToId.set(email, data.id);
    }
  }

  for (const row of rows) {
    row.employee_id = emailToId.get(row.email) ?? null;
  }

  // ── Known engagement codes (for reporting only) ──────────
  const uniqueCodes = [...new Set(engagementCodes)];
  const knownCodes = new Set<string>();
  if (uniqueCodes.length > 0) {
    const { data: engagements, error } = await supabase
      .from("engagements")
      .select("engagement_code")
      .in("engagement_code", uniqueCodes);

    if (error) {
      return jsonResponse(
        { error: `Error looking up engagements: ${error.message}` },
        500
      );
    }
    for (const eng of engagements ?? []) knownCodes.add(eng.engagement_code);
  }

  // ── Delete previous records for the arriving (email, lunes) weeks ──
  for (const [lunes, emailSet] of weeksToDelete.entries()) {
    const emailsForWeek = [...emailSet];
    for (let i = 0; i < emailsForWeek.length; i += 200) {
      const chunk = emailsForWeek.slice(i, i + 200);
      const { error: deleteError } = await supabase
        .from("employee_console_imputations")
        .delete()
        .eq("lunes", lunes)
        .in("email", chunk);

      if (deleteError) {
        return jsonResponse(
          { error: `Error deleting existing imputations: ${deleteError.message}` },
          500
        );
      }
    }
  }

  // ── Upsert in chunks ─────────────────────────────────────
  const rowMap = new Map<string, ConsoleRow>();
  for (const row of rows) {
    const key = `${row.email}|${row.lunes}|${row.engagement_code}`;
    rowMap.set(key, row);
  }
  const deduplicatedRows = [...rowMap.values()];

  for (let i = 0; i < deduplicatedRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = deduplicatedRows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from("employee_console_imputations")
      .upsert(chunk, {
        onConflict: "email,lunes,engagement_code",
        ignoreDuplicates: false,
      });

    if (error) {
      return jsonResponse(
        { error: `Error saving imputations: ${error.message}` },
        500
      );
    }
  }

  // ── Incidences (rows are stored regardless) ──────────────
  const emailsDesconocidos = uniqueEmails.filter((e) => !emailToId.has(e));
  const engagementsDesconocidos = uniqueCodes.filter((c) => !knownCodes.has(c));

  const incidencias = {
    emails_desconocidos: emailsDesconocidos,
    engagements_desconocidos: engagementsDesconocidos,
  };

  const hasIncidences =
    emailsDesconocidos.length > 0 || engagementsDesconocidos.length > 0;

  return jsonResponse(
    {
      status: hasIncidences ? "partial" : "ok",
      personas: payload.personas.length,
      filas: deduplicatedRows.length,
      incidencias,
    },
    hasIncidences ? 207 : 200
  );
}
