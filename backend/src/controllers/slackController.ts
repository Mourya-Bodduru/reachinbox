import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getSlackAuthorizeUrl,
  handleOAuthCallback,
  disconnectSlack,
  sendSlackMessage,
} from '../services/slackService';
import { prisma } from '../config/db';
import { env } from '../config/env';

export async function getAuthorizeUrl(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!env.SLACK_CLIENT_ID) {
      return res.status(400).json({
        error:
          'SLACK_CLIENT_ID not configured in .env. You can connect a Slack Incoming Webhook directly below.',
      });
    }

    const url = getSlackAuthorizeUrl(userId);
    return res.json({ url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function slackCallback(req: AuthRequest, res: Response) {
  try {
    const { code, state: userId, error } = req.query;

    if (error) {
      return res.redirect(`${env.FRONTEND_URL}/?slack_error=${encodeURIComponent(String(error))}`);
    }

    if (!code || !userId) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    await handleOAuthCallback(String(code), String(userId));

    return res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
  } catch (err: any) {
    console.error('[Slack] Callback error:', err.message);
    return res.redirect(`${env.FRONTEND_URL}/?slack_error=${encodeURIComponent(err.message)}`);
  }
}

export async function disconnect(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await disconnectSlack(userId);
    return res.json({ success: true, message: 'Slack disconnected' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function connectWebhookDirect(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { webhookUrl, channel } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ error: 'Invalid Slack Incoming Webhook URL' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackWebhookUrl: webhookUrl,
        slackChannel: channel || '#reachinbox-alerts',
      },
    });

    return res.json({ success: true, message: 'Slack webhook connected successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function testNotification(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const result = await sendSlackMessage(
      userId,
      'ReachInbox Test Notification: Slack integration is active and working properly.',
      [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'ReachInbox Scheduler - Slack Connected',
            emoji: false,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Slack notifications are configured. Rate limit alerts will be posted here.',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Configured by: ${req.user?.email}`,
            },
          ],
        },
      ]
    );

    if (!result.sent) {
      return res.status(400).json({ error: result.reason || result.error || 'Failed to send Slack test message' });
    }

    return res.json({ success: true, message: 'Slack test notification delivered successfully!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
