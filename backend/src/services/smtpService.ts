import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

interface SendEmailParams {
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

let cachedTransporter: Transporter | null = null;
let testAccountCredentials: { user: string; pass: string } | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASS;

  if (!user || !pass) {
    if (!testAccountCredentials) {
      console.log('[SMTP] No Ethereal credentials found in env. Generating temporary Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      testAccountCredentials = {
        user: testAccount.user,
        pass: testAccount.pass,
      };
      console.log(`[SMTP] Ethereal account created: User=${testAccount.user}`);
    }
    user = testAccountCredentials.user;
    pass = testAccountCredentials.pass;
  }

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

export async function sendEmailViaEthereal(params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const senderDisplayName = params.senderName || params.senderEmail.split('@')[0];
  const from = `"${senderDisplayName}" <${params.senderEmail}>`;

  const info = await transporter.sendMail({
    from,
    to: params.recipientEmail,
    subject: params.subject,
    text: params.body,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #edf2f7;">
          <strong style="color: #4a5568; font-size: 14px;">From:</strong> ${from}<br/>
          <strong style="color: #4a5568; font-size: 14px;">To:</strong> ${params.recipientEmail}<br/>
          <strong style="color: #4a5568; font-size: 14px;">Subject:</strong> ${params.subject}
        </div>
        <div style="color: #2d3748; line-height: 1.6; white-space: pre-wrap; font-size: 15px;">
          ${params.body}
        </div>
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cbd5e0; font-size: 12px; color: #a0aec0; text-align: center;">
          Sent via ReachInbox Email Scheduler • Powered by Ethereal SMTP
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[SMTP] Email sent to ${params.recipientEmail}. MessageId: ${info.messageId}`);
  if (previewUrl) {
    console.log(`[SMTP] Ethereal Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
