import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

function buildRedisOptions(): RedisOptions {
  if (env.REDIS_URL) {
    try {
      const parsed = new URL(env.REDIS_URL);
      const options: RedisOptions = {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      };

      if (parsed.password) {
        options.password = decodeURIComponent(parsed.password);
      }
      if (parsed.username && parsed.username !== 'default') {
        options.username = decodeURIComponent(parsed.username);
      }
      if (parsed.protocol === 'rediss:') {
        options.tls = { rejectUnauthorized: false };
      }
      return options;
    } catch {
      // Ignore URL parse error and fallback to host/port
    }
  }

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  };
}

export const redisOptions: RedisOptions = buildRedisOptions();

export const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis(redisOptions);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to Redis`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
