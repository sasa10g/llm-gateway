import { randomUUID } from 'crypto';
import { redis } from './redis.js';
import { config } from '../config.js';

const CONV_PREFIX = 'conv:';
const META_PREFIX = 'convmeta:';
const INIT_CTX_PREFIX = 'convinit:';
const ttlSeconds = config.conversationTtlHours * 3600;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface InitialContextPayload {
  context?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

export async function setInitialContext(
  conversationId: string,
  payload: InitialContextPayload,
): Promise<void> {
  await redis.set(
    `${INIT_CTX_PREFIX}${conversationId}`,
    JSON.stringify(payload),
    'EX',
    ttlSeconds,
  );
}

export async function getInitialContext(
  conversationId: string,
): Promise<InitialContextPayload | null> {
  const raw = await redis.get(`${INIT_CTX_PREFIX}${conversationId}`);
  if (!raw) return null;
  return JSON.parse(raw) as InitialContextPayload;
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
