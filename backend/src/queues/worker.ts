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

      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
      });

      if (!emailRecord) {
        return { status: 'skipped', reason: 'Email job not found in database' };
      }

      if (emailRecord.status === 'CANCELLED' || emailRecord.status === 'SENT') {
        return { status: 'skipped', reason: `Job already ${emailRecord.status.toLowerCase()}` };
      }

      // Track hourly send quota per sender using an atomic Redis key expiring after 2 hours
      const effectiveHourlyLimit = job.data.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const hourWindow = getHourWindowKey();
      const rateLimitKey = `rate_limit:${senderEmail}:${hourWindow}`;

      const count = await redisClient.incr(rateLimitKey);
      if (count === 1) {
        await redisClient.expire(rateLimitKey, 7200);
      }

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
      }).catch((e) => console.error('RateLimitLog update failed:', e.message));

      if (count > effectiveHourlyLimit) {
        // Calculate remaining delay to push execution into the subsequent hour window
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const delayUntilNextHourMs = nextHour.getTime() - now.getTime();

        // Introduce a slight jitter to prevent thundering herd when the next window opens
        const jitterMs = Math.floor(Math.random() * 45000);
        const totalDelayMs = delayUntilNextHourMs + jitterMs;
        const newScheduledAt = new Date(Date.now() + totalDelayMs);

        const rescheduledJobId = `email_${emailJobId}_r${count}`;
        await emailQueue.add('send-email', job.data, {
          delay: totalDelayMs,
          jobId: rescheduledJobId,
        });

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RATE_LIMITED_RESCHEDULED',
            scheduledAt: newScheduledAt,
            bullmqJobId: rescheduledJobId,
            attemptCount: { increment: 1 },
          },
        });

        await updateEmailIndex(emailJobId, {
          status: 'RATE_LIMITED_RESCHEDULED',
          scheduledAt: newScheduledAt,
        });

        await sendRateLimitAlert({
          userId,
          senderEmail,
          hourlyLimit: effectiveHourlyLimit,
          currentCount: count,
          nextWindowTime: nextHour,
        });

        return {
          status: 'rescheduled',
          sender: senderEmail,
          rescheduledTo: newScheduledAt,
        };
      }

      const delayBetweenSends = Math.max(
        env.MIN_DELAY_BETWEEN_EMAILS_MS,
        (job.data.delaySeconds || 2) * 1000
      );

      await sleep(delayBetweenSends);

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'SENDING' },
      });

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

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt,
            etherealPreviewUrl: previewUrl,
          },
        });

        await updateEmailIndex(emailJobId, {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: previewUrl,
        });

        return {
          status: 'sent',
          messageId: result.messageId,
          previewUrl,
        };
      } catch (err: any) {
        console.error(`Failed to send email ${emailJobId}:`, err.message);

        try {
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
        } catch {}

        throw err;
      }
    },
    {
      connection: redisOptions,
      concurrency: env.WORKER_CONCURRENCY,
      lockDuration: 60000,
      stalledInterval: 60000,
      maxStalledCount: 2,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Worker job ${job?.id} failed:`, err.message);
  });

  return worker;
}
