import React from 'react';
import type { PlayerState } from '@ai-werewolf/shared';
import { RoleIcon, ROLE_COLORS, SheriffCrown } from './RoleIcon.js';

interface PlayerCardProps {
  player: PlayerState;
  isSpeaking?: boolean;
  onClick?: () => void;
  showRole?: boolean;
  isSelected?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isSpeaking, onClick, showRole, isSelected }) => {
  const roleColor = ROLE_COLORS[player.roleType] || '#94a3b8';
  // 观众视角（非上帝视角）不显示身份：统一用匿名问号图腾 + 中性灰
  const iconRole = showRole ? player.roleType : 'unknown';
  const iconColor = showRole
    ? (player.isAlive ? roleColor : '#6b7280')
    : '#8a8fa3';

  const statusClass = player.isAlive
    ? isSpeaking
      ? 'ring-2 ring-gold-400 shadow-[0_0_18px_rgba(255,210,77,0.45)] scale-110 z-20'
      : isSelected
        ? 'ring-2 ring-purple-400 shadow-[0_0_16px_rgba(167,139,250,0.4)] scale-110 z-20'
        : 'ring-1 ring-white/15 hover:ring-gold-400/60 hover:-translate-y-1'
    : 'opacity-30 saturate-0';

  return (
    <div
      className={`w-[76px] rounded-2xl py-2 flex flex-col items-center gap-1 cursor-pointer
        transition-all duration-300 relative backdrop-blur select-none ${statusClass}
        ${onClick ? 'hover:shadow-[0_6px_20px_rgba(0,0,0,0.5)]' : ''}`}
      onClick={onClick}
      title={onClick ? '点击查看详情' : undefined}
    >
      {/* 卡片底：暗夜玻璃质感 */}
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10" />

      {/* 死亡：墓碑盖层 */}
      {!player.isAlive && (
        <div className="absolute inset-0 -z-[5] rounded-2xl bg-night-900/60" />
      )}

      {/* 头像框 */}
      <div className={`relative ${player.isAlive && isSpeaking ? 'animate-pulse-ring' : ''}`}>
        <RoleIcon
          role={iconRole}
          size={44}
          color={iconColor}
        />
        {/* 发言：金色喇叭气泡 */}
        {isSpeaking && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold-500 text-night-950
            flex items-center justify-center text-[11px] font-bold shadow-gold-glow animate-bounce">
            ♪
          </span>
        )}
        {/* 警长徽章 */}
        {player.isSheriff && player.isAlive && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-gold-300 to-gold-600
            flex items-center justify-center shadow-gold-glow border border-white/40">
            <SheriffCrown size={12} className="text-night-950" />
          </span>
        )}
      </div>

      {/* 座位号 */}
      <span className={`text-[11px] font-bold leading-none ${player.isAlive ? 'text-gray-100' : 'text-gray-500'}`}>
        {player.seatNumber}号
      </span>

      {/* 身份（上帝视角） */}
      {showRole && player.isAlive && (
        <span className="text-[10px] leading-none font-medium" style={{ color: roleColor }}>
          {player.roleType === 'wolf' ? '狼人' : player.roleType === 'seer' ? '预言家' : player.roleType === 'witch' ? '女巫' : player.roleType === 'hunter' ? '猎人' : player.roleType === 'idiot' ? '白痴' : '平民'}
        </span>
      )}

      {/* 死亡标记 */}
      {!player.isAlive && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl text-red-400/80 font-black">✕</span>
        </span>
      )}
    </div>
  );
};
