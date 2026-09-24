import axios from 'axios';
import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../config/db';

export function getSlackAuthorizeUrl(userId: string): string {
  if (!env.SLACK_CLIENT_ID) {
    throw new Error('SLACK_CLIENT_ID is not configured');
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

  return prisma.user.update({
    where: { id: userId },
    data: {
      slackWebhookUrl: webhookUrl,
      slackAccessToken: accessToken,
      slackChannel: channel,
    },
  });
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
  let user = null;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  }
  if (!user) {
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
    return { sent: false, reason: 'No Slack workspace connected' };
  }

  try {
    if (user.slackWebhookUrl) {
      await axios.post(user.slackWebhookUrl, { text, blocks });
      return { sent: true, method: 'webhook' };
    } else if (user.slackAccessToken && user.slackChannel) {
      const client = new WebClient(user.slackAccessToken);
      await client.chat.postMessage({
        channel: user.slackChannel,
        text,
        blocks,
      });
      return { sent: true, method: 'webclient' };
    }
  } catch (err: any) {
    console.error('Failed to deliver Slack notification:', err.message);
    return { sent: false, error: err.message };
  }

  return { sent: false, reason: 'No valid destination' };
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
  });

  const text = `Rate Limit Reached: Sender ${params.senderEmail} hit ${params.hourlyLimit} emails/hr. Next window opens at ${formattedNextTime}`;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Hourly Rate Limit Exceeded',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Sender:* \`${params.senderEmail}\`\n*Limit:* ${params.hourlyLimit} emails/hr (attempt: ${params.currentCount})\n*Action:* Remaining emails have been delayed to the next window.`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Next Execution:*\n${formattedNextTime}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\nRescheduled`,
        },
      ],
    },
  ];

  return sendSlackMessage(params.userId, text, blocks);
}
