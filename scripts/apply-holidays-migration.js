/**
 * scripts/apply-holidays-migration.js
 *
 * Applies the public_holidays migration to Supabase.
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/apply-holidays-migration.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL  = "https://dvyhsgxwirhumarwonrj.supabase.co";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌  Falta SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260513000002_public_holidays.sql"),
    "utf8"
  );

  console.log("Applying migration 20260513000002_public_holidays.sql …");

  const { error } = await supabase.rpc("exec_sql", { sql });

  if (error) {
    // exec_sql may not exist — fall back to splitting and running statements
    console.warn("exec_sql RPC not available, running statements individually…");
    await runStatements(sql);
  } else {
    console.log("✅ Migration applied successfully.");
  }
}

async function runStatements(sql) {
  // Split on semicolons that end a statement
  const stmts = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let ok = 0;
  for (const stmt of stmts) {
    const { error } = await supabase.rpc("exec_sql", { sql: stmt + ";" }).catch(() => ({ error: { message: "no exec_sql" } }));
    if (error && !error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
      console.error(`❌ Error on statement:\n${stmt}\n→ ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`✅ ${ok}/${stmts.length} statements processed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
