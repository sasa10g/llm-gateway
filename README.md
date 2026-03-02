# LLM Gateway

A multi-provider LLM gateway built with Node.js and TypeScript. Acts as a single control point for routing, streaming, and managing conversations across multiple LLM providers.

## Features

- **Multi-provider support** — OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible API (Groq, Mistral, DeepSeek, Ollama, Together, vLLM, LM Studio)
- **Ephemeral WebSocket tokens** — single-use tokens with configurable 5–15 min TTL
- **Conversation store** — Redis-backed message history for context and audit (24h TTL)
- **Real-time streaming** — LLM responses streamed over WebSocket as they generate
- **Tenant routing** — each tenant maps to a specific provider, model, system prompt, and limits
- **Demo chat UI** — built-in web interface for testing at `http://localhost:3000`
- **Dockerized** — single `docker compose up` starts everything (app + Redis)

## Architecture

```
Client                    LLM Gateway                   LLM Providers
  │                           │                              │
  ├──POST /api/token─────────►│ (API key → tenant)           │
  │◄──{ wsToken, exp }────────│                              │
  │                           │                              │
  ├──WS connect + token──────►│ (validate ephemeral token)   │
  │                           │                              │
  ├──{ message }─────────────►│──stream──► OpenAI            │
  │◄──chunk, chunk, chunk─────│◄──stream── Anthropic         │
  │◄──[DONE]──────────────────│           Google Gemini      │
  │                           │           Groq / Mistral ... │
  │                           │──store in Redis──────────────│
```

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
```

Edit `.env` and add at least one provider API key:

```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=your-google-gemini-key
```

### 2. Start with Docker

```bash
docker compose up --build
```

This starts Redis + the gateway on port 3000.

### 3. Open the demo

Go to **http://localhost:3000** — enter a tenant API key and start chatting.

Default demo keys:
- `acme-secret-key-123` → OpenAI gpt-4o
- `globex-secret-key-456` → OpenAI gpt-4o-mini

## Supported Providers

| Provider | `provider` value | Models (examples) | API Key |
|----------|------------------|--------------------|---------|
| **OpenAI** | `openai` | gpt-4o, gpt-4o-mini, o1 | `OPENAI_API_KEY` |
| **Anthropic** | `anthropic` | claude-sonnet-4-20250514, claude-3-5-haiku-20241022 | `ANTHROPIC_API_KEY` |
| **Google Gemini** | `google` | gemini-2.0-flash, gemini-1.5-pro | `GOOGLE_API_KEY` |
| **OpenAI-compatible** | `openai-compat` | Any model | Per-tenant `providerApiKey` + `baseUrl` |

### OpenAI-compatible endpoints

The `openai-compat` provider works with any API that implements the OpenAI chat completions format:

| Service | `baseUrl` | Notes |
|---------|-----------|-------|
| **Groq** | `https://api.groq.com/openai/v1` | Fast inference |
| **Together** | `https://api.together.xyz/v1` | Open-source models |
| **Mistral** | `https://api.mistral.ai/v1` | Mistral models |
| **DeepSeek** | `https://api.deepseek.com` | DeepSeek models |
| **Perplexity** | `https://api.perplexity.ai` | Search-augmented |
| **Ollama** | `http://ollama:11434/v1` (Docker) or `http://localhost:11434/v1` | Local models |
| **vLLM** | `http://localhost:8000/v1` | Self-hosted |
| **LM Studio** | `http://localhost:1234/v1` | Local GUI |

## Tenant Configuration

Tenants are configured in `tenants.json`. Each tenant maps to a provider, model, and settings.

### Structure

```json
{
  "tenants": {
    "tenant-id": {
      "name": "Display Name",
      "apiKey": "tenant-auth-key",
      "provider": "openai",
      "providerApiKey": "sk-optional-override",
      "baseUrl": "https://optional-for-compat",
      "model": "gpt-4o",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 2048,
      "rateLimit": 60
    }
  }
}
```

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the tenant |
| `apiKey` | Yes | Auth key clients use to access the gateway (`x-api-key` header) |
| `provider` | Yes | LLM provider: `openai`, `anthropic`, `google`, `openai-compat` |
| `providerApiKey` | No | Override the .env API key for this tenant |
| `baseUrl` | For `openai-compat` | API base URL for compatible endpoints |
| `model` | Yes | Model identifier (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |
| `systemPrompt` | Yes | System message injected into every conversation |
| `maxTokens` | Yes | Max completion tokens per response |
| `rateLimit` | Yes | Requests per minute (reserved for future use) |

### Example: Multiple providers

```json
{
  "tenants": {
    "tenant-openai": {
      "name": "OpenAI Team",
      "apiKey": "openai-team-key",
      "provider": "openai",
      "model": "gpt-4o",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 2048,
      "rateLimit": 60
    },
    "tenant-claude": {
      "name": "Claude Team",
      "apiKey": "claude-team-key",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 4096,
      "rateLimit": 30
    },
    "tenant-gemini": {
      "name": "Gemini Team",
      "apiKey": "gemini-team-key",
      "provider": "google",
      "model": "gemini-2.0-flash",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 2048,
      "rateLimit": 60
    },
    "tenant-groq": {
      "name": "Groq Fast",
      "apiKey": "groq-team-key",
      "provider": "openai-compat",
      "providerApiKey": "gsk_your_groq_key",
      "baseUrl": "https://api.groq.com/openai/v1",
      "model": "llama-3.3-70b-versatile",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 2048,
      "rateLimit": 30
    },
    "tenant-ollama": {
      "name": "Local Ollama",
      "apiKey": "ollama-local-key",
      "provider": "openai-compat",
      "baseUrl": "http://ollama:11434/v1",
      "model": "llama3.2",
      "systemPrompt": "You are a helpful assistant.",
      "maxTokens": 2048,
      "rateLimit": 100
    }
  }
}
```

## API Reference

### REST Endpoints

#### `GET /health`

Health check.

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":123.45}
```

#### `POST /api/token`

Issue an ephemeral WebSocket token.

**Headers:**
- `x-api-key: <tenant-api-key>` (required)
- `Content-Type: application/json`

**Body (optional):**
```json
{ "conversationId": "conv-xxx" }
```
Omit `conversationId` to start a new conversation.

**Response:**
```json
{
  "token": "uuid-ephemeral-token",
  "conversationId": "conv-xxx",
  "expiresAt": "2024-01-01T00:10:00.000Z"
}
```

### WebSocket Protocol

#### Connect

```
ws://localhost:3000/ws?token=<ephemeral-token>
```

Tokens are **single-use** — they are revoked immediately after connection.

#### Server → Client messages

| `type` | Description | Fields |
|--------|-------------|--------|
| `connected` | Connection established | `conversationId`, `tenant`, `provider`, `model` |
| `chunk` | Streaming content delta | `content` (text fragment) |
| `done` | Stream finished | `conversationId`, `usage` (`promptTokens`, `completionTokens`, `totalTokens`) |
| `error` | Error occurred | `message` |

#### Client → Server messages

| `type` | Description | Fields |
|--------|-------------|--------|
| `message` | Send a chat message | `content` (string, required) |

### Integration example (JavaScript)

```javascript
// Step 1: Get a WS token
const res = await fetch('http://localhost:3000/api/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-tenant-key',
  },
});
const { token, conversationId } = await res.json();

