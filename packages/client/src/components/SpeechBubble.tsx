import React from 'react';

interface SpeechBubbleProps {
  seatNumber: number;
  content: string;
  isCurrent?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ seatNumber, content, isCurrent }) => {
  return (
    <div className={`p-3 rounded-lg mb-2 ${isCurrent ? 'bg-gray-700 ring-1 ring-yellow-400' : 'bg-gray-800'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-yellow-400 font-bold text-sm">{seatNumber}号玩家</span>
        {isCurrent && <span className="text-yellow-400 text-xs animate-pulse">🎤 发言中</span>}
      </div>
      <p className="text-gray-200 text-sm leading-relaxed">{content}</p>
    </div>
  );
};
