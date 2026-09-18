/**
 * scripts/recalculate-balances.js
 *
 * Recalculates all vacation_balances (used_days, pending_days) for every employee
 * using the correct working-day count that excludes weekends + office holidays.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/recalculate-balances.js
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/recalculate-balances.js --dry-run
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://dvyhsgxwirhumarwonrj.supabase.co";

// Try to load SUPABASE_SERVICE_ROLE_KEY from .env.local if not in env
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
  console.error("Provide it via environment variable or add it to .env.local:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=eyJ...");
  console.error("");
  console.error("Usage:");
  console.error("  $env:SUPABASE_SERVICE_ROLE_KEY='eyJ...'; node scripts/recalculate-balances.js --dry-run");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Date helpers (mirroring lib/holidays.ts) ──────────────────────────

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

// ── Category defaults (mirroring lib/categories.ts) ───────────────────

const CATEGORY_DAYS = {
  Staff: 26,
  Senior: 26,
  Manager: 31,
  "Senior-Manager": 31,
  Externo: 22,
  Socio: 31,
  Intern: 0,
};

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== RECALCULATING BALANCES ===");
  console.log();

  // 1. Fetch all holidays grouped by office (single query)
  const { data: holidayRows, error: hErr } = await supabase
    .from("public_holidays")
    .select("date, scope");

  if (hErr) {
    console.error("Error fetching holidays:", hErr.message);
    process.exit(1);
  }

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
  console.log(`Loaded holidays: ${nationalDates.length} national, offices: ${Object.keys(holidaysByOffice).join(", ")}`);

  // 2. Fetch all category_vacation_days overrides
  const { data: catDays } = await supabase
    .from("category_vacation_days")
    .select("category, vacation_days");

  const categoryOverrides = {};
  for (const row of catDays ?? []) {
    categoryOverrides[row.category] = row.vacation_days;
  }
  console.log(`Category overrides: ${JSON.stringify(categoryOverrides)}`);

  // 3. Fetch all employees
  const { data: employees, error: eErr } = await supabase
    .from("employees")
    .select("id, name, office, category, custom_vacation_days");

  if (eErr) {
    console.error("Error fetching employees:", eErr.message);
    process.exit(1);
  }
  console.log(`Employees: ${employees.length}`);

  // 4. Fetch all balances
  const { data: balances, error: bErr } = await supabase
    .from("vacation_balances")
    .select("id, employee_id, year, total_days, used_days, pending_days");

  if (bErr) {
    console.error("Error fetching balances:", bErr.message);
    process.exit(1);
  }
  console.log(`Balances: ${balances.length}`);

  // 5. Fetch ALL relevant vacation requests (non-cancelled, non-bootcamp, non-medical, non-other)
  const { data: requests, error: rErr } = await supabase
    .from("vacation_requests")
    .select("id, employee_id, start_date, end_date, status, year, is_bootcamp, is_medical_leave, is_other")
    .not("status", "eq", "cancelled")
    .eq("is_bootcamp", false)
    .eq("is_medical_leave", false)
    .eq("is_other", false);

  if (rErr) {
    console.error("Error fetching requests:", rErr.message);
    process.exit(1);
  }
  console.log(`Active regular requests: ${requests.length}`);
  console.log();

  // Build lookup: employee_id → employee
  const empMap = new Map();
  for (const emp of employees) {
    empMap.set(emp.id, emp);
  }

  // Build lookup: employee_id → year → requests[]
  const reqByEmpYear = new Map();
  for (const req of requests) {
    const key = `${req.employee_id}:${req.year}`;
    if (!reqByEmpYear.has(key)) reqByEmpYear.set(key, []);
    reqByEmpYear.get(key).push(req);
  }

  // 6. Recalculate each balance
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const bal of balances) {
    const emp = empMap.get(bal.employee_id);
    if (!emp) {
      console.warn(`  [SKIP] Balance ${bal.id}: employee ${bal.employee_id} not found`);
      errors++;
      continue;
    }

    const office = emp.office || "madrid";
    const holidays = holidaysByOffice[office] || holidaysByOffice["madrid"];

    // Calculate expected total_days
    let expectedTotal;
    if (emp.custom_vacation_days != null && emp.custom_vacation_days >= 0) {
      expectedTotal = emp.custom_vacation_days;
    } else {
      const catOverride = categoryOverrides[emp.category];
      expectedTotal = catOverride ?? CATEGORY_DAYS[emp.category] ?? CATEGORY_DAYS["Staff"];
    }

    // Recalculate used_days and pending_days from requests
    const key = `${emp.id}:${bal.year}`;
    const empReqs = reqByEmpYear.get(key) || [];

    let newUsed = 0;
    let newPending = 0;

    for (const req of empReqs) {
      const start = new Date(req.start_date + "T00:00:00");
      const end = new Date(req.end_date + "T00:00:00");
      const days = countWorkingDays(start, end, holidays);

      if (req.status === "approved") {
        newUsed += days;
      } else if (req.status === "pending") {
        newPending += days;
      }
    }

    // Compare with current values
    const usedChanged = bal.used_days !== newUsed;
    const pendingChanged = bal.pending_days !== newPending;
    const totalChanged = bal.total_days !== expectedTotal;

    if (!usedChanged && !pendingChanged && !totalChanged) {
      unchanged++;
      continue;
    }

    const patch = {};
    if (usedChanged) patch.used_days = newUsed;
    if (pendingChanged) patch.pending_days = newPending;
    if (totalChanged) patch.total_days = expectedTotal;

    console.log(
      `  ${emp.name} (${bal.year}): ` +
      `used ${bal.used_days}→${newUsed}${usedChanged ? " *" : ""}, ` +
      `pending ${bal.pending_days}→${newPending}${pendingChanged ? " *" : ""}, ` +
      `total ${bal.total_days}→${expectedTotal}${totalChanged ? " *" : ""}`
    );

    if (!DRY_RUN) {
      const { error: updErr } = await supabase
        .from("vacation_balances")
        .update(patch)
        .eq("id", bal.id);

      if (updErr) {
        console.error(`    Error updating: ${updErr.message}`);
        errors++;
        continue;
      }
    }

    updated++;
  }

  console.log();
  console.log("=== SUMMARY ===");
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors/skipped: ${errors}`);
  if (DRY_RUN) {
    console.log();
    console.log("This was a DRY RUN. No changes were made.");
    console.log("Run without --dry-run to apply changes.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
