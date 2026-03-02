import { config } from '../config.js';
import { TenantConfig } from '../tenants/router.js';
import { getProvider, type ChatMessage, type StreamCallbacks, type ProviderConfig } from '../providers/index.js';

export type { ChatMessage, StreamCallbacks } from '../providers/index.js';

/**
 * Resolve the LLM API key for a tenant.
 * Priority: tenant's providerApiKey → .env fallback for that provider
 */
function resolveApiKey(tenant: TenantConfig): string {
  if (tenant.providerApiKey) return tenant.providerApiKey;

  switch (tenant.provider) {
    case 'openai':
      return config.openaiApiKey;
    case 'anthropic':
      return config.anthropicApiKey;
    case 'google':
      return config.googleApiKey;
    case 'openai-compat':
      return tenant.providerApiKey || 'not-needed';
    default:
      return '';
  }
}

export async function streamCompletion(
  tenantConfig: TenantConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const provider = getProvider(tenantConfig.provider);
  const apiKey = resolveApiKey(tenantConfig);

  if (!apiKey && tenantConfig.provider !== 'openai-compat') {
    callbacks.onError(
      new Error(`No API key for provider "${tenantConfig.provider}". Set it in .env or tenant's providerApiKey.`),
    );
    return;
  }

  const providerConfig: ProviderConfig = {
    model: tenantConfig.model,
    systemPrompt: tenantConfig.systemPrompt,
    maxTokens: tenantConfig.maxTokens,
    apiKey,
    baseUrl: tenantConfig.baseUrl,
  };

  console.log(`[stream] provider=${provider.name} model=${tenantConfig.model}`);
  await provider.stream(providerConfig, messages, callbacks);
}
