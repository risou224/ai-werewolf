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
          <span className="text-xs text-gray-400 w-8 text-right">{item.seatNumber}号</span>
          <div className="flex-1 h-5 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-500 rounded"
              style={{ width: `${(item.votes / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-4">{item.votes}</span>
        </div>
      ))}
    </div>
  );
};
