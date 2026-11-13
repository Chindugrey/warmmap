import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { from: string };
}) {
  const { identifier, url, provider } = params;
  if (!resend) {
    console.log("[Email not configured] Magic link for", identifier, url);
    return;
  }
  await resend.emails.send({
    from: provider.from,
    to: identifier,
    subject: "Sign in to your Warm Map",
    html: `<p>Click the link below to sign in to Warm Map:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendVouchCode(email: string, code: string, mapUrl: string) {
  if (!resend) {
    console.log(`[Email not configured] Vouch code for ${email}: ${code}`);
    return;
  }
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@warmmap.world",
    to: email,
    subject: "Your Warm Map vouch code",
    html: `<p>Someone named you in their Warm Map. To vouch back, use this code:</p><p style="font-size:24px;font-weight:bold">${code}</p><p>Or open: <a href="${mapUrl}">${mapUrl}</a></p>`,
  });
}

export async function sendVouchConfirmation(voucherEmail: string, ownerName?: string | null) {
  if (!resend) return;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@warmmap.world",
    to: voucherEmail,
    subject: "Your vouch was recorded",
    html: `<p>Thank you for vouching${ownerName ? ` for ${ownerName}` : ""}. Names are only stored when someone vouches back, so this confirmation is just for you.</p>`,
  });
}
