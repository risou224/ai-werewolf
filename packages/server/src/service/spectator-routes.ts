import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import fs from 'fs';
import path from 'path';

export function registerSpectatorRoutes(app: FastifyInstance): void {
  app.get('/api/game/state', async () => {
    const db = await getDb();
    const result = db.exec(
      `SELECT * FROM game_sessions WHERE status IN ('running','paused') ORDER BY created_at DESC LIMIT 1`
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { status: 'no_game' };
    }
    const { columns, values } = result[0];
    const row: Record<string, any> = {};
    columns.forEach((col, i) => { row[col] = values[0][i]; });
    return row;
  });

  app.get('/api/game/events', async () => {
    const db = await getDb();
    const result = db.exec(
      `SELECT * FROM game_events ORDER BY timestamp DESC LIMIT 50`
    );
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  });

  // 当前游戏状态（同广播格式）
  app.get('/api/game/current-state', async () => {
    const db = await getDb();
    const result = db.exec(
      'SELECT * FROM game_sessions WHERE status IN ("running","paused","finished") ORDER BY created_at DESC LIMIT 1'
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { status: 'no_game' };
    }
    const { columns, values } = result[0];
    const row: Record<string, any> = {};
    columns.forEach((c, i) => { row[c] = values[0][i]; });
    if (typeof row.players === 'string') row.players = JSON.parse(row.players);
    return {
      phase: row.phase,
      round: row.round,
      status: row.status,
      players: row.players,
      sheriffSeat: row.sheriff_seat,
      winner: row.winner,
      currentSpeaker: row.current_speaker,
      speechOrder: row.speech_order ? JSON.parse(row.speech_order) : [],
    };
  });

  // 回放列表
  app.get('/api/replays', async () => {
    const replayDir = path.join(process.cwd(), 'data', 'replays');
    if (!fs.existsSync(replayDir)) return [];
    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    return files.map(f => ({
      filename: f,
      path: `/api/replays/${f.replace('replay_', '').replace('.json', '')}`,
    }));
  });

  // 获取具体回放
  app.get<{ Params: { id: string } }>('/api/replays/:id', async (req) => {
    const { id } = req.params as any;
    const replayDir = path.join(process.cwd(), 'data', 'replays');
    const filePath = path.join(replayDir, `replay_${id}.json`);
    if (!fs.existsSync(filePath)) {
      return { status: 'not_found', error: '回放不存在' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  });
}
