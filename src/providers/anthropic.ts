import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ProviderConfig, ChatMessage, StreamCallbacks, UsageStats } from './types.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  async stream(config: ProviderConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const { onChunk, onDone, onError } = callbacks;

    try {
      const client = new Anthropic({ apiKey: config.apiKey });

      // Anthropic uses system as a top-level param, not in messages
      const anthropicMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const stream = client.messages.stream({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        messages: anthropicMessages,
      });

      let fullContent = '';

      stream.on('text', (text: string) => {
        fullContent += text;
        onChunk(text);
      });

      const finalMessage = await stream.finalMessage();

      const usage: UsageStats = {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      };

      onDone(fullContent, usage);
    } catch (err) {
      onError(err as Error);
    }
  }
}
