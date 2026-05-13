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
  // 1. Contar registros en minor_hours
  const { count: hoursCount, error: e1 } = await supabase
    .from("minor_hours").select("*", { count: "exact", head: true });
  console.log("minor_hours total:", e1 ? "ERROR: " + e1.message : hoursCount);

  // 2. Listar subproyectos
  const { data: subs, error: e2 } = await supabase.from("minor_subprojects").select("id, name, active, color");
  console.log("minor_subprojects:", e2 ? "ERROR: " + e2.message : JSON.stringify(subs, null, 2));

  // 3. Muestra de minor_hours con nombre de empleado
  const { data: sample, error: e3 } = await supabase
    .from("minor_hours")
    .select("week_start, hours, employee_id, subproject_id")
    .order("week_start")
    .limit(10);
  console.log("\nPrimeros 10 registros en minor_hours:");
  if (e3) console.log("ERROR:", e3.message);
  else sample.forEach(r => console.log(` ${r.week_start}  emp=${r.employee_id.slice(0,8)}  h=${r.hours}`));

  // 4. Proyectos marcados como is_minor
  const { data: minorProj, error: e4 } = await supabase
    .from("projects").select("id_engagement, name, is_minor").eq("is_minor", true);
  console.log("\nProyectos is_minor=true:", e4 ? "ERROR: " + e4.message : JSON.stringify(minorProj));

  // 5. Columna is_minor existe?
  const { data: cols, error: e5 } = await supabase.rpc("sql", {
    query: "SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND column_name='weekly_hours'"
  }).maybeSingle();
  console.log("\nColumna employees.weekly_hours:", e5 ? "ERROR (puede no estar disponible vía RPC): " + e5.message : JSON.stringify(cols));
}

main().catch(console.error);
