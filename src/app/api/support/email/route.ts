import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const OWNER_EMAIL = "harvanshchaurasia2@gmail.com";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, name, phone, email, userType, category, description, attachments } = body;

    if (!ticketId || !name || !phone || !email || !userType || !category || !description) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      console.error("❌ GMAIL_USER or GMAIL_APP_PASSWORD not set in .env.local");
      return NextResponse.json({ success: false, error: "Email service not configured" }, { status: 500 });
    }

    // Create transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const shortId = ticketId.split("-")[0].toUpperCase();

    // ── Email 1: Notify Owner ────────────────────────────────────────
    await transporter.sendMail({
      from: `"Royal Zaika Support" <${gmailUser}>`,
      to: OWNER_EMAIL,
      subject: `🎫 New Support Ticket #${shortId} — ${category}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #e5e5e5; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 24px 32px;">
            <h1 style="margin: 0; color: white; font-size: 22px;">🍽️ Royal Zaika — New Support Ticket</h1>
          </div>
          <div style="padding: 28px 32px;">
            <div style="background: #1e1e1e; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border-left: 4px solid #f97316;">
              <h2 style="margin: 0 0 4px; color: #f97316; font-size: 17px;">${category}</h2>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; font-family: monospace;">Ticket ID: ${ticketId}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #2a2a2a;">
                <td style="padding: 11px 0; color: #9ca3af; font-size: 13px; width: 130px;">👤 Name</td>
                <td style="padding: 11px 0; color: #e5e5e5; font-size: 13px; font-weight: bold;">${name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #2a2a2a;">
                <td style="padding: 11px 0; color: #9ca3af; font-size: 13px;">📱 Phone</td>
                <td style="padding: 11px 0; color: #e5e5e5; font-size: 13px;">${phone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #2a2a2a;">
                <td style="padding: 11px 0; color: #9ca3af; font-size: 13px;">📧 Email</td>
                <td style="padding: 11px 0; color: #e5e5e5; font-size: 13px;">${email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #2a2a2a;">
                <td style="padding: 11px 0; color: #9ca3af; font-size: 13px;">🏷️ User Type</td>
                <td style="padding: 11px 0; color: #e5e5e5; font-size: 13px; text-transform: capitalize;">${userType}</td>
              </tr>
              <tr>
                <td style="padding: 11px 0; color: #9ca3af; font-size: 13px;">📎 Attachments</td>
                <td style="padding: 11px 0; color: #e5e5e5; font-size: 13px;">${attachments?.length || 0} file(s)</td>
              </tr>
            </table>

            <div style="background: #1e1e1e; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Problem Description</p>
              <p style="margin: 0; color: #e5e5e5; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${description}</p>
            </div>

            ${attachments?.length > 0 ? `
            <div style="background: #1e1e1e; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Attachments</p>
              ${attachments.map((url: string, i: number) => `
                <a href="${url}" style="display: inline-block; margin: 4px 8px 4px 0; padding: 6px 14px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; font-size: 12px;">
                  📎 File ${i + 1}
                </a>`).join("")}
            </div>` : ""}

            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #2a2a2a; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">Royal Zaika Restaurant — Automated Support Notification</p>
            </div>
          </div>
        </div>
      `,
    });

    // ── Email 2: Auto-acknowledgement to User ────────────────────────
    await transporter.sendMail({
      from: `"Royal Zaika Support" <${gmailUser}>`,
      to: email,
      subject: `✅ Support Request Received — Ticket #${shortId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #e5e5e5; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 24px 32px;">
            <h1 style="margin: 0; color: white; font-size: 22px;">🍽️ Royal Zaika</h1>
          </div>
          <div style="padding: 28px 32px;">
            <h2 style="color: #22c55e; margin: 0 0 16px;">✅ Your request has been received!</h2>
            <p style="color: #e5e5e5; margin: 0 0 8px;">Hello <strong>${name}</strong>,</p>
            <p style="color: #9ca3af; line-height: 1.7; margin: 0 0 24px;">
              Your support request regarding <strong style="color: #f97316;">"${category}"</strong> has been successfully recorded.
              Our team will review it and get back to you shortly.
            </p>

            <div style="background: #1e1e1e; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; text-align: center;">
              <p style="margin: 0 0 6px; color: #9ca3af; font-size: 12px;">Your Ticket Reference</p>
              <p style="margin: 0; color: #f97316; font-family: monospace; font-size: 16px; font-weight: bold;">${ticketId}</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
              You can track the status of your ticket anytime from your profile page under the <strong>Support</strong> tab.
            </p>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #2a2a2a; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">Royal Zaika Restaurant — We're here to help! 🍽️</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log(`✅ Emails sent successfully for ticket ${ticketId}`);
    return NextResponse.json({ success: true, message: "Emails sent successfully" });

  } catch (error: any) {
    console.error("❌ Support Email API Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

