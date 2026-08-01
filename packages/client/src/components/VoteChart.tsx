import React from 'react';

interface VoteItem {
  seatNumber: number;
  votes: number;
}

interface VoteChartProps {
  votes: VoteItem[];
  maxVotes?: number;
}

export const VoteChart: React.FC<VoteChartProps> = ({ votes, maxVotes }) => {
  const max = maxVotes || Math.max(...votes.map(v => v.votes), 1);

  return (
    <div className="space-y-2">
      {votes.map((item) => (
        <div key={item.seatNumber} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-8 text-right shrink-0">{item.seatNumber}号</span>
          <div className="flex-1 h-5 bg-white/5 rounded-badge overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-wolfred-600 to-gold-500 rounded-badge transition-all duration-500"
              style={{ width: `${(item.votes / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-4 font-bold">{item.votes}</span>
        </div>
      ))}
    </div>
  );
};
