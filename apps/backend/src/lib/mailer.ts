import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProd } from '../config/env';
import { logger } from './logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (env.MAIL_DRIVER === 'smtp' && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // Dev transport — captures messages and logs them instead of sending.
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendMail(options: MailOptions): Promise<boolean> {
  try {
    const info = await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (env.MAIL_DRIVER === 'console') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = (info as any)?.message?.toString?.() ?? '';
      // Recipient addresses are PII — don't write them to production logs.
      if (!isProd) logger.info(`📧 [dev mail] to=${options.to} subject="${options.subject}"`);
      logger.debug('mail content', buf);
    }
    return true;
  } catch (err) {
    logger.error('Failed to send email', err);
    return false;
  }
}

export function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <tr><td style="background:#0b3d91;padding:20px 28px;color:#fff;font-size:18px;font-weight:700">Swift Instruments</td></tr>
      <tr><td style="padding:28px">
        <h2 style="margin:0 0 12px;font-size:20px;color:#0b3d91">${title}</h2>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">
        M/S. Swift Instruments · A-1524, 2nd floor, Greenfield, Faridabad (Haryana) 121010
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
