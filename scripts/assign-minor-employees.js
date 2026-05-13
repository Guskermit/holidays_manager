const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: hours } = await supabase
    .from("minor_hours").select("employee_id");
  const empIds = [...new Set(hours.map((h) => h.employee_id))];

  const { data: minorProjects } = await supabase
    .from("projects").select("id_engagement").eq("is_minor", true);
  const minorProjectIds = minorProjects.map((p) => p.id_engagement);

  const { data: existing } = await supabase
    .from("employee_projects")
    .select("employee_id, project_id")
    .in("employee_id", empIds)
    .in("project_id", minorProjectIds);

  const existingSet = new Set((existing || []).map((a) => `${a.employee_id}|${a.project_id}`));

  const toInsert = [];
  for (const empId of empIds) {
    for (const projId of minorProjectIds) {
      if (!existingSet.has(`${empId}|${projId}`)) {
        toInsert.push({
          employee_id: empId,
          project_id: projId,
          assigned_at: "2026-02-02",
        });
      }
    }
  }

  if (toInsert.length === 0) {
    console.log("✅  Todos los empleados ya están asignados.");
    return;
  }

  console.log(`Asignando ${toInsert.length} empleado(s) al proyecto Minor…`);
  const { data: inserted, error } = await supabase
    .from("employee_projects")
    .upsert(toInsert, { onConflict: "employee_id,project_id", ignoreDuplicates: true })
    .select("employee_id");

  if (error) throw new Error(error.message);

  // Mostrar nombres
  const { data: employees } = await supabase
    .from("employees").select("id, name").in("id", toInsert.map((r) => r.employee_id));
  employees.forEach((e) => console.log(`  ✅  ${e.name}`));
  console.log(`\n✅  Listo. ${toInsert.length} asignaciones creadas.`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
