/**
 * scripts/import-minor-hours.js
 *
 * Lee el Excel "Imputaciones NH 2026migracion.xlsx" y carga las horas de
 * TODOS los subproyectos en la tabla `minor_hours` de Supabase.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-minor-hours.js [--dry-run]
 */

const path = require("path");
const fs = require("fs");

// ── Cargar .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const i = t.indexOf("=");
    if (i === -1) return;
    const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  });
}
loadEnv();

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

// ── Config ────────────────────────────────────────────────────────────────────
const EXCEL_FILE = path.join(
  "/Users/Gustavo.LopezMartinez/Library/CloudStorage/OneDrive-EY/Documents/code/holidays_manager",
  "Imputaciones NH 2026migracion.xlsx"
);
const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) { console.error("❌  Falta NEXT_PUBLIC_SUPABASE_URL"); process.exit(1); }
if (!SERVICE_KEY)  { console.error("❌  Falta SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normaliza nombre de subproyecto: minúsculas, sin acentos, espacios simples, sin saltos
function normalizeSubprojectName(name) {
  return name
    .replace(/\r\n/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Normaliza nombre de empleado
function normalizeName(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Parsea week_start desde la celda A1 o nombre de hoja
function parseWeekStart(row0val, sheetName) {
  if (typeof row0val === "string") {
    const m = row0val.match(/(\d{2})\.(\d{2}).*del\s+(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const nm = sheetName.match(/^(\d{2})\.(\d{2})\.(\d{3,4})$/);
  if (nm) {
    const yyyy = nm[3].length === 3 ? "2" + nm[3] : nm[3];
    return `${yyyy}-${nm[2]}-${nm[1]}`;
  }
  return null;
}

// ── Constantes de mapeo ───────────────────────────────────────────────────────

// Columnas que no son subproyectos
const SKIP_NAMES = new Set(["beca", "horas totales"]);
const SKIP_COLS  = new Set([0, 1]); // col 0 = nombre, col 1 = Beca

// Diferencias tipográficas entre Excel y BD
const SUBPROJECT_NAME_MAP = {
  "s4hana": "s4hanna", // typo en BD tiene doble N
};

// Diferencias de nombre entre Excel y BD (empleados)
const EMPLOYEE_NAME_OVERRIDES = {
  // Mapeos originales
  "ahmed errahali":              "ahmed",
  "ana garcia":                  "ana garcia ruiz",
  "jessi ramirez gomez":         "jessi ramirez",
  // Nombres abreviados / sin apellido compuesto
  "alejandro vera":              "alejandro vera de salas",
  "eduardo calvente":            "edu calvente",
  "javier bejarano":             "javier bejaranno",       // typo en BD: doble n
  "roberto mateo":               "roberto mateo lopez",
  "marcos efrem":                "marcos efrem sanchez cornejo",
  "sergio lopez":                "sergio lopez belinchon",
  "julen galera":                "julen galera vitoria",
  "david fornos":                "david fornos sanz",
  "andrea sbrici":               "andrea sbirci",           // typo en Excel
  "miguel sepulveda":            "miguel sepulveda cabanas",
  "manuel espinosa":             "manel espinosa",
  "manuel corral":               "manu corral",
  "carles escuder":              "carles escuder folch",
  "manuel antonio reino":        "manuel antonio reino diez",
  "asis aristondo":              "asis aristondo muruaga",
  "almudena canete":             "almudena canete canton",
  "graciela cornieles":          "anyami graciela cornieles roa",
  "gabriel alexander contreras": "gabriel contreras",
  "montserrat gordillo":         "montserrat gordillo cumplido",
  "oscar latorre":               "oscar latorre labaila",
  "onia sanroma":                "onia sanroma mercade",
  "pau sorribes":                "pau sorribes ezcurra",
  "pau munne":                   "pau munne martinez",
  "veronica de la fuente":       "veronica de la fuente sisamon",
  "berta guardia":               "berta guardia sabartes",
};

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Cargar subproyectos de Supabase → mapa nombre_normalizado → id
  console.log("🔍  Cargando subproyectos desde Supabase…");
  const { data: dbSubprojects, error: spErr } = await supabase
    .from("minor_subprojects").select("id, name");
  if (spErr) throw new Error("Error cargando subproyectos: " + spErr.message);

  const subprojectMap = new Map(); // normalizedName → id
  for (const sp of dbSubprojects) {
    subprojectMap.set(normalizeSubprojectName(sp.name), sp.id);
  }
  console.log(`    ${dbSubprojects.length} subproyectos en BD`);

  // 2. Cargar empleados → mapa nombre_normalizado → id
  console.log("🔍  Cargando empleados desde Supabase…");
  const { data: employees, error: empErr } = await supabase
    .from("employees").select("id, name, email");
  if (empErr) throw new Error("Error cargando empleados: " + empErr.message);

  const employeeMap = new Map();
  for (const e of employees) employeeMap.set(normalizeName(e.name), e);
  console.log(`    ${employees.length} empleados en BD`);

  // 3. Leer Excel
  console.log("\n📂  Leyendo Excel…");
  const wb = XLSX.readFile(EXCEL_FILE);
  console.log(`    ${wb.SheetNames.length} hojas`);

  const rawEntries   = []; // { employee_id, subproject_id, week_start, hours }
  const seenWeeks    = new Set();
  const unmatchedSPs = new Set();
  const unmatchedEmps = new Map(); // raw name → Set of weeks
  const sheetSummary = [];

  for (const sheetName of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const weekStart = parseWeekStart(data[0] && data[0][0], sheetName);
    if (!weekStart) {
      console.warn(`  ⚠️  Sin fecha en "${sheetName}", saltando`);
      continue;
    }
    if (seenWeeks.has(weekStart)) continue;
    seenWeeks.add(weekStart);

    const headers = data[3] || [];

    // Construir mapa colIdx → subproject_id para esta hoja
    const colMap = new Map();
    for (let ci = 0; ci < headers.length; ci++) {
      if (SKIP_COLS.has(ci)) continue;
      const raw = headers[ci];
      if (!raw || typeof raw !== "string") continue;
      const normalized = normalizeSubprojectName(raw);
      if (SKIP_NAMES.has(normalized)) continue;
      const lookupKey = SUBPROJECT_NAME_MAP[normalized] ?? normalized;
      const spId = subprojectMap.get(lookupKey);
      if (spId) {
        colMap.set(ci, spId);
      } else {
        unmatchedSPs.add(normalized);
      }
    }

    let sheetCount = 0;
    for (let ri = 4; ri < data.length; ri++) {
      const row = data[ri];
      const empNameRaw = row && row[0];
      if (!empNameRaw || typeof empNameRaw !== "string") continue;
      const empKey = EMPLOYEE_NAME_OVERRIDES[normalizeName(empNameRaw)] ?? normalizeName(empNameRaw);
      const emp = employeeMap.get(empKey);
      if (!emp) {
        if (!unmatchedEmps.has(empNameRaw)) unmatchedEmps.set(empNameRaw, new Set());
        unmatchedEmps.get(empNameRaw).add(weekStart);
        continue;
      }

      for (const [ci, spId] of colMap) {
        const hours = typeof row[ci] === "number" ? row[ci] : 0;
        if (hours > 0) {
          rawEntries.push({
            employee_id:   emp.id,
            subproject_id: spId,
            week_start:    weekStart,
            hours,
            _empName: emp.name,
            _spName:  headers[ci],
          });
          sheetCount++;
        }
      }
    }
    sheetSummary.push({ sheetName, weekStart, cols: colMap.size, count: sheetCount });
  }

  // 4. Resumen de lectura
  console.log(`\n📊  Semanas: ${seenWeeks.size}  |  Registros con horas > 0: ${rawEntries.length}`);
  console.log("\n    Detalle por hoja:");
  sheetSummary.forEach(({ sheetName, weekStart, cols, count }) =>
    console.log(`    ${weekStart}  (${sheetName.padEnd(12)})  subproyectos=${cols}  registros=${count}`)
  );

  if (unmatchedSPs.size > 0) {
    console.log(`\n⚠️  Subproyectos del Excel sin match en BD (${unmatchedSPs.size}):`);
    [...unmatchedSPs].forEach((n) => console.log(`    - "${n}"`));
  }
  if (unmatchedEmps.size > 0) {
    console.log(`\n⚠️  Empleados del Excel sin match en BD (${unmatchedEmps.size}):`);
    for (const [name, weeks] of unmatchedEmps) {
      console.log(`    - "${name}"  (${weeks.size} semanas afectadas)`);
    }
  }

  if (DRY_RUN) {
    console.log("\n🧪  DRY RUN — no se escriben datos");
    const bySubproject = {};
    rawEntries.forEach(({ _spName }) => {
      const k = (_spName || "").replace(/\r\n/g, " ").slice(0, 40);
      bySubproject[k] = (bySubproject[k] || 0) + 1;
    });
    console.log("\n    Registros por subproyecto:");
    Object.entries(bySubproject).sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
    return;
  }

  if (rawEntries.length === 0) { console.log("\n⚠️  Nada que insertar."); return; }

  // 5. Upsert en batches
  console.log(`\n💾  Insertando ${rawEntries.length} registros…`);
  const upsertData = rawEntries.map(({ employee_id, subproject_id, week_start, hours }) =>
    ({ employee_id, subproject_id, week_start, hours })
  );

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < upsertData.length; i += BATCH) {
    const batch = upsertData.slice(i, i + BATCH);
    const { error } = await supabase.from("minor_hours")
      .upsert(batch, { onConflict: "employee_id,subproject_id,week_start" });
    if (error) throw new Error(`Error en upsert batch ${i / BATCH + 1}: ` + error.message);
    inserted += batch.length;
    process.stdout.write(`\r    Progreso: ${inserted}/${upsertData.length}`);
  }

  console.log(`\n\n✅  Completado. ${inserted} registros insertados/actualizados.`);

  // Resumen por subproyecto
  const bySubproject = {};
  rawEntries.forEach(({ _spName }) => {
    const k = (_spName || "").replace(/\r\n/g, " ").slice(0, 40);
    bySubproject[k] = (bySubproject[k] || 0) + 1;
  });
  console.log("\n📋  Registros por subproyecto:");
  Object.entries(bySubproject).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
}

main().catch((e) => { console.error("\n❌  Error:", e.message); process.exit(1); });
