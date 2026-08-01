import React from 'react';
import { RoleIcon, ROLE_COLORS } from './RoleIcon.js';

interface SpeechBubbleProps {
  seatNumber: number;
  content: string;
  isCurrent?: boolean;
  roleType?: string;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ seatNumber, content, isCurrent, roleType }) => {
  const roleColor = ROLE_COLORS[roleType || ''] || '#94a3b8';

  return (
    <div className={`p-3 rounded-card mb-2 border transition-all duration-300 ${
      isCurrent
        ? 'bg-gold-500/10 border-gold-400/50 shadow-gold-glow'
        : 'bg-white/[0.04] border-white/10'
    }`}>
      <div className="flex items-center gap-2 mb-1.5">
        <RoleIcon role={roleType || 'unknown'} size={22} withBg={!!roleType} />
        <span className="text-gold-400 font-bold text-sm">{seatNumber}号玩家</span>
        {isCurrent && (
          <span className="text-gold-300 text-xs animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" /> 发言中
          </span>
        )}
      </div>
      <p className="text-gray-200 text-sm leading-relaxed pl-1" style={{ borderLeft: `2px solid ${roleColor}33` }}>
        {content}
      </p>
    </div>
  );
};
