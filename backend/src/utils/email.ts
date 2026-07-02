import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.user) {
    logger.warn("SMTP not configured — emails will be logged to console only");
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    logger.info("SMTP transport created", { host: config.smtp.host, port: config.smtp.port });
    return transporter;
  } catch (error) {
    logger.error("Failed to create SMTP transport", { error });
    return null;
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();

  if (!t) {
    logger.info("Email (logged — no SMTP):", { to, subject, body: html.slice(0, 300) });
    return;
  }

  try {
    await t.sendMail({
      from: config.smtp.from || `"ai for all" <${config.smtp.user}>`,
      to,
      subject,
      html,
    });
    logger.info("Email sent", { to, subject });
  } catch (error) {
    logger.error("Failed to send email", { to, subject, error });
    // Fallback: log to console so dev isn't blocked
    logger.info("Email fallback (logged):", { to, subject, body: html.slice(0, 300) });
  }
}

export function buildEmailHtml(title: string, body: string, cta?: { text: string; url: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 24px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 32px 24px 8px; text-align: center;">
              <h1 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0;">ai for all</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0 0 12px;">${title}</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #666; margin: 0;">${body}</p>
            </td>
          </tr>
          ${cta ? `
          <tr>
            <td style="padding: 8px 24px 32px; text-align: center;">
              <a href="${cta.url}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">${cta.text}</a>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; margin: 0;">ai for all — AI Coding Assistant</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
