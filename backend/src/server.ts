import express from 'express';
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

  // Middleware
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Bull Board (Live Queue Dashboard)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // API Routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/health', async (req, res) => {
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
      version: '1.0.0',
    });
  });

  // Start Express server
  const server = app.listen(env.PORT, async () => {
    console.log(`====================================================`);
    console.log(`🚀 ReachInbox Scheduler Backend running on port ${env.PORT}`);
    console.log(`📊 BullMQ Dashboard: http://localhost:${env.PORT}/admin/queues`);
    console.log(`🌐 API Endpoints:    http://localhost:${env.PORT}/api`);
    console.log(`====================================================`);

    // 1. Initialize Elasticsearch index
    await initElasticsearch();

    // 2. Initialize BullMQ Worker
    const worker = createEmailWorker();

    // 3. Run Queue Recovery / Startup Sync (Persistence across server restarts)
    await syncQueueOnStartup();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
      });
      await worker.close();
      await emailQueue.close();
      await redisClient.quit();
      await prisma.$disconnect();
      console.log('[Server] Graceful shutdown completed.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal bootstrap error:', err);
  process.exit(1);
});
