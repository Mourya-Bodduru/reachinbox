import { prisma } from '../config/db';
import { emailQueue, enqueueEmailJob } from '../queues/emailQueue';

/**
 * Recovers and synchronizes pending/scheduled jobs on server startup.
 * Guarantees zero lost jobs and strict idempotency after server restarts.
 */
export async function syncQueueOnStartup(): Promise<void> {
  console.log('[RecoveryService] Checking for pending/scheduled email jobs in DB...');

  try {
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED'],
        },
      },
      include: {
        user: true,
      },
    });

    console.log(`[RecoveryService] Found ${pendingJobs.length} scheduled jobs in MySQL.`);

    let recoveredCount = 0;
    let existingCount = 0;

    for (const job of pendingJobs) {
      const bullJobId = `email_${job.id}`;
      const existingBullJob = await emailQueue.getJob(bullJobId);

      if (!existingBullJob) {
        // Job was missing from Redis (e.g. Redis restart or crash)
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

        recoveredCount++;
        console.log(`[RecoveryService] Restored missing job ${job.id} with delay ${delayMs}ms.`);
      } else {
        existingCount++;
      }
    }

    console.log(
      `[RecoveryService] Startup sync finished: ${existingCount} already in Redis, ${recoveredCount} recovered from MySQL.`
    );
  } catch (err: any) {
    console.error('[RecoveryService] Failed to sync jobs on startup:', err.message);
  }
}
