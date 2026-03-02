import { createServer } from 'http';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { config } from './config.js';
import { redis } from './store/redis.js';
import { loadTenants } from './tenants/router.js';
import tokenRouter from './routes/token.js';
import { setupWebSocket } from './ws/handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve public dir: works from both src/ (dev) and dist/ (production)
const publicDir = resolve(__dirname, '..', 'public');

// Load tenant config
loadTenants();

const app = express();
app.use(express.json());

// Serve demo chat UI
app.use(express.static(publicDir));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// REST routes
app.use(tokenRouter);

// Create HTTP server and attach WebSocket
const server = createServer(app);
const wss = setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`[gateway] listening on port ${config.port}`);
  console.log(`[gateway] Demo:   http://localhost:${config.port}`);
  console.log(`[gateway] REST:   http://localhost:${config.port}/api/token`);
  console.log(`[gateway] WS:     ws://localhost:${config.port}/ws`);
  console.log(`[gateway] Health: http://localhost:${config.port}/health`);
});

// Graceful shutdown
function shutdown(): void {
  console.log('\n[gateway] shutting down...');
  wss.close(() => {
    server.close(() => {
      redis.disconnect();
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
