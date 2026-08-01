import React from 'react';
import type { PlayerState } from '@ai-werewolf/shared';
import { PlayerCard } from './PlayerCard.js';

interface SeatRingProps {
  players: PlayerState[];
  currentSpeaker: number | null;
  centerLabel?: string;
  showRoles?: boolean;
  onPlayerClick?: (seatNumber: number) => void;
  selectedSeats?: number[];
  /** 夜晚=true → 中央月亮；白天=false → 中央太阳 */
  isNight?: boolean;
}

/** 月亮 SVG */
const Moon: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
    <defs>
      <radialGradient id="moon-g" cx="0.38" cy="0.34" r="0.8">
        <stop offset="0%" stopColor="#fffbe8" />
        <stop offset="55%" stopColor="#ffe9a8" />
        <stop offset="100%" stopColor="#f0c060" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="17" fill="url(#moon-g)" />
    <circle cx="17" cy="19" r="3" fill="#e8cf8e" opacity="0.5" />
    <circle cx="27" cy="30" r="2.2" fill="#e8cf8e" opacity="0.45" />
    <circle cx="29" cy="17" r="1.6" fill="#e8cf8e" opacity="0.4" />
  </svg>
);

/** 太阳 SVG */
const Sun: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
    <defs>
      <radialGradient id="sun-g" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#fff3c4" />
        <stop offset="60%" stopColor="#ffd24d" />
        <stop offset="100%" stopColor="#f0a020" />
      </radialGradient>
    </defs>
    <g stroke="#ffd24d" strokeWidth="2.6" strokeLinecap="round">
      <line x1="24" y1="4" x2="24" y2="9" />
      <line x1="24" y1="39" x2="24" y2="44" />
      <line x1="4" y1="24" x2="9" y2="24" />
      <line x1="39" y1="24" x2="44" y2="24" />
      <line x1="10" y1="10" x2="13.6" y2="13.6" />
      <line x1="34.4" y1="34.4" x2="38" y2="38" />
      <line x1="38" y1="10" x2="34.4" y2="13.6" />
      <line x1="13.6" y1="34.4" x2="10" y2="38" />
    </g>
    <circle cx="24" cy="24" r="12.5" fill="url(#sun-g)" />
  </svg>
);

export const SeatRing: React.FC<SeatRingProps> = ({
  players, currentSpeaker, centerLabel, showRoles, onPlayerClick, selectedSeats, isNight,
}) => {
  const total = players.length;
  const radius = total <= 8 ? 148 : total <= 12 ? 185 : 225;

  return (
    <div className="relative w-[520px] h-[520px] mx-auto">
      {/* 环底：暗夜圆桌光晕 */}
      <div className="absolute inset-[52px] rounded-full pointer-events-none
        bg-[radial-gradient(circle,rgba(255,210,77,0.05)_0%,rgba(255,255,255,0.02)_45%,transparent_70%)]"
      />
      <div className="absolute inset-[76px] rounded-full pointer-events-none border border-white/5" />

      {players.map((player, i) => {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        const x = 260 + radius * Math.cos(angle) - 38;
        const y = 260 + radius * Math.sin(angle) - 56;
        const isSelected = selectedSeats?.includes(player.seatNumber) ?? false;
        return (
          <div
            key={player.seatNumber}
            className={`absolute transition-all duration-300 ${isSelected ? 'z-10' : ''}`}
            style={{ left: `${x}px`, top: `${y}px` }}
          >
            <PlayerCard
              player={player}
              isSpeaking={player.seatNumber === currentSpeaker}
              showRole={showRoles}
              onClick={onPlayerClick ? () => onPlayerClick(player.seatNumber) : undefined}
              isSelected={isSelected}
            />
          </div>
        );
      })}

      {/* 中央氛围层：月亮 / 太阳 + 标签 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
        <div className="flex flex-col items-center gap-2">
          <div className={`${isNight ? 'animate-float-y' : 'animate-spin-slow'}`}>
            {isNight ? <Moon size={72} /> : <Sun size={72} />}
          </div>
          <span className={`text-sm font-bold tracking-[0.35em] pl-[0.35em]
            ${isNight ? 'text-indigo-200/80' : 'text-gold-400/90'}`}>
            {centerLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
