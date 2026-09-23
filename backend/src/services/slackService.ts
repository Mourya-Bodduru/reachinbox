import axios from 'axios';
import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../config/db';

export function getSlackAuthorizeUrl(userId: string): string {
  if (!env.SLACK_CLIENT_ID) {
    throw new Error('SLACK_CLIENT_ID is not configured in backend .env');
  }

  const scopes = ['incoming-webhook', 'chat:write'];
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: scopes.join(','),
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleOAuthCallback(code: string, userId: string) {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  const webhookUrl = data.incoming_webhook?.url;
  const channel = data.incoming_webhook?.channel || data.incoming_webhook?.configuration_url;
  const accessToken = data.access_token;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      slackWebhookUrl: webhookUrl,
      slackAccessToken: accessToken,
      slackChannel: channel,
    },
  });

  return updatedUser;
}

export async function disconnectSlack(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      slackWebhookUrl: null,
      slackAccessToken: null,
      slackChannel: null,
    },
  });
}

export async function sendSlackMessage(userId: string | null | undefined, text: string, blocks?: any[]) {
  // Find user to notify
  let user = null;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  }
  if (!user) {
    // Fallback to first user with Slack connected
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { slackWebhookUrl: { not: null } },
          { slackAccessToken: { not: null } },
        ],
      },
    });
  }

  if (!user || (!user.slackWebhookUrl && !user.slackAccessToken)) {
    console.log('[Slack] No connected Slack workspace found. Skipping notification gracefully.');
    return { sent: false, reason: 'No Slack workspace connected' };
  }

  try {
    if (user.slackWebhookUrl) {
      await axios.post(user.slackWebhookUrl, { text, blocks });
      console.log(`[Slack] Sent notification via incoming webhook to ${user.slackChannel || 'channel'}`);
      return { sent: true, method: 'webhook' };
    } else if (user.slackAccessToken && user.slackChannel) {
      const client = new WebClient(user.slackAccessToken);
      await client.chat.postMessage({
        channel: user.slackChannel,
        text,
        blocks,
      });
      console.log(`[Slack] Sent notification via WebClient to ${user.slackChannel}`);
      return { sent: true, method: 'webclient' };
    }
  } catch (err: any) {
    console.error('[Slack] Failed to deliver notification:', err.message);
    return { sent: false, error: err.message };
  }

  return { sent: false, reason: 'No valid channel or webhook' };
}

export async function sendRateLimitAlert(params: {
  userId?: string | null;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  nextWindowTime: Date;
}) {
  const formattedNextTime = params.nextWindowTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const text = `🚨 Rate Limit Alert: Sender ${params.senderEmail} reached ${params.hourlyLimit} emails/hr. Next window: ${formattedNextTime}`;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 ReachInbox Scheduler • Rate Limit Exceeded',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Sender:* \`${params.senderEmail}\`\n*Limit:* *${params.hourlyLimit} emails / hour* (Current count: *${params.currentCount}*)\n*Status:* Jobs automatically delayed & rescheduled into the next hour window.`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Next Execution Window:*\n🕒 ${formattedNextTime}`,
        },
        {
          type: 'mrkdwn',
          text: '*Action Taken:*\n✅ Order Preserved (No emails dropped)',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⚡ ReachInbox Distributed Job Scheduler • Safe Provider Throttling Active',
        },
      ],
    },
  ];

  return sendSlackMessage(params.userId, text, blocks);
}
