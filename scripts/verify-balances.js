/**
 * scripts/verify-balances.js
 *
 * Verifies that vacation_balances match the recalculated values from vacation_requests.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/verify-balances.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://dvyhsgxwirhumarwonrj.supabase.co";

let SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  const envPath = path.join(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    if (match) SERVICE_KEY = match[1].trim();
  }
}
if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Employees
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, office");

  const empMap = new Map();
  for (const emp of employees) empMap.set(emp.id, emp);

  // 2. Balances
  const { data: balances } = await supabase
    .from("vacation_balances")
    .select("id, employee_id, year, total_days, used_days, pending_days");

  // 3. Requests — use stored days_requested (same source the app charges on approve)
  const { data: requests } = await supabase
    .from("vacation_requests")
    .select("id, employee_id, start_date, end_date, days_requested, status, year, prev_year_days, is_bootcamp, is_medical_leave, is_other")
    .not("status", "eq", "cancelled")
    .eq("is_bootcamp", false)
    .eq("is_medical_leave", false)
    .eq("is_other", false);

  // 4. Verify each balance (split-aware for January requests)
  let ok = 0;
  let mismatch = 0;

  for (const bal of balances) {
    const emp = empMap.get(bal.employee_id);
    if (!emp) continue;

    let expectedUsed = 0;
    let expectedPending = 0;

    for (const req of requests) {
      if (req.employee_id !== bal.employee_id) continue;

      const days = req.days_requested;
      const prevDays = Math.min(req.prev_year_days || 0, days);

      let daysForYear = 0;
      if (req.year === bal.year) daysForYear = days - prevDays;
      else if (req.year === bal.year + 1 && prevDays > 0) daysForYear = prevDays;
      else continue;

      if (daysForYear <= 0) continue;
      if (req.status === "approved") expectedUsed += daysForYear;
      else if (req.status === "pending") expectedPending += daysForYear;
    }

    const usedOk = bal.used_days === expectedUsed;
    const pendingOk = bal.pending_days === expectedPending;

    if (usedOk && pendingOk) {
      ok++;
    } else {
      mismatch++;
      console.log(`  MISMATCH ${emp.name} (${bal.year}):`);
      if (!usedOk) console.log(`    used_days: ${bal.used_days} (stored) vs ${expectedUsed} (expected)`);
      if (!pendingOk) console.log(`    pending_days: ${bal.pending_days} (stored) vs ${expectedPending} (expected)`);
    }
  }

  console.log();
  console.log(`=== VERIFICATION RESULT ===`);
  console.log(`  OK: ${ok}/${balances.length}`);
  console.log(`  MISMATCH: ${mismatch}/${balances.length}`);

  if (mismatch === 0) {
    console.log("  All balances are correct!");
  } else {
    console.log("  Some balances still don't match. Check the output above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
