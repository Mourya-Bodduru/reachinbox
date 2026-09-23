import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    avatar?: string | null;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        };
        return next();
      }
    } catch (err) {
      // Invalid token, fall through
    }
  }

  // Fallback for dev / unauthenticated requests: use or create demo user
  try {
    let demoUser = await prisma.user.findFirst({
      where: { email: 'demo@reachinbox.ai' },
    });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          email: 'demo@reachinbox.ai',
          name: 'Demo Admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
      });
    }
    req.user = {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      avatar: demoUser.avatar,
    };
    return next();
  } catch (e) {
    return next();
  }
}
