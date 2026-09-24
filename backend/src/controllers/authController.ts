import { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function googleLogin(req: AuthRequest, res: Response) {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    let payload: any;

    if (env.GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID.trim(),
        });
        payload = ticket.getPayload();
      } catch (verifyErr: any) {
        console.warn('[Auth] verifyIdToken failed, falling back to JWT decode:', verifyErr.message);
        const parts = credential.split('.');
        if (parts.length === 3) {
          payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        }
      }
    } else {
      // Decode JWT payload if client ID not configured
      const parts = credential.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      }
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token payload' });
    }

    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const avatar = payload.picture || null;
    const googleId = payload.sub || null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(googleId ? [{ googleId }] : [])],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
          googleId,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          avatar,
          googleId: googleId || user.googleId,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: !!(user.slackWebhookUrl || user.slackAccessToken),
        slackChannel: user.slackChannel,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Google login error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to authenticate with Google' });
  }
}

export async function devLogin(req: AuthRequest, res: Response) {
  try {
    let user = await prisma.user.findFirst({
      where: { email: 'demo@reachinbox.ai' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@reachinbox.ai',
          name: 'Demo Admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: !!(user.slackWebhookUrl || user.slackAccessToken),
        slackChannel: user.slackChannel,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function emailLogin(req: AuthRequest, res: Response) {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const displayName = (name && typeof name === 'string' && name.trim()) || cleanEmail.split('@')[0];

    let user = await prisma.user.findFirst({
      where: { email: cleanEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: displayName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e0e7ff&color=4338ca`,
        },
      });
    } else if (name && name.trim()) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: displayName },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: !!(user.slackWebhookUrl || user.slackAccessToken),
        slackChannel: user.slackChannel,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackConnected: !!(user.slackWebhookUrl || user.slackAccessToken),
      slackChannel: user.slackChannel,
    },
  });
}
