import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ProviderName } from '../providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantsPath = resolve(__dirname, '../../tenants.json');

export interface TenantConfig {
  name: string;
  apiKey: string;            // tenant auth key (for gateway access)
  provider: ProviderName;    // openai | anthropic | google | openai-compat
  providerApiKey?: string;   // LLM provider API key (optional, falls back to .env)
  baseUrl?: string;          // for openai-compat providers
  model: string;
  systemPrompt: string;
  maxTokens: number;
  rateLimit: number;
}

export interface ResolvedTenant extends TenantConfig {
  id: string;
}

interface TenantsFile {
  tenants: Record<string, TenantConfig>;
}

let tenantsConfig: TenantsFile;

export function loadTenants(): void {
  const raw = readFileSync(tenantsPath, 'utf-8');
  tenantsConfig = JSON.parse(raw) as TenantsFile;
  const tenantList = Object.entries(tenantsConfig.tenants)
    .map(([id, t]) => `  ${id} → ${t.provider}/${t.model}`)
    .join('\n');
  console.log(`[tenants] loaded ${Object.keys(tenantsConfig.tenants).length} tenants:\n${tenantList}`);
}

export function getTenant(tenantId: string): TenantConfig | null {
  return tenantsConfig?.tenants?.[tenantId] ?? null;
}

export function getTenantByApiKey(apiKey: string): ResolvedTenant | null {
  if (!tenantsConfig?.tenants) return null;
  for (const [id, tenant] of Object.entries(tenantsConfig.tenants)) {
    if (tenant.apiKey === apiKey) {
      return { id, ...tenant };
    }
  }
  return null;
}

export function getAllTenantIds(): string[] {
  return Object.keys(tenantsConfig?.tenants ?? {});
}
