import React from 'react';
import { StatusBadge } from '../../components/StatusBadge.js';

interface InfoPanelProps {
  gameState: {
    phase: string;
    round: number;
    status: string;
    sheriffSeat: number | null;
    winner: string | null;
    players: any[];
  };
  godMode?: boolean;
  onPlayerClick?: (seatNumber: number) => void;
  selectedSeat?: number | null;
}

const PHASE_LABELS: Record<string, string> = {
  idle: '未开始', night_wolf: '夜晚·狼人', night_seer: '夜晚·预言家',
  night_witch: '夜晚·女巫', night_settle: '结算中', dawn: '天亮',
  day_speech: '发言阶段', day_vote: '投票阶段', day_settle: '放逐结算',
  sheriff_election: '警长竞选', sheriff_speech: '竞选发言', sheriff_vote: '投票选警长',
  hunter_shot: '猎人开枪', sheriff_transfer: '警徽移交', game_over: '游戏结束',
};

const PHASE_ICONS: Record<string, string> = {
  idle: '⏳', night_wolf: '🐺', night_seer: '🔮', night_witch: '💊',
  night_settle: '⚙️', dawn: '🌅', day_speech: '💬', day_vote: '🗳️',
  day_settle: '⚖️', sheriff_election: '👑', sheriff_speech: '🎤',
  sheriff_vote: '🗳️', hunter_shot: '🔫', sheriff_transfer: '👑', game_over: '🏆',
};

const ROLE_LABELS: Record<string, string> = {
  wolf: '狼', seer: '预', witch: '巫',
  hunter: '猎', idiot: '白', villager: '民',
};

const ROLE_COLORS: Record<string, string> = {
  wolf: 'text-red-400',
  seer: 'text-purple-400',
  witch: 'text-emerald-400',
  hunter: 'text-orange-400',
  idiot: 'text-sky-400',
  villager: 'text-gray-400',
};

export const InfoPanel: React.FC<InfoPanelProps> = ({ gameState, godMode, onPlayerClick, selectedSeat }) => {
  const aliveCount = gameState.players.filter((p: any) => p.isAlive).length;
  const phaseIcon = PHASE_ICONS[gameState.phase] || '📌';
  const phaseLabel = PHASE_LABELS[gameState.phase] || gameState.phase;

  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 space-y-3 backdrop-blur flex flex-col h-full min-h-0">
      <h2 className="text-sm font-bold text-amber-400 tracking-wider shrink-0">游戏信息</h2>

      {/* 当前阶段 — 大字显示 */}
      <div className="bg-gray-800/60 rounded-lg px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{phaseIcon}</span>
          <div>
            <div className="text-xs text-gray-500">当前阶段</div>
            <div className="text-sm font-bold text-gray-100">{phaseLabel}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
        <div className="bg-gray-800/40 rounded px-2 py-1.5">
          <span className="text-gray-500">天数</span>
          <span className="text-gray-200 float-right">第 {gameState.round} 天</span>
        </div>
        <div className="bg-gray-800/40 rounded px-2 py-1.5">
          <span className="text-gray-500">存活</span>
          <span className="text-gray-200 float-right">{aliveCount} / {gameState.players.length} 人</span>
        </div>
      </div>

      {gameState.sheriffSeat && (
        <div className="flex justify-between text-xs shrink-0">
          <span className="text-gray-500">警长</span>
          <span className="text-amber-400">{gameState.sheriffSeat}号 👑</span>
        </div>
      )}
      {gameState.winner && (
        <div className="flex justify-between text-xs shrink-0">
          <span className="text-gray-500">胜者</span>
          <span className={gameState.winner === 'good' ? 'text-emerald-400' : 'text-red-400'}>
            {gameState.winner === 'good' ? '好人阵营' : '狼人阵营'}
          </span>
        </div>
      )}

      {/* 玩家状态列表 */}
      <div className="border-t border-gray-800 pt-2 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <h3 className="text-xs font-bold text-gray-400">玩家状态</h3>
          {godMode && <span className="text-[10px] text-purple-400">👁️ 含身份</span>}
        </div>
        <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0 pr-1">
          {gameState.players.map((p: any) => {
            const isSelected = selectedSeat === p.seatNumber;
            return (
              <div
                key={p.seatNumber}
                className={`flex items-center justify-between text-xs px-2 py-1 rounded cursor-pointer
                  transition-colors ${isSelected ? 'bg-purple-900/40' : 'hover:bg-gray-800/60'}`}
                onClick={() => onPlayerClick?.(p.seatNumber)}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 text-center font-bold ${p.isAlive ? 'text-gray-200' : 'text-gray-600'}`}>
                    {p.seatNumber}
                  </span>
                  {p.isSheriff && <span className="text-amber-400 text-[10px]">👑</span>}
                  {godMode && (
                    <span className={`text-[10px] ${ROLE_COLORS[p.roleType] || 'text-gray-400'}`}>
                      {ROLE_LABELS[p.roleType] || p.roleType}
                    </span>
                  )}
                </div>
                <StatusBadge
                  text={p.isAlive ? '存活' : '死亡'}
                  variant={p.isAlive ? 'alive' : 'dead'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 操作提示 */}
      {onPlayerClick && (
        <div className="text-[10px] text-gray-600 text-center shrink-0 border-t border-gray-800 pt-2">
          点击玩家查看详情
        </div>
      )}
    </div>
  );
};
