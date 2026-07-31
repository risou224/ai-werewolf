import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { initSchema } from './db/schema.js';
import { seedRolesAndBoards } from './db/seed-roles.js';
import { registerAdminRoutes } from './service/admin-routes.js';
import { registerSpectatorRoutes } from './service/spectator-routes.js';
import { registerSocketHandlers } from './service/socket-handler.js';
import { findAvailablePort } from './utils/port-finder.js';

declare const __dirname: string | undefined;
const here = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

/**
 * 托管打包版前端静态资源（仅当 web/ 目录存在时生效，如 pkg 打包产物）。
 * dev 模式（tsx）与 tsc 构建均无 web/ 目录，自动跳过，不影响开发流程。
 */
function registerStaticWeb(app: Fastify.FastifyInstance): boolean {
  const webDir = path.join(here, 'web');
  const indexHtml = path.join(webDir, 'index.html');
  if (!fs.existsSync(indexHtml)) return false;

  const serveFile = (reply: any, relPath: string) => {
    const file = path.resolve(webDir, relPath);
    if (!file.startsWith(webDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      reply.code(404).send('Not Found');
      return;
    }
    const type = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    reply.type(type).send(fs.readFileSync(file));
  };

  // 静态资源（vite 构建产物在 /assets/ 下）
  app.get('/assets/*', (req, reply) => {
    serveFile(reply, 'assets/' + (req.params as any)['*']);
  });

  // SPA 回退：其余路径一律返回 index.html（React Router 前端路由）
  app.get('/*', (_req, reply) => {
    reply.type('text/html; charset=utf-8').send(fs.readFileSync(indexHtml));
  });

  return true;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log('未能自动打开浏览器，请手动访问:', url);
  });
}

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

  // 打包版前端托管（web/ 存在时才注册，不影响 dev）
  const servingWeb = registerStaticWeb(app);

  const preferredPort = parseInt(process.env.SERVER_PORT || '3001', 10);
  const PORT = await findAvailablePort(preferredPort);
  if (PORT !== preferredPort) {
    console.log(`⚠️ 端口 ${preferredPort} 已被占用，已自动切换到端口 ${PORT}`);
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  const url = `http://localhost:${PORT}`;
  console.log(`Server running on ${url}`);
  if (servingWeb) {
    console.log('已托管前端页面，正在打开浏览器…');
    console.log('提示：退出软件请点击页面右上角红色「退出软件」按钮，或直接关闭本黑色窗口（X）。');
    openBrowser(url);
  }
}

main().catch(console.error);
