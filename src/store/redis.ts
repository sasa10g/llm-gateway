import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis.default(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number {
    return Math.min(times * 200, 5000);
  },
});

redis.on('connect', () => console.log('[redis] connected'));
redis.on('error', (err: Error) => console.error('[redis] error:', err.message));
