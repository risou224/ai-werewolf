import React, { useState } from 'react';
import { SpeechBubble } from '../../components/SpeechBubble.js';

interface SpeechItem {
  seatNumber: number;
  content: string;
  isCurrent?: boolean;
}

// 占位组件 — 后续接入 Socket 真实数据
export const SpeechArea: React.FC = () => {
  const [speeches] = useState<SpeechItem[]>([]);

  return (
    <div className="w-full max-w-lg glass-card rounded-card p-4">
      <h3 className="text-sm font-bold text-gray-400 mb-3">发言区</h3>
      <div className="max-h-48 overflow-y-auto">
        {speeches.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-4">等待发言...</div>
        )}
        {speeches.map((s, i) => (
          <SpeechBubble key={i} seatNumber={s.seatNumber} content={s.content} isCurrent={s.isCurrent} />
        ))}
      </div>
    </div>
  );
};
