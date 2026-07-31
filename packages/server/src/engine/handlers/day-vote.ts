import { randomUUID } from 'crypto';
import type { GamePhase, PlayerState } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { getAlive, ROLE_DEFS } from '../roles.js';
import { parallelCall } from '../../utils/parallel-call.js';

export class DayVoteHandler implements PhaseHandler {
  phase: GamePhase = 'day_vote';

  async execute(ctx: HandlerContext): Promise<void> {
    const alive = getAlive(ctx.session.players);
    const config = await ctx.getConfig();
    const sheriffWeight = config.sheriff_vote_weight || 1.5;
    const tieBreak: string = config.tie_break || 'pk';

    // 收集发言摘要
    const speechSummaries = ctx.events
      .filter(e => e.type === 'speech' && e.round === ctx.session.round)
      .map(e => `${e.actorSeat}号: ${((e.data as any)?.content || '').slice(0, 80)}`)
      .join('\n');

    interface VoteRecord {
      voter: number;
      target: number | null; // null = 弃票
      thinking: string | null;
      internal: string | null;
      public_: string | null;
    }

    // 收集所有存活玩家的投票（并行调用）
    const results = await parallelCall(
      alive.map(player => {
        const def = ROLE_DEFS.get(player.roleType);
        return {
          label: `${player.seatNumber}号${def.name}`,
          fn: () => ctx.callPlayerModel(player, 'day_vote', {
            seatNumber: String(player.seatNumber),
            roleName: def.name,
            speechSummaries: speechSummaries || '暂无',
          }),
        };
      }),
      { timeoutMs: 30000, fallback: () => ({ thinking: null, internal: null, public_: null }) }
    );

    const votes: VoteRecord[] = results.map((result, i) => ({
      voter: alive[i].seatNumber,
      target: this.parseVote(result.public_),
      thinking: result.thinking,
      internal: result.internal,
      public_: result.public_,
    }));

    ctx.broadcastState();

    // 计票
    const tally = new Map<number, number>();
    for (const vote of votes) {
      if (vote.target === null) continue;
      const voter = alive.find(p => p.seatNumber === vote.voter);
      const weight = voter?.isSheriff ? sheriffWeight : 1;
      tally.set(vote.target, (tally.get(vote.target) || 0) + weight);

      // 记录投票事件
      const now = new Date().toISOString();
      await ctx.addEvent({
        id: randomUUID(),
        sessionId: ctx.session.id,
        round: ctx.session.round,
        phase: 'day_vote',
        type: 'vote',
        actorSeat: vote.voter,
        targetSeat: vote.target,
        data: { thinking: vote.thinking, internal: vote.internal, public_: vote.public_ },
        timestamp: now,
      });
    }

    ctx.broadcastState();
    await ctx.wait(1000);

    if (tally.size === 0) {
      // 无人被投出
      ctx.broadcastState();
      return;
    }

    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const tied = sorted.filter(s => s[1] === top[1]).map(s => s[0]);

    let eliminated: number | null;

    if (tied.length === 1) {
      eliminated = tied[0];
    } else {
      // 平票，按配置处理
      if (tieBreak === 'pk') {
        // 简化处理：平票无人出局（MVP 先走简单方案）
        eliminated = null;
      } else {
        eliminated = null;
      }
    }

    if (eliminated !== null) {
      const target = ctx.session.players.find(p => p.seatNumber === eliminated);
      if (target) {
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'day_vote',
          type: 'eliminate',
          actorSeat: null,
          targetSeat: eliminated,
          data: {},
          timestamp: now,
        });
      }
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }

  private parseVote(public_: string | null): number | null {
    if (!public_) return null;
    const trimmed = public_.trim();
    if (trimmed.includes('弃票') || trimmed.includes('弃权')) return null;
    const match = trimmed.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}
