import { randomUUID } from 'crypto';
import { redis } from './redis.js';
import { config } from '../config.js';

const TOKEN_PREFIX = 'wstoken:';
const ttlSeconds = config.wsTokenTtlMinutes * 60;

export interface TokenPayload {
  tenantId: string;
  conversationId: string;
}

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

export async function issueToken(tenantId: string, conversationId: string): Promise<IssuedToken> {
  const token = randomUUID();
  const payload = JSON.stringify({ tenantId, conversationId });
  await redis.set(`${TOKEN_PREFIX}${token}`, payload, 'EX', ttlSeconds);

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { token, expiresAt };
}

export async function validateToken(token: string): Promise<TokenPayload | null> {
  const raw = await redis.get(`${TOKEN_PREFIX}${token}`);
  if (!raw) return null;
  return JSON.parse(raw) as TokenPayload;
}

export async function revokeToken(token: string): Promise<void> {
  await redis.del(`${TOKEN_PREFIX}${token}`);
}
