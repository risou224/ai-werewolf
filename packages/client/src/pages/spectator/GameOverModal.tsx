import React, { useMemo } from 'react';
import type { LogEntry } from '../../utils/log-format.js';

// ── types ──────────────────────────────────────────────
interface PlayerState {
  seatNumber: number;
  roleType: string;
  camp: string;
  isAlive: boolean;
  isSheriff: boolean;
  [key: string]: unknown;
}

interface GameState {
  phase: string;
  round: number;
  status: string;
  players: PlayerState[];
  sheriffSeat: number | null;
  winner: string | null;
  currentSpeaker: number | null;
  speechOrder: number[];
  errors?: string[];
  mvp?: { seatNumber: number; roleType: string; votes: number } | null;
}

interface GameOverModalProps {
  gameState: GameState;
  entries: LogEntry[];
}

// ── role config ────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫',
  hunter: '猎人', idiot: '白痴', villager: '平民',
};
const ROLE_ICONS: Record<string, string> = {
  wolf: '🐺', seer: '🔮', witch: '💊',
  hunter: '🔫', idiot: '🧠', villager: '👤',
};
const ROLE_ORDER: Record<string, number> = {
  wolf: 5, seer: 4, witch: 4, hunter: 4, idiot: 3, villager: 1,
};

/** 选取 MVP（优先用 gameState 中的 MVP 数据，否则按规则推算） */
function pickMVP(
  players: PlayerState[],
  winner: string,
  entries: LogEntry[],
  stateMVP?: { seatNumber: number; roleType: string; votes: number } | null,
): { seat: number; votes: number } | null {
  // 优先使用后端投票结果
  if (stateMVP && stateMVP.seatNumber) {
    return { seat: stateMVP.seatNumber, votes: stateMVP.votes };
  }

  const candidates = players
    .filter(p => p.camp === winner)
    .sort((a, b) => {
      // 存活 > 死亡
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      // 警长优先
      if (a.isSheriff !== b.isSheriff) return a.isSheriff ? -1 : 1;
      // 角色重要性
      const ra = ROLE_ORDER[a.roleType] || 0;
      const rb = ROLE_ORDER[b.roleType] || 0;
      if (ra !== rb) return rb - ra;
      // 座位号（小号优先）
      return a.seatNumber - b.seatNumber;
    });

  if (candidates.length === 0) return null;
  const mvp = candidates[0];
  return { seat: mvp.seatNumber, votes: 0 };
}

// ── component ──────────────────────────────────────────
export const GameOverModal: React.FC<GameOverModalProps> = ({ gameState, entries }) => {
  const winner = gameState.winner;
  const players = gameState.players;

  const mvp = useMemo(() => {
    if (!winner || players.length === 0) return null;
    return pickMVP(players, winner, entries, (gameState as any).mvp);
  }, [winner, players, entries, gameState]);

  if (!winner) return null;

  const wolfWin = winner === 'evil';
  const winnerLabel = wolfWin ? '狼人阵营获胜！' : '好人阵营获胜！';
  const winnerIcon = wolfWin ? '🐺' : '🛡️';

  const mvpPlayer = mvp ? players.find(p => p.seatNumber === mvp.seat) : null;

  // 阵营标签
  const campLabel = (p: PlayerState) => {
    if (p.camp === 'evil') return { text: '狼人', cls: 'bg-red-800/70 text-red-300' };
    return { text: '好人', cls: 'bg-green-800/70 text-green-300' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[680px] max-h-[90vh] bg-gray-900/95 rounded-2xl border border-amber-700/50 shadow-2xl shadow-amber-900/30 overflow-y-auto">
        {/* ── 胜者横幅 ── */}
        <div className={`px-8 py-6 text-center border-b ${wolfWin ? 'border-red-800/40' : 'border-green-800/40'}`}>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl ${
            wolfWin
              ? 'bg-gradient-to-r from-red-900/40 to-red-800/20 text-red-300'
              : 'bg-gradient-to-r from-green-900/40 to-green-800/20 text-green-300'
          }`}>
            <span className="text-4xl">{winnerIcon}</span>
            <span className="text-2xl font-bold tracking-wide">{winnerLabel}</span>
          </div>
        </div>

        {/* ── MVP 区域 ── */}
        {mvp && mvpPlayer && (
          <div className="px-8 py-5 border-b border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">🏆 本局 MVP</div>
            <div className="flex items-center justify-center gap-5">
              {/* 大头像 */}
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg ${
                mvpPlayer.isAlive
                  ? 'bg-gradient-to-br from-amber-700/60 to-amber-900/40 text-amber-200 border border-amber-500/50'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}>
                {mvpPlayer.isAlive ? '🏆' : '💀'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-amber-300">{mvpPlayer.seatNumber}号玩家</span>
                  <span className="px-2 py-0.5 bg-amber-600/30 border border-amber-500/40 rounded text-[11px] font-bold text-amber-400">
                    🏆 MVP
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400">
                    {ROLE_ICONS[mvpPlayer.roleType] || '❓'} {ROLE_LABELS[mvpPlayer.roleType] || mvpPlayer.roleType}
                  </span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-xs text-gray-400">
                    获得 <span className="text-amber-400 font-mono font-bold">{mvp.votes}</span> 票
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 全员身份揭秘 ── */}
        <div className="px-8 py-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">全员身份揭秘</div>
          <div className="grid grid-cols-2 gap-2">
            {players.map(p => {
              const camp = campLabel(p);
              return (
                <div
                  key={p.seatNumber}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    p.camp === 'evil'
                      ? 'bg-red-950/40 border-red-800/30'
                      : 'bg-gray-800/40 border-gray-700/30'
                  } ${p.seatNumber === mvp?.seat ? 'ring-1 ring-amber-500/40' : ''}`}
                >
                  {/* 座位号 */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    p.isAlive
                      ? 'bg-gray-800 text-gray-100'
                      : 'bg-gray-900 text-gray-600'
                  }`}>
                    {p.seatNumber}
                  </div>

                  {/* 身份信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-100">
                        {p.seatNumber}号
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${camp.cls}`}>
                        {camp.text}
                      </span>
                      {p.isSheriff && (
                        <span className="text-amber-400 text-xs">👑</span>
                      )}
                      {p.seatNumber === mvp?.seat && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-600/30 text-amber-400 rounded font-bold">MVP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[11px] ${p.isAlive ? 'text-gray-400' : 'text-gray-600'}`}>
                        {ROLE_ICONS[p.roleType] || '❓'} {ROLE_LABELS[p.roleType] || p.roleType}
                      </span>
                      {p.isAlive ? (
                        <span className="text-[10px] text-green-600">● 存活</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">● 死亡</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 底部按钮 ── */}
        <div className="px-8 py-4 border-t border-gray-800 text-center">
          <button
            onClick={() => window.open('/admin', '_blank')}
            className="px-6 py-2.5 bg-amber-700/60 hover:bg-amber-600/70 text-amber-200 rounded-lg text-sm font-medium transition-colors border border-amber-600/30 hover:border-amber-500/50"
          >
            ⚙️ 返回游戏配置
          </button>
        </div>
      </div>
    </div>
  );
};
