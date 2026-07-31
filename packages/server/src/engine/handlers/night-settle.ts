import { randomUUID } from 'crypto';
import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';

export class NightSettleHandler implements PhaseHandler {
  phase: GamePhase = 'night_settle';

  async execute(ctx: HandlerContext): Promise<void> {
    // 查找本轮狼人刀人事件
    const killEvent = ctx.events
      .filter(e => e.type === 'wolf_kill' && e.round === ctx.session.round)
      .pop();

    if (!killEvent || !killEvent.targetSeat) {
      ctx.broadcastState();
      await ctx.wait(500);
      return;
    }

    const targetSeat = killEvent.targetSeat;

    // 检查女巫是否救了该目标
    const healEvent = ctx.events
      .filter(e => e.type === 'witch_heal' && e.round === ctx.session.round && e.targetSeat === targetSeat)
      .pop();

    // 检查该目标是否已被女巫毒死
    const alreadyDead = !ctx.session.players.find(p => p.seatNumber === targetSeat)?.isAlive;

    if (!healEvent && !alreadyDead) {
      const target = ctx.session.players.find(p => p.seatNumber === targetSeat);
      if (target) {
        target.isAlive = false;
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'night_settle',
          type: 'death',
          actorSeat: null,
          targetSeat,
          data: { cause: 'wolf' },
          timestamp: now,
        });
      }
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }
}
