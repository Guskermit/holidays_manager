/**
 * Slack notification utility — uses Incoming Webhooks (no SDK needed).
 *
 * Config (env vars):
 *   SLACK_WEBHOOK_URL        — team channel: vacation approved/rejected
 *   SLACK_WEBHOOK_ADMIN_URL  — admin channel: new requests + stale skills
 *                              falls back to SLACK_WEBHOOK_URL if not set
 */

const WEBHOOK_TEAM = process.env.SLACK_WEBHOOK_URL ?? "";
const WEBHOOK_ADMIN =
  process.env.SLACK_WEBHOOK_ADMIN_URL || process.env.SLACK_WEBHOOK_URL || "";

// ── Internal helper ───────────────────────────────────────────────────────────

async function post(
  webhookUrl: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  if (!webhookUrl) return; // silently skip when not configured
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
  } catch {
    // Never throw — Slack failures must not break the main request flow
  }
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Public notification functions ─────────────────────────────────────────────

/**
 * Notify admins when a new vacation request has been submitted.
 * Goes to the admin webhook (or falls back to team webhook).
 */
export async function notifyVacationRequested(params: {
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
}): Promise<void> {
  const { employeeName, startDate, endDate, days } = params;
  const text = `🗓️ Nueva solicitud de vacaciones de *${employeeName}*: ${fmtDate(startDate)} – ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""})`;
  await post(WEBHOOK_ADMIN, text, [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
  ]);
}

/**
 * Notify the team when a vacation request has been approved.
 * Goes to the team webhook.
 */
export async function notifyVacationApproved(params: {
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
}): Promise<void> {
  const { employeeName, startDate, endDate, days } = params;
  const text = `✅ Las vacaciones de *${employeeName}* han sido *aprobadas*: ${fmtDate(startDate)} – ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""})`;
  await post(WEBHOOK_TEAM, text, [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
  ]);
}

/**
 * Notify the team when a vacation request has been rejected.
 * Goes to the team webhook.
 */
export async function notifyVacationRejected(params: {
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}): Promise<void> {
  const { employeeName, startDate, endDate, reason } = params;
  const reasonText = reason ? `\nMotivo: _${reason}_` : "";
  const text = `❌ Las vacaciones de *${employeeName}* han sido *rechazadas*: ${fmtDate(startDate)} – ${fmtDate(endDate)}${reasonText}`;
  await post(WEBHOOK_TEAM, text, [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
  ]);
}

/**
 * Notify the team when an approved vacation has been cancelled.
 * Goes to the team webhook.
 */
export async function notifyVacationCancelled(params: {
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
}): Promise<void> {
  const { employeeName, startDate, endDate, days } = params;
  const text = `🚫 Las vacaciones de *${employeeName}* han sido *canceladas*: ${fmtDate(startDate)} – ${fmtDate(endDate)} (${days} día${days !== 1 ? "s" : ""})`;
  await post(WEBHOOK_TEAM, text, [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
  ]);
}

/**
 * Notify admins about employees whose skills profile is stale (>1 year) or empty.
 * Goes to the admin webhook.
 */
export async function notifyStaleSkills(
  staleEmployees: { name: string; email: string; daysSinceUpdate: number | null }[]
): Promise<void> {
  if (staleEmployees.length === 0) return;

  const lines = staleEmployees.map((e) => {
    const ago =
      e.daysSinceUpdate === null
        ? "nunca ha actualizado sus skills"
        : `no actualiza sus skills desde hace ${e.daysSinceUpdate} días`;
    return `• *${e.name}* (${e.email}) — ${ago}`;
  });

  const header = `⚠️ *${staleEmployees.length} empleado${staleEmployees.length !== 1 ? "s" : ""} con skills sin actualizar:*`;
  const text = [header, ...lines].join("\n");

  await post(WEBHOOK_ADMIN, text, [
    {
      type: "section",
      text: { type: "mrkdwn", text: header },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    },
  ]);
}
