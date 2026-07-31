import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { initSchema } from './db/schema.js';
import { seedRolesAndBoards } from './db/seed-roles.js';
import { registerAdminRoutes } from './service/admin-routes.js';
import { registerSpectatorRoutes } from './service/spectator-routes.js';
import { registerSocketHandlers } from './service/socket-handler.js';
import { findAvailablePort } from './utils/port-finder.js';

async function main() {
  await initSchema();
  await seedRolesAndBoards();
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const httpServer = app.server;
  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  registerSocketHandlers(io);
  registerAdminRoutes(app, io);
  registerSpectatorRoutes(app);

  const preferredPort = parseInt(process.env.SERVER_PORT || '3001', 10);
  const PORT = await findAvailablePort(preferredPort);
  if (PORT !== preferredPort) {
    console.log(`⚠️ 端口 ${preferredPort} 已被占用，已自动切换到端口 ${PORT}`);
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${PORT}`);
}

main().catch(console.error);
