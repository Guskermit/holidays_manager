/**
 * scripts/backfill-january-split.js
 *
 * 1) Recomputes vacation_balances from requests.
 * 2) For January-only requests still charged entirely to their own year
 *    (prev_year_days = 0), moves as many days as possible to year-1.
 *
 * Usage:
 *   node scripts/backfill-january-split.js --dry-run
 *   node scripts/backfill-january-split.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://dvyhsgxwirhumarwonrj.supabase.co";
let SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  const content = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  SERVICE_KEY = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
}
const DRY_RUN = process.argv.includes("--dry-run");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CATEGORY_DAYS = {
  Staff: 26, Senior: 26, Manager: 31, "Senior-Manager": 31,
  Externo: 22, Socio: 31, Intern: 0,
};

function isWeekend(d) { const x = d.getDay(); return x === 0 || x === 6; }
function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function countWorkingDays(start, end, holidays) {
  let n = 0;
  const cur = new Date(start); cur.setHours(0, 0, 0, 0);
  const endN = new Date(end); endN.setHours(0, 0, 0, 0);
  while (cur <= endN) {
    if (!isWeekend(cur) && !holidays.has(toDateString(cur))) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
function startsInJanuary(startDate) {
  return new Date(startDate + "T00:00:00").getMonth() === 0;
}

async function main() {
  // Holidays
  const { data: holidayRows } = await supabase.from("public_holidays").select("date, scope");
  const OFFICES = ["madrid", "barcelona", "valencia", "malaga", "zaragoza", "sevilla"];
  const national = (holidayRows || []).filter(r => r.scope === "national").map(r => r.date);
  const holidaysByOffice = {};
  for (const o of OFFICES) {
    holidaysByOffice[o] = new Set([
      ...national,
      ...(holidayRows || []).filter(r => r.scope === o).map(r => r.date),
    ]);
  }

  const { data: employees } = await supabase
    .from("employees").select("id, name, office, category, custom_vacation_days");
  const empMap = new Map((employees || []).map(e => [e.id, e]));

  const { data: catDays } = await supabase.from("category_vacation_days").select("category, vacation_days");
  const catOverrides = Object.fromEntries((catDays || []).map(r => [r.category, r.vacation_days]));

  const { data: balances } = await supabase
    .from("vacation_balances").select("id, employee_id, year, total_days, used_days, pending_days");

  const { data: requests } = await supabase
    .from("vacation_requests")
    .select("id, employee_id, start_date, end_date, days_requested, status, year, prev_year_days, is_bootcamp, is_medical_leave, is_other, created_at")
    .neq("status", "cancelled")
    .eq("is_bootcamp", false)
    .eq("is_medical_leave", false)
    .eq("is_other", false)
    .order("created_at", { ascending: true });

  // ── Step A: propose January splits ─────────────────────────────
  // Group January-only requests per employee, oldest first.
  // Simulate year-1 remaining (from recomputed base) to assign split.
  const janSplits = []; // { reqId, employeeId, year, prevDays, currentDays, days }

  const janByEmp = new Map();
  for (const req of requests || []) {
    if (!startsInJanuary(req.start_date)) continue;
    const endYear = new Date(req.end_date + "T00:00:00").getFullYear();
    if (endYear > req.year) continue; // cross-year handled elsewhere
    if ((req.prev_year_days || 0) > 0) continue; // already split
    if (!janByEmp.has(req.employee_id)) janByEmp.set(req.employee_id, []);
    janByEmp.get(req.employee_id).push(req);
  }

  for (const [empId, reqs] of janByEmp) {
    const emp = empMap.get(empId);
    if (!emp) continue;
    const office = emp.office || "madrid";
    const holidays = holidaysByOffice[office] || holidaysByOffice.madrid;
    const maxDays = emp.custom_vacation_days != null && emp.custom_vacation_days >= 0
      ? emp.custom_vacation_days
      : (catOverrides[emp.category] ?? CATEGORY_DAYS[emp.category] ?? CATEGORY_DAYS.Staff);

    // Base remaining for each year from stored balances (will recompute after splits too)
    const yearRemaining = new Map();
    const balFor = (y) => (balances || []).find(b => b.employee_id === empId && b.year === y);

    // Initial remaining: recompute from requests ignoring January split (prev=0) for base years
    // Simpler: use stored balance remaining as starting point for year-1 of each Jan request
    for (const req of reqs) {
      const prevYear = req.year - 1;
      const days = req.days_requested;

      if (!yearRemaining.has(prevYear)) {
        const b = balFor(prevYear);
        // remaining = total - used - pending, but Jan days currently sit on req.year
        // For prevYear we take its own balance remaining (days not yet moved)
        yearRemaining.set(prevYear, b ? b.total_days - b.used_days - b.pending_days : 0);
      }
      if (!yearRemaining.has(req.year)) {
        const b = balFor(req.year);
        yearRemaining.set(req.year, b ? b.total_days - b.used_days - b.pending_days : maxDays);
      }

      const prevLeft = Math.max(0, yearRemaining.get(prevYear));
      const prevDays = Math.min(prevLeft, days);
      const currentDays = days - prevDays;

      if (prevDays > 0 || days > 0) {
        janSplits.push({
          reqId: req.id,
          employeeId: empId,
          year: req.year,
          days,
          prevDays,
          currentDays,
          name: emp.name,
        });
        yearRemaining.set(prevYear, prevLeft - prevDays);
        yearRemaining.set(req.year, yearRemaining.get(req.year) - currentDays);
      }
    }
  }

  console.log(`=== January split proposals (${janSplits.length}) ===`);
  for (const s of janSplits) {
    console.log(`  ${s.name}: req=${s.reqId.slice(0, 8)} year=${s.year} days=${s.days} → prev=${s.prevDays} curr=${s.currentDays}`);
  }

  // ── Step B: apply prev_year_days updates ───────────────────────
  let splitUpdated = 0;
  for (const s of janSplits) {
    if (s.prevDays === 0) continue; // nothing to store (stays 0)
    if (DRY_RUN) { splitUpdated++; continue; }
    const { error } = await supabase
      .from("vacation_requests")
      .update({ prev_year_days: s.prevDays })
      .eq("id", s.reqId);
    if (error) console.error(`  Error updating ${s.reqId}: ${error.message}`);
    else splitUpdated++;
  }
  console.log(`\nRequests with prev_year_days set: ${splitUpdated}${DRY_RUN ? " (dry-run, not saved)" : ""}`);

  // ── Step C: recompute ALL balances with final splits ───────────
  const finalSplits = new Map(janSplits.filter(s => s.prevDays > 0).map(s => [s.reqId, s.prevDays]));
  // Include already-split requests
  for (const req of requests || []) {
    if ((req.prev_year_days || 0) > 0 && !finalSplits.has(req.id)) {
      finalSplits.set(req.id, req.prev_year_days);
    }
  }

  console.log(`\n=== Balance recompute (${DRY_RUN ? "DRY-RUN" : "APPLY"}) ===`);
  let updated = 0, unchanged = 0, errors = 0;

  for (const bal of balances || []) {
    const emp = empMap.get(bal.employee_id);
    if (!emp) continue;
    const office = emp.office || "madrid";
    const holidays = holidaysByOffice[office] || holidaysByOffice.madrid;
    const maxDays = emp.custom_vacation_days != null && emp.custom_vacation_days >= 0
      ? emp.custom_vacation_days
      : (catOverrides[emp.category] ?? CATEGORY_DAYS[emp.category] ?? CATEGORY_DAYS.Staff);

    let newUsed = 0, newPending = 0;
    for (const req of requests || []) {
      if (req.employee_id !== bal.employee_id) continue;
      const days = req.days_requested;
      const prevDays = Math.min(finalSplits.get(req.id) || 0, days);

      let daysForYear = 0;
      if (req.year === bal.year) daysForYear = days - prevDays;
      else if (req.year === bal.year + 1 && prevDays > 0) daysForYear = prevDays;
      else continue;
      if (daysForYear <= 0) continue;

      if (req.status === "approved") newUsed += daysForYear;
      else if (req.status === "pending") newPending += daysForYear;
    }

    const expectedTotal = maxDays;
    const usedChanged = bal.used_days !== newUsed;
    const pendingChanged = bal.pending_days !== newPending;
    const totalChanged = bal.total_days !== expectedTotal;
    if (!usedChanged && !pendingChanged && !totalChanged) { unchanged++; continue; }

    console.log(
      `  ${emp.name} (${bal.year}): used ${bal.used_days}→${newUsed}${usedChanged ? " *" : ""}, ` +
      `pending ${bal.pending_days}→${newPending}${pendingChanged ? " *" : ""}, ` +
      `total ${bal.total_days}→${expectedTotal}${totalChanged ? " *" : ""}`
    );

    if (!DRY_RUN) {
      const { error } = await supabase.from("vacation_balances")
        .update({
          ...(usedChanged && { used_days: newUsed }),
          ...(pendingChanged && { pending_days: newPending }),
          ...(totalChanged && { total_days: expectedTotal }),
        })
        .eq("id", bal.id);
      if (error) { console.error(`    Error: ${error.message}`); errors++; continue; }
    }
    updated++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Splits applied: ${splitUpdated}`);
  console.log(`  Balances updated: ${updated}, unchanged: ${unchanged}, errors: ${errors}`);
  if (DRY_RUN) console.log("  DRY RUN — no changes written.");
}

main().catch(e => { console.error(e); process.exit(1); });
