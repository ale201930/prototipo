import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { to, subject, text } = await request.json();

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const secure = process.env.SMTP_SECURE !== "false"; // Default true for 465
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.warn("⚠️ SMTP credentials not found in env variables. Please add SMTP_USER and SMTP_PASS to .env.local to send real emails.");
      return NextResponse.json({
        success: false,
        message: "SMTP no configurado en .env.local. Por favor agregue SMTP_USER y SMTP_PASS.",
        simulated: true
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"INVECEM Corporación Socialista del Cemento" <${user}>`,
      to,
      subject,
      text,
      html: text.replace(/\n/g, "<br>")
    });

    console.log("📧 Real email sent successfully:", info.messageId);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("❌ Error in send-email API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
