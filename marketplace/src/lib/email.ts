import { Resend } from "resend";

type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

type NotificationPayload = {
  to: string;
  name?: string | null;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const from = process.env.EMAIL_FROM || "Compass <notifications@example.com>";

function paragraphs(body: string) {
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 14px;color:#374151;line-height:1.6">${escapeHtml(line)}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function template({ heading, body, ctaLabel, ctaUrl }: NotificationPayload) {
  const cta = ctaLabel && ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:8px;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(ctaLabel)}</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
        <h1 style="margin:0 0 18px;color:#111827;font-size:24px">${escapeHtml(heading)}</h1>
        ${paragraphs(body)}
        ${cta}
      </div>
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px">Compass marketplace notification</p>
    </div>
  </body>
</html>`;
}

export async function sendEmail(payload: EmailPayload) {
  if (!resend) {
    console.warn("Email skipped: RESEND_API_KEY is not configured", {
      to: payload.to,
      subject: payload.subject,
    });
    return { sent: false, skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    if (result.error) {
      console.error("Email send failed:", result.error);
      return { sent: false, skipped: false, error: result.error };
    }

    return { sent: true, skipped: false, id: result.data?.id };
  } catch (error) {
    console.error("Email send failed:", error);
    return { sent: false, skipped: false, error };
  }
}

export async function sendNotificationEmail(payload: NotificationPayload) {
  const greeting = payload.name ? `Hi ${payload.name},\n\n` : "";
  return sendEmail({
    to: payload.to,
    subject: payload.subject,
    text: `${greeting}${payload.body}${payload.ctaUrl ? `\n\n${payload.ctaLabel || "Open"}: ${payload.ctaUrl}` : ""}`,
    html: template(payload),
  });
}

export async function notifyAdmin(subject: string, body: string, ctaUrl?: string) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn("Admin email skipped: ADMIN_NOTIFICATION_EMAIL is not configured", { subject });
    return { sent: false, skipped: true };
  }

  return sendNotificationEmail({
    to,
    subject,
    heading: subject,
    body,
    ctaLabel: ctaUrl ? "Review in admin" : undefined,
    ctaUrl,
  });
}

export async function sendSignupConfirmation(to: string, name?: string | null) {
  return sendNotificationEmail({
    to,
    name,
    subject: "Your Compass account is ready",
    heading: "Welcome to Compass",
    body: "Your account has been created successfully.\nYou can now sign in and continue exploring the marketplace.",
    ctaLabel: "Open Compass",
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`,
  });
}

export async function sendApprovalEmail(to: string, entity: string, name?: string | null, notes?: string | null) {
  return sendNotificationEmail({
    to,
    name,
    subject: `${entity} approved`,
    heading: `${entity} approved`,
    body: `Good news: your ${entity.toLowerCase()} has been approved.${notes ? `\n\nNotes: ${notes}` : ""}`,
  });
}

export async function sendRejectionEmail(to: string, entity: string, reason: string, name?: string | null) {
  return sendNotificationEmail({
    to,
    name,
    subject: `${entity} needs attention`,
    heading: `${entity} needs attention`,
    body: `Your ${entity.toLowerCase()} was not approved at this time.\n\nReason: ${reason}`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, name?: string | null) {
  return sendNotificationEmail({
    to,
    name,
    subject: "Reset your Compass password",
    heading: "Reset your password",
    body: "We received a request to reset your password. This link expires in one hour.\nIf you did not request this, you can ignore this email.",
    ctaLabel: "Reset password",
    ctaUrl: resetUrl,
  });
}

export async function sendTwoFactorCodeEmail(to: string, code: string, name?: string | null) {
  return sendNotificationEmail({
    to,
    name,
    subject: "Your Compass verification code",
    heading: "Verification code",
    body: `Use this code to finish signing in: ${code}\nThis code expires in 10 minutes.`,
  });
}
