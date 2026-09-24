import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobPayload {
  emailJobId: string;
  userId?: string | null;
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  delaySeconds: number;
  hourlyLimit: number;
  batchId?: string;
  scheduledAt: string;
}

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 10000,
    },
    removeOnFail: {
      age: 48 * 3600,
      count: 10000,
    },
  },
});

export async function enqueueEmailJob(
  payload: EmailJobPayload,
  delayMs: number
) {
  const jobId = `email_${payload.emailJobId}`;
  return emailQueue.add('send-email', payload, {
    delay: Math.max(0, delayMs),
    jobId,
  });
}

export async function removeJobFromQueue(emailJobId: string) {
  const jobId = `email_${emailJobId}`;
  const job = await emailQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}

export async function getQueueStats() {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    total: waiting + active + delayed + completed + failed,
  };
}
