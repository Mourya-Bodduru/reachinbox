import express, { Request, Response } from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { emailQueue } from './queues/emailQueue';
import { createEmailWorker } from './queues/worker';
import { initElasticsearch } from './services/searchService';
import { syncQueueOnStartup } from './services/recoveryService';
import apiRouter from './routes/api';

async function bootstrap() {
  const app = express();

  app.use(
    cors({
      origin: (requestOrigin: any, callback: any) => {
        if (!requestOrigin) return callback(null, true);
        if (
          requestOrigin === env.FRONTEND_URL ||
          requestOrigin.endsWith('.vercel.app') ||
          requestOrigin.includes('localhost') ||
          requestOrigin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
  app.use('/api', apiRouter);

  app.get('/health', async (_req: Request, res: Response) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    try {
      await redisClient.ping();
    } catch {
      redisStatus = 'error';
    }

    return res.json({
      status: dbStatus === 'ok' && redisStatus === 'ok' ? 'healthy' : 'degraded',
      db: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  });

  const server = app.listen(env.PORT, async () => {
    console.log(`Backend server listening on port ${env.PORT}`);
    console.log(`Queue UI: http://localhost:${env.PORT}/admin/queues`);

    await initElasticsearch();
    const worker = createEmailWorker();
    await syncQueueOnStartup();

    const shutdown = async (signal: string) => {
      console.log(`Shutting down (${signal})...`);
      server.close();
      await worker.close();
      await emailQueue.close();
      await redisClient.quit();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
