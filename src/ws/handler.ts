import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { validateToken, revokeToken } from '../store/tokens.js';
import { getHistory, appendMessage, getInitialContext } from '../store/conversations.js';
import { getTenant } from '../tenants/router.js';
import { streamCompletion, type ChatMessage } from './stream.js';

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      send(ws, { type: 'error', message: 'Missing token parameter' });
      ws.close(4001, 'Missing token');
      return;
    }

    const tokenData = await validateToken(token);
    if (!tokenData) {
      send(ws, { type: 'error', message: 'Invalid or expired token' });
      ws.close(4001, 'Invalid token');
      return;
    }

    const { tenantId, conversationId } = tokenData;
    const tenant = getTenant(tenantId);

    if (!tenant) {
      send(ws, { type: 'error', message: 'Tenant not found' });
      ws.close(4002, 'Tenant not found');
      return;
    }

    // Revoke token after use (single-use ephemeral token)
    await revokeToken(token);

    console.log(`[ws] connected: tenant=${tenantId} provider=${tenant.provider} model=${tenant.model} conv=${conversationId}`);
    send(ws, { type: 'connected', conversationId, tenant: tenant.name, provider: tenant.provider, model: tenant.model });

    let isStreaming = false;

    ws.on('message', async (raw: Buffer) => {
      let msg: { type: string; content?: string; context?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      if (msg.type !== 'message' || !msg.content?.trim()) {
        send(ws, { type: 'error', message: 'Expected { type: "message", content: "..." }' });
        return;
      }

      if (isStreaming) {
        send(ws, { type: 'error', message: 'Already streaming a response, please wait' });
        return;
      }

      isStreaming = true;

      // Store user message
      await appendMessage(conversationId, 'user', msg.content);

      // Build message history for LLM provider
      const messages: ChatMessage[] = [];

      // Prepend initial context (set at token creation time)
      const initCtx = await getInitialContext(conversationId);
      if (initCtx) {
        if (initCtx.context) {
          messages.push({ role: 'system', content: `[Initial Context]\n${initCtx.context}` });
        }
        if (initCtx.messages && initCtx.messages.length > 0) {
          for (const m of initCtx.messages) {
            messages.push({ role: m.role, content: m.content });
          }
        }
      }

      // Append conversation history (messages exchanged via gateway)
      const history = await getHistory(conversationId);
      for (const { role, content } of history) {
        messages.push({ role, content });
      }

      // Inject per-message runtime context before the latest user message
      if (msg.context && Object.keys(msg.context).length > 0) {
        const contextBlock = Object.entries(msg.context)
          .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
          .join('\n');

        messages.splice(messages.length - 1, 0, {
          role: 'system',
          content: `[Context]\n${contextBlock}`,
        });
      }

      await streamCompletion(tenant, messages, {
        onChunk(text: string) {
          send(ws, { type: 'chunk', content: text });
        },
        async onDone(fullContent: string, usage) {
          await appendMessage(conversationId, 'assistant', fullContent);
          send(ws, { type: 'done', conversationId, usage });
          isStreaming = false;
        },
        onError(err: Error) {
          console.error(`[ws] stream error: tenant=${tenantId}`, err.message);
          send(ws, { type: 'error', message: 'LLM streaming failed' });
          isStreaming = false;
        },
      });
    });

    ws.on('close', () => {
      console.log(`[ws] disconnected: tenant=${tenantId} conv=${conversationId}`);
    });
  });

  return wss;
}
