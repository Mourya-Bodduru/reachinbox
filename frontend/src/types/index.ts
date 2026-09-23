export type EmailStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'RATE_LIMITED_RESCHEDULED'
  | 'CANCELLED';

export interface EmailJob {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  bullmqJobId?: string | null;
  attemptCount: number;
  hourlyLimit: number;
  delaySeconds: number;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  slackConnected?: boolean;
  slackChannel?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
  isDefault: boolean;
}

export interface EmailStats {
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  rateLimitedCount: number;
  totalCount: number;
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    total: number;
  };
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail: string;
  scheduledAt?: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}
