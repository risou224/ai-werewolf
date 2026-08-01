import React, { useMemo } from 'react';
import type { LogEntry } from '../../utils/log-format.js';
import { RoleIcon, ROLE_LABELS, ROLE_COLORS, SheriffCrown } from '../../components/RoleIcon.js';

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

/** 胜利飘带：一排斜向金色粒子 */
const ConfettiStrip: React.FC<{ wolfWin: boolean }> = ({ wolfWin }) => {
  const colors = wolfWin
    ? ['#ff5c6c', '#ff8fa0', '#ffd24d', '#ff5c6c', '#ffd24d']
    : ['#ffd24d', '#ffe9a8', '#4ade80', '#ffd24d', '#ffe9a8'];
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 3.7 + 1.5) % 100}%`,
    delay: `${(i % 9) * 0.22}s`,
    color: colors[i % colors.length],
    rotate: `${(i * 47) % 360}deg`,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-12px] w-[7px] h-[16px] rounded-sm opacity-0 confetti-fall"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
};

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
  const winnerColor = wolfWin ? '#ff5c6c' : '#4ade80';

  const mvpPlayer = mvp ? players.find(p => p.seatNumber === mvp.seat) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[680px] max-h-[90vh] rounded-2xl border overflow-y-auto animate-pop-in relative
        bg-night-900/95 backdrop-blur-xl shadow-card-glow"
        style={{ borderColor: `${winnerColor}55` }}
      >
        {/* ── 胜者横幅 ── */}
        <div className="px-8 py-6 text-center border-b relative overflow-hidden" style={{ borderColor: `${winnerColor}33` }}>
          <ConfettiStrip wolfWin={wolfWin} />
          <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-xl
            bg-gradient-to-r from-white/[0.08] to-white/[0.02] ring-1"
            style={{ boxShadow: `0 0 32px ${winnerColor}44`, ['--tw-ring-color' as any]: `${winnerColor}66` }}
          >
            <span className="text-4xl animate-bounce">{wolfWin ? '🐺' : '🛡️'}</span>
            <span className="text-2xl font-bold tracking-wide" style={{ color: winnerColor }}>
              {winnerLabel}
            </span>
          </div>
        </div>

        {/* ── MVP 区域 ── */}
        {mvp && mvpPlayer && (
          <div className="px-8 py-5 border-b border-white/10">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">🏆 本局 MVP</div>
            <div className="flex items-center justify-center gap-5">
              {/* 大头像 */}
              <RoleIcon
                role={mvpPlayer.roleType}
                size={64}
                color={mvpPlayer.isAlive ? ROLE_COLORS[mvpPlayer.roleType] || '#ffd24d' : '#6b7280'}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold gold-text">{mvpPlayer.seatNumber}号玩家</span>
                  <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-400/50 rounded-badge text-[11px] font-bold text-gold-300">
                    🏆 MVP
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400">
                    <span style={{ color: ROLE_COLORS[mvpPlayer.roleType] || '#94a3b8' }}>
                      {ROLE_LABELS[mvpPlayer.roleType] || mvpPlayer.roleType}
                    </span>
                  </span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-xs text-gray-400">
                    获得 <span className="text-gold-400 font-mono font-bold">{mvp.votes}</span> 票
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
              const roleColor = ROLE_COLORS[p.roleType] || '#94a3b8';
              return (
                <div
                  key={p.seatNumber}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors bg-white/[0.03]
                    ${p.camp === 'evil' ? 'border-wolfred-500/30' : 'border-white/10'}
                    ${p.seatNumber === mvp?.seat ? 'ring-1 ring-gold-400/50' : ''}`}
                  style={{ borderLeft: `3px solid ${roleColor}` }}
                >
                  {/* 图腾 */}
                  <RoleIcon role={p.roleType} size={36} color={p.isAlive ? roleColor : '#6b7280'} />

                  {/* 身份信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-100">
                        {p.seatNumber}号
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-badge font-medium ring-1 ${
                        p.camp === 'evil'
                          ? 'bg-wolfred-500/15 text-wolfred-400 ring-wolfred-500/30'
                          : 'bg-camp-good/15 text-camp-good ring-camp-good/30'
                      }`}>
                        {p.camp === 'evil' ? '狼人' : '好人'}
                      </span>
                      {p.isSheriff && <SheriffCrown size={13} className="text-gold-400" />}
                      {p.seatNumber === mvp?.seat && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gold-500/20 text-gold-300 rounded-badge font-bold ring-1 ring-gold-400/40">MVP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-medium" style={{ color: p.isAlive ? roleColor : '#6b7280' }}>
                        {ROLE_LABELS[p.roleType] || p.roleType}
                      </span>
                      {p.isAlive ? (
                        <span className="text-[10px] text-camp-good">● 存活</span>
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
        <div className="px-8 py-4 border-t border-white/10 text-center">
          <button
            onClick={() => window.open('/admin', '_blank')}
            className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all
              bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400
              text-night-950 shadow-gold-glow"
          >
            ⚙️ 返回游戏配置
          </button>
        </div>
      </div>
    </div>
  );
};