// Step 2: Connect WebSocket
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'connected':
      console.log(`Connected to ${msg.provider}/${msg.model}`);
      break;
    case 'chunk':
      process.stdout.write(msg.content); // stream to UI
      break;
    case 'done':
      console.log('Tokens used:', msg.usage.totalTokens);
      break;
    case 'error':
      console.error('Error:', msg.message);
      break;
  }
};

// Step 3: Send a message
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'message', content: 'Hello!' }));
};
```

### Integration example (cURL + wscat)

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/token \
  -H "Content-Type: application/json" \
  -H "x-api-key: acme-secret-key-123" | jq -r '.token')

# Connect and chat
wscat -c "ws://localhost:3000/ws?token=$TOKEN"
> {"type":"message","content":"Hello!"}
```

## Project Structure

```
llm-gateway/
├── Dockerfile                 # Multi-stage build (TS compile → production)
├── docker-compose.yml         # Gateway + Redis
├── .env.example               # Environment template
├── tenants.json               # Tenant → provider/model routing
├── tsconfig.json              # TypeScript configuration
├── package.json
│
└── src/
    ├── index.ts               # Express + WS server entry point
    ├── config.ts              # Environment config with types
    │
    ├── providers/             # LLM provider abstraction
    │   ├── types.ts           # LLMProvider interface
    │   ├── openai.ts          # OpenAI implementation
    │   ├── anthropic.ts       # Anthropic implementation
    │   ├── google.ts          # Google Gemini implementation
    │   ├── openai-compat.ts   # OpenAI-compatible (Groq, Ollama, etc.)
    │   └── index.ts           # Provider factory
    │
    ├── middleware/
    │   └── auth.ts            # API key → tenant resolution
    │
    ├── routes/
    │   └── token.ts           # POST /api/token endpoint
    │
    ├── ws/
    │   ├── handler.ts         # WebSocket connection + message dispatch
    │   └── stream.ts          # Provider routing + streaming relay
    │
    ├── store/
    │   ├── redis.ts           # ioredis client
    │   ├── tokens.ts          # Ephemeral token CRUD
    │   └── conversations.ts   # Conversation history CRUD
    │
    ├── tenants/
    │   └── router.ts          # Load tenants.json, resolve by key
    │
    └── public/
        └── index.html         # Demo chat UI
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `WS_TOKEN_TTL_MINUTES` | `10` | Ephemeral WS token lifetime |
| `CONVERSATION_TTL_HOURS` | `24` | Conversation history retention |
| `OPENAI_API_KEY` | — | Default OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Default Anthropic API key |
| `GOOGLE_API_KEY` | — | Default Google Gemini API key |

## Development

### Local dev (without Docker)

```bash
npm install

# Start Redis separately
docker run -d -p 6379:6379 redis:7-alpine

# Create .env with REDIS_URL=redis://localhost:6379
npm run dev   # uses tsx watch, auto-reloads
```

### Docker

```bash
docker compose up --build       # build and start
docker compose up -d            # detached mode
docker compose logs -f gateway  # follow logs
docker compose down             # stop
```

### Build TypeScript

```bash
npm run build    # compiles to dist/
npm start        # runs compiled JS
```

## How It Works

1. **Client authenticates** with tenant API key via `POST /api/token`
2. **Gateway issues** a single-use ephemeral WebSocket token (stored in Redis)
3. **Client connects** to `/ws?token=xxx` — token is validated and immediately revoked
4. **Client sends** `{ type: "message", content: "..." }` over WebSocket
5. **Gateway loads** conversation history from Redis, resolves tenant's provider
6. **Provider streams** the LLM response — chunks are relayed to client in real-time
7. **On completion** — full response is stored in Redis, usage stats sent to client
8. **Conversation persists** across messages within the same session (24h TTL)

## License

MIT
