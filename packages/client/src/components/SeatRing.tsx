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
}

export const SeatRing: React.FC<SeatRingProps> = ({ players, currentSpeaker, centerLabel, showRoles, onPlayerClick, selectedSeats }) => {
  const total = players.length;
  const radius = total <= 8 ? 140 : total <= 12 ? 180 : 220;

  return (
    <div className="relative w-[500px] h-[500px] mx-auto">
      {players.map((player, i) => {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        const x = 250 + radius * Math.cos(angle) - 35;
        const y = 250 + radius * Math.sin(angle) - 45;
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
      {centerLabel && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          text-gray-500 text-base font-bold pointer-events-none tracking-widest text-center">
          {centerLabel}
        </div>
      )}
    </div>
  );
};
