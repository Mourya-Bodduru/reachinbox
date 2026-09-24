import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { enqueueEmailJob, removeJobFromQueue, getQueueStats } from '../queues/emailQueue';
import { indexEmail, searchEmails } from '../services/searchService';
import { env } from '../config/env';

export async function scheduleEmails(req: AuthRequest, res: Response) {
  try {
    const {
      subject,
      body,
      recipients,
      senderEmail,
      scheduledAt: rawScheduledAt,
      delayBetweenEmails: rawDelay,
      hourlyLimit: rawLimit,
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Email body is required' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    if (!senderEmail || !senderEmail.trim()) {
      return res.status(400).json({ error: 'Sender email is required' });
    }

    const userId = req.user?.id || null;
    const batchId = uuidv4();
    const delaySeconds = Math.max(
      1,
      parseInt(String(rawDelay || env.MIN_DELAY_BETWEEN_EMAILS_MS / 1000), 10)
    );
    const hourlyLimit = Math.max(
      1,
      parseInt(String(rawLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER), 10)
    );

    const baseScheduledTime = rawScheduledAt
      ? new Date(rawScheduledAt).getTime()
      : Date.now();
    const now = Date.now();

    const scheduledJobs = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient || !recipient.includes('@')) continue;

      const targetTime = baseScheduledTime + i * delaySeconds * 1000;
      const scheduledDate = new Date(targetTime);
      const delayMs = Math.max(0, targetTime - now);
      const emailJobId = uuidv4();

      const emailRecord = await prisma.emailJob.create({
        data: {
          id: emailJobId,
          userId,
          senderEmail: senderEmail.trim(),
          recipientEmail: recipient,
          subject: subject.trim(),
          body: body.trim(),
          status: 'SCHEDULED',
          scheduledAt: scheduledDate,
          delaySeconds,
          hourlyLimit,
          batchId,
          bullmqJobId: `email_${emailJobId}`,
        },
      });

      await indexEmail({
        id: emailRecord.id,
        userId: emailRecord.userId,
        senderEmail: emailRecord.senderEmail,
        recipientEmail: emailRecord.recipientEmail,
        subject: emailRecord.subject,
        body: emailRecord.body,
        status: emailRecord.status,
        scheduledAt: emailRecord.scheduledAt,
        createdAt: emailRecord.createdAt,
        updatedAt: emailRecord.updatedAt,
      });

      await enqueueEmailJob(
        {
          emailJobId: emailRecord.id,
          userId,
          senderEmail: emailRecord.senderEmail,
          recipientEmail: emailRecord.recipientEmail,
          subject: emailRecord.subject,
          body: emailRecord.body,
          delaySeconds,
          hourlyLimit,
          batchId,
          scheduledAt: scheduledDate.toISOString(),
        },
        delayMs
      );

      scheduledJobs.push(emailRecord);
    }

    return res.status(201).json({
      success: true,
      batchId,
      scheduledCount: scheduledJobs.length,
      firstScheduledAt: scheduledJobs[0]?.scheduledAt,
      lastScheduledAt: scheduledJobs[scheduledJobs.length - 1]?.scheduledAt,
      jobs: scheduledJobs,
    });
  } catch (err: any) {
    console.error('Error scheduling email batch:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function getScheduledEmails(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const query = req.query.q ? String(req.query.q) : undefined;
    const senderEmail = req.query.senderEmail ? String(req.query.senderEmail) : undefined;

    const result = await searchEmails({
      query,
      senderEmail,
      page,
      limit,
    });

    if (result.source === 'database_fallback') {
      const where: any = {
        status: { in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'QUEUED'] },
      };
      if (senderEmail) where.senderEmail = senderEmail;
      if (query && query.trim()) {
        const q = query.trim();
        where.OR = [
          { recipientEmail: { contains: q } },
          { subject: { contains: q } },
          { body: { contains: q } },
          { senderEmail: { contains: q } },
        ];
      }

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return res.json({
        source: 'database',
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        emails,
      });
    }

    const filteredEmails = result.emails.filter((e: any) =>
      ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'QUEUED'].includes(e.status)
    );

    return res.json({
      ...result,
      emails: filteredEmails,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getSentEmails(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const query = req.query.q ? String(req.query.q) : undefined;
    const senderEmail = req.query.senderEmail ? String(req.query.senderEmail) : undefined;

    const where: any = {
      status: { in: ['SENT', 'FAILED'] },
    };
    if (senderEmail) where.senderEmail = senderEmail;
    if (query && query.trim()) {
      const q = query.trim();
      where.OR = [
        { recipientEmail: { contains: q } },
        { subject: { contains: q } },
        { body: { contains: q } },
        { senderEmail: { contains: q } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      source: 'database',
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      emails,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function cancelEmail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const emailJob = await prisma.emailJob.findUnique({ where: { id } });

    if (!emailJob) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    if (['SENT', 'FAILED'].includes(emailJob.status)) {
      return res.status(400).json({ error: `Cannot cancel email with status ${emailJob.status}` });
    }

    await removeJobFromQueue(id);

    const updated = await prisma.emailJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return res.json({ success: true, message: 'Email job cancelled', job: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getEmailStats(req: AuthRequest, res: Response) {
  try {
    const [scheduledCount, sentCount, failedCount, rateLimitedCount, queueStats] =
      await Promise.all([
        prisma.emailJob.count({
          where: { status: 'SCHEDULED' },
        }),
        prisma.emailJob.count({
          where: { status: 'SENT' },
        }),
        prisma.emailJob.count({
          where: { status: 'FAILED' },
        }),
        prisma.emailJob.count({
          where: { status: 'RATE_LIMITED_RESCHEDULED' },
        }),
        getQueueStats(),
      ]);

    return res.json({
      scheduledCount,
      sentCount,
      failedCount,
      rateLimitedCount,
      totalCount: scheduledCount + sentCount + failedCount + rateLimitedCount,
      queue: queueStats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getSenders(req: AuthRequest, res: Response) {
  try {
    const senders = await prisma.sender.findMany({
      orderBy: { isDefault: 'desc' },
    });
    return res.json({ senders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
