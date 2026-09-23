import { Worker, Job } from 'bullmq';
import { redisOptions, redisClient } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueue } from './emailQueue';
import { prisma } from '../config/db';
import { sendEmailViaEthereal } from '../services/smtpService';
import { updateEmailIndex } from '../services/searchService';
import { sendRateLimitAlert } from '../services/slackService';
import { env } from '../config/env';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHourWindowKey(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}`;
}

export function createEmailWorker(): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailJobId, senderEmail, senderName, recipientEmail, subject, body, userId } =
        job.data;

      console.log(`[Worker] Processing Job ${job.id} for recipient: ${recipientEmail} from sender: ${senderEmail}`);

      // 1. Verify job exists in DB and is not cancelled
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
      });

      if (!emailRecord) {
        console.warn(`[Worker] EmailJob ${emailJobId} not found in DB. Skipping.`);
        return { status: 'skipped', reason: 'Not found in DB' };
      }

      if (emailRecord.status === 'CANCELLED') {
        console.log(`[Worker] EmailJob ${emailJobId} is marked as CANCELLED. Skipping.`);
        return { status: 'skipped', reason: 'Job cancelled by user' };
      }

      if (emailRecord.status === 'SENT') {
        console.log(`[Worker] EmailJob ${emailJobId} has already been SENT. Idempotency preserved.`);
        return { status: 'skipped', reason: 'Already sent' };
      }

      // 2. Hourly Rate Limiting check per sender using Redis atomic counters
      const effectiveHourlyLimit = job.data.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const hourWindow = getHourWindowKey();
      const rateLimitKey = `rate_limit:${senderEmail}:${hourWindow}`;

      // Atomic increment
      const count = await redisClient.incr(rateLimitKey);
      if (count === 1) {
        // Set 2 hours TTL on first increment
        await redisClient.expire(rateLimitKey, 7200);
      }

      // Log to MySQL RateLimitLog for persistent tracking
      await prisma.rateLimitLog.upsert({
        where: {
          senderEmail_hourWindowKey: {
            senderEmail,
            hourWindowKey: hourWindow,
          },
        },
        update: { count },
        create: {
          senderEmail,
          hourWindowKey: hourWindow,
          count,
        },
      }).catch((e) => console.error('[Worker] RateLimitLog update error:', e.message));

      // 3. If hourly limit exceeded: Reschedule into next hour window (preserve job, do NOT drop)
      if (count > effectiveHourlyLimit) {
        console.warn(
          `[Worker] Hourly limit reached for sender ${senderEmail} (${count}/${effectiveHourlyLimit}). Rescheduling job ${emailJobId}...`
        );

        // Calculate time remaining until next hour starts
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const delayUntilNextHourMs = nextHour.getTime() - now.getTime();

        // Add a gentle stagger/jitter (0-60s) so jobs don't overwhelm the new window simultaneously
        const staggerMs = Math.floor(Math.random() * 45000);
        const totalDelayMs = delayUntilNextHourMs + staggerMs;
        const newScheduledAt = new Date(Date.now() + totalDelayMs);

        // Reschedule in BullMQ with new delay
        const rescheduledJobId = `email_${emailJobId}_r${count}`;
        await emailQueue.add('send-email', job.data, {
          delay: totalDelayMs,
          jobId: rescheduledJobId,
        });

        // Update DB status to RATE_LIMITED_RESCHEDULED
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RATE_LIMITED_RESCHEDULED',
            scheduledAt: newScheduledAt,
            bullmqJobId: rescheduledJobId,
            attemptCount: { increment: 1 },
          },
        });

        // Update Elasticsearch index
        await updateEmailIndex(emailJobId, {
          status: 'RATE_LIMITED_RESCHEDULED',
          scheduledAt: newScheduledAt,
        });

        // Fire real Slack notification
        await sendRateLimitAlert({
          userId,
          senderEmail,
          hourlyLimit: effectiveHourlyLimit,
          currentCount: count,
          nextWindowTime: nextHour,
        });

        return {
          status: 'rescheduled',
          reason: 'Hourly rate limit exceeded',
          sender: senderEmail,
          rescheduledTo: newScheduledAt,
        };
      }

      // 4. Rate limit check passed: Enforce minimum delay between sends (mimics provider throttling)
      const delayBetweenSends = Math.max(
        env.MIN_DELAY_BETWEEN_EMAILS_MS,
        (job.data.delaySeconds || 2) * 1000
      );

      console.log(`[Worker] Applying provider throttling delay of ${delayBetweenSends}ms...`);
      await sleep(delayBetweenSends);

      // Mark status as SENDING
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'SENDING' },
      });

      // 5. Send email via Ethereal SMTP
      try {
        const result = await sendEmailViaEthereal({
          senderEmail,
          senderName,
          recipientEmail,
          subject,
          body,
        });

        const sentAt = new Date();
        const previewUrl = result.previewUrl || null;

        // Update DB record
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt,
            etherealPreviewUrl: previewUrl,
          },
        });

        // Update Elasticsearch
        await updateEmailIndex(emailJobId, {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: previewUrl,
        });

        console.log(`[Worker] Successfully sent email ${emailJobId} to ${recipientEmail}`);

        return {
          status: 'sent',
          messageId: result.messageId,
          previewUrl,
        };
      } catch (err: any) {
        console.error(`[Worker] Failed sending email ${emailJobId}:`, err.message);

        // Mark as FAILED if error persists
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: err.message,
          },
        });

        await updateEmailIndex(emailJobId, {
          status: 'FAILED',
        });

        throw err;
      }
    },
    {
      connection: redisOptions,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('ready', () => {
    console.log(`[BullMQ Worker] Ready! Concurrency: ${env.WORKER_CONCURRENCY}`);
  });

  worker.on('completed', (job) => {
    console.log(`[BullMQ Worker] Job ${job?.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
