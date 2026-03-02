import { randomUUID } from 'crypto';
import { redis } from './redis.js';
import { config } from '../config.js';

const CONV_PREFIX = 'conv:';
const META_PREFIX = 'convmeta:';
const ttlSeconds = config.conversationTtlHours * 3600;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export async function createConversation(tenantId: string): Promise<string> {
  const conversationId = `conv-${randomUUID()}`;
  const meta = JSON.stringify({
    tenantId,
    createdAt: new Date().toISOString(),
  });
  await redis.set(`${META_PREFIX}${conversationId}`, meta, 'EX', ttlSeconds);
  return conversationId;
}

export async function getHistory(conversationId: string): Promise<Message[]> {
  const raw = await redis.lrange(`${CONV_PREFIX}${conversationId}`, 0, -1);
  return raw.map((item: string) => JSON.parse(item) as Message);
}

export async function appendMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
): Promise<void> {
  const message = JSON.stringify({ role, content, timestamp: new Date().toISOString() });
  await redis.rpush(`${CONV_PREFIX}${conversationId}`, message);
  await redis.expire(`${CONV_PREFIX}${conversationId}`, ttlSeconds);
}
