import { Server as SocketServer } from 'socket.io';
import { getDb } from '../db/connection.js';

export function registerSocketHandlers(io: SocketServer): void {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join_game', async (gameId: string) => {
      socket.join(`game:${gameId}`);
      console.log(`[Socket] ${socket.id} joined game ${gameId}`);

      // 发送当前游戏状态
      try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM game_sessions WHERE status IN ("running","paused") ORDER BY created_at DESC LIMIT 1');
        if (result.length > 0 && result[0].values.length > 0) {
          const row: Record<string, any> = {};
          result[0].columns.forEach((c, i) => { row[c] = result[0].values[0][i]; });
          // Parse JSON fields
          if (typeof row.players === 'string') row.players = JSON.parse(row.players);
          socket.emit('game_state', {
            phase: row.phase,
            round: row.round,
            status: row.status,
            players: row.players,
            sheriffSeat: row.sheriff_seat,
            winner: row.winner,
            currentSpeaker: row.current_speaker,
            speechOrder: row.speech_order ? JSON.parse(row.speech_order) : [],
          });
        }
      } catch (err) {
        console.error('[Socket] 获取游戏状态失败:', err);
      }
    });

    socket.on('leave_game', (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}
