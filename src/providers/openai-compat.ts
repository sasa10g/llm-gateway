import OpenAI from 'openai';
import type { LLMProvider, ProviderConfig, ChatMessage, StreamCallbacks } from './types.js';

/**
 * OpenAI-compatible provider.
 * Works with any API that implements the OpenAI chat completions format:
 *   - Groq        (https://api.groq.com/openai/v1)
 *   - Together    (https://api.together.xyz/v1)
 *   - Mistral     (https://api.mistral.ai/v1)
 *   - DeepSeek    (https://api.deepseek.com)
 *   - Perplexity  (https://api.perplexity.ai)
 *   - Ollama      (http://ollama:11434/v1   or   http://localhost:11434/v1)
 *   - vLLM        (http://localhost:8000/v1)
 *   - LM Studio   (http://localhost:1234/v1)
 *   - Any other OpenAI-compatible endpoint
 */
export class OpenAICompatProvider implements LLMProvider {
  readonly name = 'openai-compat';

  async stream(config: ProviderConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const { onChunk, onDone, onError } = callbacks;

    if (!config.baseUrl) {
      onError(new Error('openai-compat provider requires "baseUrl" in tenant config'));
      return;
    }

    try {
      const client = new OpenAI({
        apiKey: config.apiKey || 'not-needed', // Ollama/local don't need a key
        baseURL: config.baseUrl,
      });

      const stream = await client.chat.completions.create({
        model: config.model,
        max_tokens: config.maxTokens,
        stream: true,
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
        // Some providers include usage in the last chunk
        if ((chunk as any).usage) {
          const u = (chunk as any).usage;
          usage = {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            totalTokens: u.total_tokens ?? 0,
          };
        }
      }

      onDone(fullContent, usage);
    } catch (err) {
      onError(err as Error);
    }
  }
}
