import nodemailer from "nodemailer";

function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) throw new Error("Email service not configured");
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });
}

const gmailFrom = () => `"Royals Zaika" <${process.env.GMAIL_USER}>`;

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  name,
}: {
  to: string;
  resetUrl: string;
  name: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: gmailFrom(),
    to,
    subject: "🔐 Royals Zaika — Password Reset Link",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#e5e5e5;border-radius:12px;overflow:hidden;border:1px solid #333;">
        <div style="background:linear-gradient(135deg,#f97316,#dc2626);padding:24px 32px;">
          <h1 style="margin:0;color:white;font-size:20px;">🍽️ Royals Zaika — Password Reset</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#e5e5e5;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
          <p style="color:#9ca3af;line-height:1.7;margin:0 0 24px;">
            Someone requested a password reset for your Royals Zaika account. 
            Click the button below to set a new password. This link is valid for <strong style="color:#f97316;">1 hour</strong> and can only be used once.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#dc2626);color:white;text-decoration:none;border-radius:10px;font-weight:bold;font-size:15px;">
              🔑 Reset My Password
            </a>
          </div>
          <p style="color:#6b7280;font-size:12px;line-height:1.6;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color:#f97316;word-break:break-all;">${resetUrl}</a>
          </p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px;">
            If you did not request this, you can safely ignore this email. Your password will not change.
          </p>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a2a;text-align:center;">
            <p style="color:#6b7280;font-size:11px;margin:0;">Royals Zaika Restaurant — Automated Security Email</p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendOTPEmail({
  to,
  otp,
  name,
}: {
  to: string;
  otp: string;
  name: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: gmailFrom(),
    to,
    subject: "📧 Royals Zaika — Email Verification OTP",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#e5e5e5;border-radius:12px;overflow:hidden;border:1px solid #333;">
        <div style="background:linear-gradient(135deg,#f97316,#dc2626);padding:24px 32px;">
          <h1 style="margin:0;color:white;font-size:20px;">🍽️ Royals Zaika — Email Verification</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#e5e5e5;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
          <p style="color:#9ca3af;line-height:1.7;margin:0 0 24px;">
            Use the OTP below to verify your recovery email address. Valid for <strong style="color:#f97316;">10 minutes</strong>.
          </p>
          <div style="text-align:center;margin:24px 0;background:#1e1e1e;border-radius:10px;padding:20px;">
            <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;">Your Verification OTP</p>
            <p style="margin:0;color:#f97316;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:8px;">${otp}</p>
          </div>
          <p style="color:#6b7280;font-size:12px;">
            Do not share this OTP with anyone. If you did not request this, ignore this email.
          </p>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a2a;text-align:center;">
            <p style="color:#6b7280;font-size:11px;margin:0;">Royals Zaika Restaurant — Account Security</p>
          </div>
        </div>
      </div>
    `,
  });
}
