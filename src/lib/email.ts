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
