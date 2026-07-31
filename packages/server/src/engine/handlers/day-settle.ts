import { randomUUID } from 'crypto';
import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';

export class DaySettleHandler implements PhaseHandler {
  phase: GamePhase = 'day_settle';

  async execute(ctx: HandlerContext): Promise<void> {
    // 查找本轮放逐事件
    const eliminateEvent = ctx.events
      .filter(e => e.type === 'eliminate' && e.round === ctx.session.round)
      .pop();

    if (eliminateEvent && eliminateEvent.targetSeat) {
      const target = ctx.session.players.find(p => p.seatNumber === eliminateEvent.targetSeat);
      if (target && target.isAlive) {
        target.isAlive = false;
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'day_settle',
          type: 'death',
          actorSeat: null,
          targetSeat: eliminateEvent.targetSeat,
          data: { cause: 'vote' },
          timestamp: now,
        });

        // 白痴被放逐时亮明身份
        if (target.roleType === 'idiot' && !target.idiotRevealed) {
          target.idiotRevealed = true;
          target.isAlive = true; // 白痴免死
          target.hasVoteRight = false; // 但失去投票权
        }
      }
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }
}
