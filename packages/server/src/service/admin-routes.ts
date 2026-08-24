import type { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';
import { getDb, saveDb } from '../db/connection.js';
import { nanoid } from 'nanoid';
import { createPlayerState, loadRoleDefs } from '../engine/roles.js';
import { GameOrchestrator } from './game-orchestrator.js';
import type { RoleType, PlayerState, GameSession } from '@ai-werewolf/shared';
import { getAllBoardPresets } from '../db/seed-roles.js';

// 保存活跃的游戏编排器引用
const activeGames = new Map<string, GameOrchestrator>();

export function registerAdminRoutes(app: FastifyInstance, io: SocketServer): void {
  // ============ 模型管理 ============
  app.get('/api/admin/models', async () => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM model_configs ORDER BY created_at DESC');
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  });

  app.post<{ Body: { name: string; endpoint: string; apiKey?: string; modelId: string; providerId?: string | null } }>(
    '/api/admin/models', async (req) => {
    const db = await getDb();
    const id = nanoid();
    const now = new Date().toISOString();
    // providerId 为空字符串时归一化为 NULL（独立模型，兼容老逻辑）
    const providerId = req.body.providerId || null;
    db.run('INSERT INTO model_configs (id, name, endpoint, api_key, model_id, provider_id, enabled, max_qpm, timeout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 30, 30, ?, ?)',
      [id, req.body.name, req.body.endpoint, req.body.apiKey, req.body.modelId, providerId, now, now]);
    saveDb();
    return { id, ok: true };
  });

  app.put<{ Body: { name: string; endpoint: string; apiKey?: string; modelId: string; enabled?: number; providerId?: string | null } }>(
    '/api/admin/models/:id', async (req) => {
    const { id } = req.params as any;
    const db = await getDb();
    const now = new Date().toISOString();
    const b = req.body;
    const providerId = b.providerId === undefined ? undefined : (b.providerId || null);
    // providerId 为 undefined 时保留原值
    if (providerId === undefined) {
      db.run('UPDATE model_configs SET name=?, endpoint=?, api_key=?, model_id=?, enabled=?, updated_at=? WHERE id=?',
        [b.name, b.endpoint, b.apiKey, b.modelId, b.enabled ?? 1, now, id]);
    } else {
      db.run('UPDATE model_configs SET name=?, endpoint=?, api_key=?, model_id=?, provider_id=?, enabled=?, updated_at=? WHERE id=?',
        [b.name, b.endpoint, b.apiKey, b.modelId, providerId, b.enabled ?? 1, now, id]);
    }
    saveDb();
    return { ok: true };
  });

  app.delete('/api/admin/models/:id', async (req) => {
    const { id } = req.params as any;
    const db = await getDb();
    db.run('DELETE FROM model_configs WHERE id = ?', [id]);
    saveDb();
    return { ok: true };
  });

  // 测试端点连通性（发送 GET /models 请求）
  app.post<{ Body: { endpoint: string; apiKey?: string } }>(
    '/api/admin/models/test', async (req) => {
    try {
      const url = `${req.body.endpoint.replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {};
      if (req.body.apiKey) headers['Authorization'] = `Bearer ${req.body.apiKey}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // 从端点拉取可用模型列表
  app.post<{ Body: { endpoint: string; apiKey?: string } }>(
    '/api/admin/models/fetch-models', async (req) => {
    try {
      const url = `${req.body.endpoint.replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {};
      if (req.body.apiKey) headers['Authorization'] = `Bearer ${req.body.apiKey}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, models: [] };
      const data = await res.json() as any;
      const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
      return { ok: true, models };
    } catch (err: any) {
      return { ok: false, error: err.message, models: [] };
    }
  });

  // ============ API 提供商管理（一个 API 挂多个模型） ============

  // 获取所有 API 提供商（含各自挂载的模型列表）
  app.get('/api/admin/providers', async () => {
    const db = await getDb();
    const pResult = db.exec('SELECT * FROM api_providers ORDER BY created_at DESC');
    const providers = pResult.length === 0 ? [] : pResult[0].values.map(row => {
      const obj: Record<string, any> = {};
      pResult[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });

    const mResult = db.exec('SELECT * FROM model_configs WHERE provider_id IS NOT NULL');
    const modelsByProvider: Record<string, any[]> = {};
    if (mResult.length > 0) {
      mResult[0].values.forEach(row => {
        const obj: Record<string, any> = {};
        mResult[0].columns.forEach((col, i) => { obj[col] = row[i]; });
        const pid = obj.provider_id;
        if (!modelsByProvider[pid]) modelsByProvider[pid] = [];
        modelsByProvider[pid].push(obj);
      });
    }

    return providers.map(p => ({
      ...p,
      models: modelsByProvider[p.id] || [],
    }));
  });

  // 创建 API 提供商（可选：同时批量添加初始模型）
  app.post<{ Body: { name: string; endpoint: string; apiKey?: string; models?: Array<{ modelId: string; name?: string }> } }>(
    '/api/admin/providers', async (req) => {
    const db = await getDb();
    const id = nanoid();
    const now = new Date().toISOString();
    db.run('INSERT INTO api_providers (id, name, endpoint, api_key, enabled, max_qpm, timeout, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 30, 30, ?, ?)',
      [id, req.body.name, req.body.endpoint, req.body.apiKey || '', now, now]);

    // 批量添加初始模型
    const models = req.body.models || [];
    for (const m of models) {
      const mid = nanoid();
      db.run('INSERT INTO model_configs (id, name, endpoint, api_key, model_id, provider_id, enabled, max_qpm, timeout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 30, 30, ?, ?)',
        [mid, m.name || m.modelId, req.body.endpoint, req.body.apiKey || '', m.modelId, id, now, now]);
    }
    saveDb();
    return { id, ok: true, addedModels: models.length };
  });

  // 更新 API 提供商（名称/endpoint/apiKey 变更时，同步其下模型的 endpoint/api_key）
  app.put<{ Params: { id: string }; Body: { name?: string; endpoint?: string; apiKey?: string; enabled?: number } }>(
    '/api/admin/providers/:id', async (req) => {
    const { id } = req.params;
    const db = await getDb();
    const now = new Date().toISOString();
    const b = req.body;

    const current = db.prepare('SELECT * FROM api_providers WHERE id = ?');
    current.bind([id]);
    if (!current.step()) { current.free(); return { ok: false, error: 'API 提供商不存在' }; }
    const old = current.getAsObject();
    current.free();

    const name = b.name ?? old.name;
    const endpoint = b.endpoint ?? old.endpoint;
    const apiKey = b.apiKey === undefined ? old.api_key : b.apiKey;
    const enabled = b.enabled ?? old.enabled;

    db.run('UPDATE api_providers SET name=?, endpoint=?, api_key=?, enabled=?, updated_at=? WHERE id=?',
      [name, endpoint, apiKey, enabled, now, id]);

    // 同步其下所有模型的 endpoint / api_key
    db.run('UPDATE model_configs SET endpoint=?, api_key=?, updated_at=? WHERE provider_id=?',
      [endpoint, apiKey, now, id]);
    saveDb();
    return { ok: true };
  });

  // 删除 API 提供商（级联删除其下所有模型）
  app.delete<{ Params: { id: string } }>('/api/admin/providers/:id', async (req) => {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM model_configs WHERE provider_id = ?', [id]);
    db.run('DELETE FROM api_providers WHERE id = ?', [id]);
    saveDb();
    return { ok: true };
  });

  // 向已有 API 提供商批量添加模型（去重：同 provider 下 model_id 已存在则跳过）
  app.post<{ Params: { id: string }; Body: { models: Array<{ modelId: string; name?: string }> } }>(
    '/api/admin/providers/:id/models', async (req) => {
    const { id } = req.params;
    const db = await getDb();
    const now = new Date().toISOString();

    const provStmt = db.prepare('SELECT endpoint, api_key FROM api_providers WHERE id = ?');
    provStmt.bind([id]);
    if (!provStmt.step()) { provStmt.free(); return { ok: false, error: 'API 提供商不存在' }; }
    const prov = provStmt.getAsObject();
    provStmt.free();

    // 现有 model_id 集合（去重用）
    const existStmt = db.prepare('SELECT model_id FROM model_configs WHERE provider_id = ?');
    existStmt.bind([id]);
    const existing = new Set<string>();
    while (existStmt.step()) {
      const row = existStmt.getAsObject();
      existing.add(row.model_id as string);
    }
    existStmt.free();

    let added = 0;
    let skipped = 0;
    for (const m of req.body.models) {
      if (existing.has(m.modelId)) { skipped++; continue; }
      const mid = nanoid();
      db.run('INSERT INTO model_configs (id, name, endpoint, api_key, model_id, provider_id, enabled, max_qpm, timeout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 30, 30, ?, ?)',
        [mid, m.name || m.modelId, prov.endpoint, prov.api_key, m.modelId, id, now, now]);
      existing.add(m.modelId);
      added++;
    }
    saveDb();
    return { ok: true, added, skipped };
  });

  // ============ 游戏配置 ============
  app.get('/api/admin/game-configs', async () => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM game_configs ORDER BY created_at DESC');
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => {
        const val = row[i];
        // 解析 JSON 字段
        if ((col === 'roles' || col === 'players') && typeof val === 'string') {
          try { obj[col] = JSON.parse(val); } catch { obj[col] = val; }
        } else {
          obj[col] = val;
        }
      });
      return obj;
    });
  });

  app.post<{ Body: {
      name: string; totalPlayers: number;
      roles: string[];
      players: Array<{ seatNumber: number; modelConfigId: string; modelInstanceLabel: string; systemPrompt: string }>;
      sheriffEnabled: boolean;
      boardPresetId?: string;
      rules?: Record<string, any>;
    }}>('/api/admin/game-configs', async (req) => {
      const db = await getDb();
      const id = nanoid();
      const now = new Date().toISOString();
      const b = req.body;
      const boardPresetId = b.boardPresetId || null;
      // 当前 DB schema 中 rules 信息存在 board_presets，这里只存 boardPresetId
      db.run(`INSERT INTO game_configs (id, name, total_players, roles, players, board_preset_id,
        sheriff_enabled,
        sheriff_vote_weight, first_night_witch_poison, max_speech_chars, wolf_decision_mode, tie_break,
        cross_game_memory, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?,
        ?, 1.5, 1, 300, 'first', 'pk', 3, ?, ?)`,
        [id, b.name, b.totalPlayers, JSON.stringify(b.roles), JSON.stringify(b.players),
        boardPresetId,
        b.sheriffEnabled ? 1 : 0, now, now]);
      saveDb();
      return { id, ok: true };
    });

    // ============ 角色定义与板子预设 ============
    app.get('/api/admin/role-defs', async () => {
      const { getAllRoleDefs } = await import('../db/seed-roles.js');
      const defs = await getAllRoleDefs();
      return [...defs.values()];
    });

    app.get('/api/admin/board-presets', async () => {
      return await getAllBoardPresets();
    });

    app.post<{ Body: {
      name: string; totalPlayers: number; roles: string[]; rules?: Record<string, any>;
    }}>('/api/admin/board-presets', async (req) => {
      const db = await getDb();
      const id = `custom_${nanoid(8)}`;
      const now = new Date().toISOString();
      const b = req.body;
      db.run(
        `INSERT INTO board_presets (id, name, total_players, roles, rules, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, b.name, b.totalPlayers, JSON.stringify(b.roles), JSON.stringify(b.rules || {}), now, now]
      );
      saveDb();
      return { id, ok: true };
    });

    app.delete<{ Params: { id: string } }>('/api/admin/board-presets/:id', async (req) => {
      const db = await getDb();
      const { id } = req.params;
      const stmt = db.prepare('SELECT is_builtin FROM board_presets WHERE id = ?');
      stmt.bind([id]);
      if (!stmt.step()) {
        stmt.free();
        return { ok: false, error: '板子不存在' };
      }
      const isBuiltin = stmt.getAsObject().is_builtin;
      stmt.free();
      if (isBuiltin) return { ok: false, error: '内置板子不可删除' };
      db.run('DELETE FROM board_presets WHERE id = ?', [id]);
      saveDb();
      return { ok: true };
    });

  // ============ 游戏控制 ============
  app.post<{ Body: { configId: string } }>('/api/admin/game/start', async (req) => {
    const db = await getDb();
    const { configId } = req.body;

    // 查配置
    const configStmt = db.prepare('SELECT * FROM game_configs WHERE id = ?');
    configStmt.bind([configId]);
    if (!configStmt.step()) {
      configStmt.free();
      return { ok: false, error: '配置不存在' };
    }
    const config = configStmt.getAsObject();
    configStmt.free();

    // 解析角色列表
    let roles: RoleType[];
    try { roles = JSON.parse(config.roles); } catch { roles = []; }

    let seatConfigs: Array<{ seatNumber: number; modelConfigId: string; modelInstanceLabel: string; systemPrompt: string }>;
    try { seatConfigs = JSON.parse(config.players); } catch { seatConfigs = []; }

    if (roles.length === 0 || seatConfigs.length === 0) {
      return { ok: false, error: '角色或座位配置为空' };
    }

    // 洗牌分配角色
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);

    // 创建玩家状态
    const players: PlayerState[] = seatConfigs.map((sc, i) => {
      const p = createPlayerState(sc.seatNumber, shuffledRoles[i] || 'villager');
      return p;
    });

    // 创建游戏会话
    const sessionId = nanoid();
    const now = new Date().toISOString();
    db.run('INSERT INTO game_sessions (id, config_id, status, phase, round, players, start_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionId, configId, 'running', 'idle', 1, JSON.stringify(players), now, now]);
    saveDb();

    // 启动编排器
    const session: GameSession = {
      id: sessionId,
      configId,
      status: 'running',
      phase: 'idle',
      round: 1,
      players,
      sheriffSeat: null,
      winner: null,
      currentSpeaker: null,
      speechOrder: [],
      startTime: now,
      endTime: null,
      createdAt: now,
    };

    const orchestrator = new GameOrchestrator(session, io);
        activeGames.set(sessionId, orchestrator);
        await loadRoleDefs(); // 确保 roles 缓存已就绪
        orchestrator.start().catch(console.error);

    return { ok: true, sessionId };
  });

  app.post('/api/admin/game/pause', async () => {
    for (const [id, g] of activeGames) {
      await g.pause();
    }
    return { ok: true };
  });

  app.post('/api/admin/game/resume', async () => {
    for (const [id, g] of activeGames) {
      await g.resume();
    }
    return { ok: true };
  });

  app.post('/api/admin/game/stop', async () => {
    for (const [id, g] of activeGames) {
      await g.stop();
    }
    activeGames.clear();
    return { ok: true };
  });

  app.get('/api/admin/game/status', async () => {
    const db = await getDb();
    const result = db.exec(
      `SELECT * FROM game_sessions ORDER BY created_at DESC LIMIT 1`
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { status: 'no_game' };
    }
    const { columns, values } = result[0];
    const row: Record<string, any> = {};
    columns.forEach((col, i) => { row[col] = values[0][i]; });
    return row;
  });

  // ============ Health ============
  // 返回真实端口，供启动器小窗口显示“服务端口 xxx”
  app.get('/api/health', async () => {
    const addr = app.server.address();
    const port = addr && typeof addr === 'object' && typeof (addr as any).port === 'number'
      ? (addr as any).port
      : null;
    return { status: 'ok', port, timestamp: new Date().toISOString() };
  });

  // ============ 彻底退出（仅本机） ============
  // 打包版使用：点击页面右上角「退出软件」按钮时调用，
  // 先保存数据库再退出进程，避免直接关黑框丢数据。
  app.post('/api/admin/shutdown', async (req, reply) => {
    const ip = req.ip;
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
      return reply.code(403).send({ ok: false, error: '仅允许本机操作' });
    }
    saveDb();
    reply.send({ ok: true });
    console.log('收到退出指令，数据库已保存，2 秒后退出…');
    setTimeout(() => process.exit(0), 500);
  });
}
