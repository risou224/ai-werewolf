import { randomUUID } from 'crypto';
import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { ROLE_DEFS } from '../roles.js';

export class LastWordsHandler implements PhaseHandler {
  phase: GamePhase = 'last_words';

  async execute(ctx: HandlerContext): Promise<void> {
    // 找到本轮死亡的所有玩家
    const deadThisRound = ctx.session.players.filter(p => {
      if (p.isAlive) return false;
      return ctx.events.some(e => e.type === 'death' && e.round === ctx.session.round && e.targetSeat === p.seatNumber);
    });

    if (deadThisRound.length === 0) {
      ctx.broadcastState();
      return;
    }

    for (const dead of deadThisRound) {
      const def = ROLE_DEFS.get(dead.roleType);
      const campInfo = def.camp === 'good' ? '好人阵营' : '狼人阵营';
      const deathInfo = '你已死亡，请留下遗言。';

      const result = await ctx.callPlayerModel(dead, 'last_words', {
        roleName: def.name,
        campInfo,
        deathInfo,
      });

      if (result.public_) {
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'last_words',
          type: 'speech',
          actorSeat: dead.seatNumber,
          targetSeat: null,
          data: { content: result.public_, thinking: result.thinking, internal: result.internal, type: 'last_words' },
          timestamp: now,
        });
      }
    }

    ctx.broadcastState();
    await ctx.wait(2000);
  }
}
