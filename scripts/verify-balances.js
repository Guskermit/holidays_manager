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

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function countWorkingDays(start, end, holidays) {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  while (current <= endNorm) {
    if (!isWeekend(current) && !holidays.has(toDateString(current))) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

async function main() {
  // 1. Holidays by office
  const { data: holidayRows } = await supabase
    .from("public_holidays")
    .select("date, scope");

  const OFFICES = ["madrid", "barcelona", "valencia", "malaga", "zaragoza", "sevilla"];
  const nationalDates = (holidayRows ?? [])
    .filter((r) => r.scope === "national")
    .map((r) => r.date);

  const holidaysByOffice = {};
  for (const office of OFFICES) {
    const officeDates = (holidayRows ?? [])
      .filter((r) => r.scope === office)
      .map((r) => r.date);
    holidaysByOffice[office] = new Set([...nationalDates, ...officeDates]);
  }

  // 2. Employees
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, office");

  const empMap = new Map();
  for (const emp of employees) empMap.set(emp.id, emp);

  // 3. Balances
  const { data: balances } = await supabase
    .from("vacation_balances")
    .select("id, employee_id, year, total_days, used_days, pending_days");

  // 4. Requests
  const { data: requests } = await supabase
    .from("vacation_requests")
    .select("id, employee_id, start_date, end_date, status, year, is_bootcamp, is_medical_leave, is_other")
    .not("status", "eq", "cancelled")
    .eq("is_bootcamp", false)
    .eq("is_medical_leave", false)
    .eq("is_other", false);

  // Build lookup
  const reqByEmpYear = new Map();
  for (const req of requests) {
    const key = `${req.employee_id}:${req.year}`;
    if (!reqByEmpYear.has(key)) reqByEmpYear.set(key, []);
    reqByEmpYear.get(key).push(req);
  }

  // 5. Verify each balance
  let ok = 0;
  let mismatch = 0;

  for (const bal of balances) {
    const emp = empMap.get(bal.employee_id);
    if (!emp) continue;

    const office = emp.office || "madrid";
    const holidays = holidaysByOffice[office] || holidaysByOffice["madrid"];
    const key = `${emp.id}:${bal.year}`;
    const empReqs = reqByEmpYear.get(key) || [];

    let expectedUsed = 0;
    let expectedPending = 0;

    for (const req of empReqs) {
      const start = new Date(req.start_date + "T00:00:00");
      const end = new Date(req.end_date + "T00:00:00");
      const days = countWorkingDays(start, end, holidays);

      if (req.status === "approved") expectedUsed += days;
      else if (req.status === "pending") expectedPending += days;
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
