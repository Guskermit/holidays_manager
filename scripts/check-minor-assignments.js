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
  // Empleados que tienen horas en minor_hours
  const { data: hours } = await supabase
    .from("minor_hours")
    .select("employee_id")
    .order("employee_id");

  const empIds = [...new Set(hours.map((h) => h.employee_id))];
  console.log(`Empleados con horas importadas: ${empIds.length}`);

  // Datos de esos empleados
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email")
    .in("id", empIds);

  // Proyecto Minor
  const { data: minorProjects } = await supabase
    .from("projects")
    .select("id_engagement, name")
    .eq("is_minor", true);

  console.log("Proyecto(s) Minor:", minorProjects.map((p) => `${p.id_engagement} (${p.name})`).join(", "));

  const minorProjectIds = minorProjects.map((p) => p.id_engagement);

  // Asignaciones de esos empleados al proyecto Minor
  const { data: assignments } = await supabase
    .from("employee_projects")
    .select("employee_id, project_id")
    .in("employee_id", empIds)
    .in("project_id", minorProjectIds);

  const assignedSet = new Set((assignments || []).map((a) => a.employee_id));

  console.log(`\nEmpleados con horas y su asignación al proyecto Minor:`);
  for (const emp of employees) {
    const assigned = assignedSet.has(emp.id);
    console.log(`  ${assigned ? "✅" : "❌"}  ${emp.name.padEnd(30)} ${emp.email}`);
  }

  const missing = employees.filter((e) => !assignedSet.has(e.id));
  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} empleados SIN asignar al proyecto Minor.`);
    console.log("   La app no los mostrará hasta que estén en employee_projects.");
  } else {
    console.log("\n✅  Todos los empleados están asignados al proyecto Minor.");
  }
}

main().catch(console.error);
