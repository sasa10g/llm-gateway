import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OpenAICompatProvider } from './openai-compat.js';

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openai-compat';

const providers: Record<ProviderName, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  'openai-compat': new OpenAICompatProvider(),
};

export function getProvider(name: ProviderName): LLMProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown provider "${name}". Supported: ${Object.keys(providers).join(', ')}`,
    );
  }
  return provider;
}

export { LLMProvider, ChatMessage, UsageStats, StreamCallbacks, ProviderConfig } from './types.js';
