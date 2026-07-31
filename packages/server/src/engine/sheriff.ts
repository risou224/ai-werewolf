import type { PlayerState } from '@ai-werewolf/shared';

export function electSheriff(
  votes: Map<number, number>,
  sheriffVoteWeight: number,
  players: PlayerState[]
): { elected: number | null; tied: number[] } {
  const tally = new Map<number, number>();
  for (const [voter, target] of votes) {
    const voterState = players.find(p => p.seatNumber === voter);
    if (!voterState || !voterState.hasVoteRight) continue;
    const weight = voterState.isSheriff ? sheriffVoteWeight : 1;
    tally.set(target, (tally.get(target) || 0) + weight);
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { elected: null, tied: [] };

  const top = sorted[0];
  const tied = sorted.filter(s => s[1] === top[1]).map(s => s[0]);

  if (tied.length === 1) {
    players.forEach(p => { if (p.seatNumber === tied[0]) p.isSheriff = true; });
    return { elected: tied[0], tied: [] };
  }
  return { elected: null, tied };
}
