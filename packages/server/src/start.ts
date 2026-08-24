import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { initSchema } from './db/schema.js';
import { seedRolesAndBoards } from './db/seed-roles.js';
import { seedDefaultPromptsIfEmpty } from './prompts/seed.js';
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

export interface StartServerOptions {
  /** 是否自动打开浏览器（独立 Node 用；Electron 自己开窗口，传 false） */
  openBrowser?: boolean;
  /** 前端静态资源目录（默认 process.cwd()/web）。Electron 打包时指向资源目录 */
  webDir?: string;
  /** 优先端口（默认 SERVER_PORT || 3001，被占用会自动找空端口） */
  port?: number;
}

export interface ServerHandle {
  app: FastifyInstance;
  port: number;
  url: string;
}

/** 托管前端静态资源（web/ 存在时生效；dev 模式无 web/ 自动跳过） */
function registerStaticWeb(app: FastifyInstance, webDir: string): boolean {
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

  app.get('/assets/*', (req, reply) => {
    serveFile(reply, 'assets/' + (req.params as any)['*']);
  });

  // 启动器小窗口
  const serveLauncher = (_req: any, reply: any) => serveFile(reply, 'launcher.html');
  app.get('/launcher', serveLauncher);
  app.get('/launcher.html', serveLauncher);

  // SPA 回退
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

/** 启动后端（HTTP + Socket.IO + 规则引擎）。Electron 主进程与独立 Node 都走这里。 */
export async function startServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  await initSchema();
  await seedRolesAndBoards();
  await seedDefaultPromptsIfEmpty();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const io = new SocketServer(app.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  registerSocketHandlers(io);
  registerAdminRoutes(app, io);
  registerSpectatorRoutes(app);

  const webDir = options.webDir || path.join(here, 'web');
  const servingWeb = registerStaticWeb(app, webDir);

  const preferredPort = options.port ?? parseInt(process.env.SERVER_PORT || '3001', 10);

  // 端口策略：优先 preferredPort；被占用则自动扫描下一段区间；区间被占满则退回系统随机端口。
  // 任何机器上（哪怕 3001-3200 全被占用）都能启动，绝不让端口问题导致程序退出。
  let PORT = preferredPort;
  for (;;) {
    try {
      await app.listen({ port: PORT, host: '0.0.0.0' });
      if (PORT === 0) {
        const addr = app.server.address();
        if (addr && typeof addr === 'object') PORT = addr.port;
      }
      break;
    } catch (err: any) {
      if (err?.code !== 'EADDRINUSE') throw err;
      if (PORT !== 0) console.log(`⚠️ 端口 ${PORT} 已被占用，正在查找可用端口…`);
      if (PORT === 0) throw err;
      try {
        PORT = await findAvailablePort(PORT + 1);
      } catch {
        console.log(`⚠️ 端口 ${preferredPort}-${preferredPort + 200} 均被占用，改用系统随机端口`);
        PORT = 0;
      }
    }
  }
  if (PORT !== preferredPort) {
    console.log(`已自动切换到端口 ${PORT}`);
  }
  const url = `http://localhost:${PORT}`;
  console.log(`Server running on ${url}`);

  if (options.openBrowser && servingWeb) {
    console.log('已托管前端页面，正在打开浏览器…');
    openBrowser(url);
    openBrowser(url + '/launcher');
  }

  return { app, port: PORT, url };
}
