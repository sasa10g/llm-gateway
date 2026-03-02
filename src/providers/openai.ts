import OpenAI from 'openai';
import type { LLMProvider, ProviderConfig, ChatMessage, StreamCallbacks } from './types.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  async stream(config: ProviderConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const { onChunk, onDone, onError } = callbacks;

    try {
      const client = new OpenAI({ apiKey: config.apiKey });

      const stream = await client.chat.completions.create({
        model: config.model,
        max_tokens: config.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ],
      });

      let fullContent = '';
      let usage = null;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      onDone(fullContent, usage);
    } catch (err) {
      onError(err as Error);
    }
  }
}
