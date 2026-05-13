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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const unmatchedRaw = [
  "Sergio Castro", "Alejandro Vera", "Laura Gorrín", "Albert Espelt",
  "Eduardo Calvente", "Javier Bejarano", "Roberto Mateo", "Marcos Efrem",
  "Sergio Lopez", "Julen Galera", "David Fornós", "Andrea Sbrici",
  "Fiona Anglada", "Miguel Sepulveda", "Manuel Espinosa", "Gerard Lopez",
  "Agustin Varela", "Manuel Corral", "Carles Escuder", "Manuel Antonio Reino",
  "Marc Gol", "Asís Aristondo", "Almudena Cañete", "Óscar Nicolás",
  "Sara García", "Graciela Cornieles", "Manuel del Castillo",
  "Gabriel Alexander Contreras", "Montserrat Gordillo", "Nacho Canut",
  "Oscar Latorre", "Nuria Ibáñez", "Ònia Sanroma", "Pau Sorribes",
  "Pau Munne", "Manuel  Gonzalez", "Verónica De La Fuente", "Berta Guardia",
];

function norm(s) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const { data: emps } = await sb.from("employees").select("id, name, email");

  for (const raw of unmatchedRaw) {
    const rn = norm(raw);
    const words = rn.split(" ").filter((w) => w.length > 2);
    const matches = emps
      .filter((e) => {
        const en = norm(e.name);
        return words.some((w) => en.includes(w));
      })
      .slice(0, 4);
    const line = `"${raw}" => ${matches.length ? matches.map((e) => `"${e.name}" <${e.email}>`).join("  |  ") : "SIN MATCH"}`;
    console.log(line);
  }
}
main().catch(console.error);
