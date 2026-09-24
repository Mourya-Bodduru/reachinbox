import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Mandatory for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
