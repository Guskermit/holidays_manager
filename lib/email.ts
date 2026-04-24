import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";

export async function sendVacationApprovedEmail(opts: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
}) {
  const { to, employeeName, startDate, endDate, daysRequested } = opts;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  await resend.emails.send({
    from: FROM,
    to,
    subject: "✅ Vacation request approved",
    html: `
      <p>Hi ${employeeName},</p>
      <p>Your vacation request has been <strong>approved</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">From</td><td><strong>${fmt(startDate)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">To</td><td><strong>${fmt(endDate)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Working days</td><td><strong>${daysRequested}</strong></td></tr>
      </table>
      <p>Enjoy your time off! 🌴</p>
    `,
  });
}

export async function sendVacationRejectedEmail(opts: {
  to: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string;
}) {
  const { to, employeeName, startDate, endDate, daysRequested, reason } = opts;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  await resend.emails.send({
    from: FROM,
    to,
    subject: "❌ Vacation request rejected",
    html: `
      <p>Hi ${employeeName},</p>
      <p>Unfortunately your vacation request has been <strong>rejected</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">From</td><td><strong>${fmt(startDate)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">To</td><td><strong>${fmt(endDate)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Working days</td><td><strong>${daysRequested}</strong></td></tr>
      </table>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>Please contact your manager if you have any questions.</p>
    `,
  });
}
