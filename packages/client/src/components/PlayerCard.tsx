import React from 'react';
import type { PlayerState } from '@ai-werewolf/shared';

const ROLE_LABELS: Record<string, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫',
  hunter: '猎人', idiot: '白痴', villager: '平民',
};

const ROLE_COLORS: Record<string, string> = {
  wolf: 'text-red-400',
  seer: 'text-purple-400',
  witch: 'text-emerald-400',
  hunter: 'text-orange-400',
  idiot: 'text-sky-400',
  villager: 'text-gray-400',
};

interface PlayerCardProps {
  player: PlayerState;
  isSpeaking?: boolean;
  onClick?: () => void;
  showRole?: boolean;
  isSelected?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isSpeaking, onClick, showRole, isSelected }) => {
  const roleLabel = ROLE_LABELS[player.roleType] || player.roleType;
  const roleColor = ROLE_COLORS[player.roleType] || 'text-gray-400';

  const statusClass = player.isAlive
    ? isSpeaking
      ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20 scale-105'
      : isSelected
        ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-400/20 scale-105'
        : 'ring-1 ring-gray-700 hover:ring-gray-500'
    : 'opacity-25 grayscale';

  return (
    <div
      className={`w-[72px] h-[92px] rounded-xl bg-gray-800/90 border border-gray-700/50
        flex flex-col items-center justify-center cursor-pointer
        transition-all duration-300 relative backdrop-blur ${statusClass}
        ${onClick ? 'hover:bg-gray-700/90' : ''}`}
      onClick={onClick}
    >
      <span className="text-gray-100 text-xs font-bold">{player.seatNumber}号</span>
      {player.isSheriff && <span className="text-amber-400 text-sm absolute top-0.5 right-1">👑</span>}
      {showRole && (
        <span className={`text-[10px] mt-0.5 ${roleColor}`}>
          {roleLabel}
        </span>
      )}
      {!player.isAlive && (
        <span className="text-red-400 absolute text-2xl font-bold">✕</span>
      )}
      {isSpeaking && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-amber-400 text-[10px] animate-pulse">
          🎤
        </span>
      )}
      {/* 可点击提示 */}
      {onClick && player.isAlive && !isSpeaking && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-gray-600 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">
          📋
        </span>
      )}
    </div>
  );
};
