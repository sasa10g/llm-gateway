import 'dotenv/config';

export interface AppConfig {
  port: number;
  redisUrl: string;
  wsTokenTtlMinutes: number;
  conversationTtlHours: number;

  // Default provider API keys (fallback when tenant doesn't specify its own)
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  wsTokenTtlMinutes: parseInt(process.env.WS_TOKEN_TTL_MINUTES || '10', 10),
  conversationTtlHours: parseInt(process.env.CONVERSATION_TTL_HOURS || '24', 10),

  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
};

// At least one provider key should be set
const hasAnyKey = config.openaiApiKey || config.anthropicApiKey || config.googleApiKey;
if (!hasAnyKey) {
  console.warn('[config] WARNING: No provider API keys found in .env — tenants must provide their own providerApiKey');
}
