import { prisma } from '../config/db';
import { emailQueue, enqueueEmailJob } from '../queues/emailQueue';

export async function syncQueueOnStartup(): Promise<void> {
  try {
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED'],
        },
      },
    });

    for (const job of pendingJobs) {
      const bullJobId = `email_${job.id}`;
      const existing = await emailQueue.getJob(bullJobId);

      // Re-enqueue jobs that were scheduled in MySQL but are not present in Redis
      if (!existing) {
        const delayMs = Math.max(0, new Date(job.scheduledAt).getTime() - Date.now());

        await enqueueEmailJob(
          {
            emailJobId: job.id,
            userId: job.userId,
            senderEmail: job.senderEmail,
            recipientEmail: job.recipientEmail,
            subject: job.subject,
            body: job.body,
            delaySeconds: job.delaySeconds,
            hourlyLimit: job.hourlyLimit,
            batchId: job.batchId || undefined,
            scheduledAt: job.scheduledAt.toISOString(),
          },
          delayMs
        );
      }
    }
  } catch (err: any) {
    console.error('Failed to sync queue on startup:', err.message);
  }
}
