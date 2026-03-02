export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullContent: string, usage: UsageStats | null) => void;
  onError: (err: Error) => void;
}

export interface ProviderConfig {
  model: string;
  systemPrompt: string;
  maxTokens: number;
  apiKey: string;
  baseUrl?: string;
}

export interface LLMProvider {
  readonly name: string;
  stream(config: ProviderConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;
}
