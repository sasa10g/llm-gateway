import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, ProviderConfig, ChatMessage, StreamCallbacks, UsageStats } from './types.js';

export class GoogleProvider implements LLMProvider {
  readonly name = 'google';

  async stream(config: ProviderConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const { onChunk, onDone, onError } = callbacks;

    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: config.systemPrompt,
      });

      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({
        history,
        generationConfig: { maxOutputTokens: config.maxTokens },
      });

      const result = await chat.sendMessageStream(lastMessage.content);

      let fullContent = '';

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          onChunk(text);
        }
      }

      // Gemini provides usage in the response
      const response = await result.response;
      let usage: UsageStats | null = null;

      if (response.usageMetadata) {
        usage = {
          promptTokens: response.usageMetadata.promptTokenCount ?? 0,
          completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: response.usageMetadata.totalTokenCount ?? 0,
        };
      }

      onDone(fullContent, usage);
    } catch (err) {
      onError(err as Error);
    }
  }
}
