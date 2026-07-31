import { randomUUID } from 'crypto';
import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { getAlive, ROLE_DEFS } from '../roles.js';

export class SheriffTransferHandler implements PhaseHandler {
  phase: GamePhase = 'sheriff_transfer';

  async execute(ctx: HandlerContext): Promise<void> {
    // 检查警长是否死亡
    const sheriffSeat = ctx.session.sheriffSeat;
    if (sheriffSeat === null) {
      ctx.broadcastState();
      return;
    }

    const sheriff = ctx.session.players.find(p => p.seatNumber === sheriffSeat);
    if (!sheriff || sheriff.isAlive) {
      ctx.broadcastState();
      return;
    }

    const alive = getAlive(ctx.session.players);
    if (alive.length === 0) {
      ctx.broadcastState();
      return;
    }

    const def = ROLE_DEFS.get(sheriff.roleType);
    const result = await ctx.callPlayerModel(sheriff, 'sheriff_transfer', {
      seatNumber: String(sheriffSeat),
      roleName: def.name,
      campInfo: def.camp === 'good' ? '好人阵营' : '狼人阵营',
    });

    const action = result.internal || '';
    const transferMatch = action.match(/(\d+)/);

    if (transferMatch && !action.includes('不移交')) {
      const newSheriffSeat = parseInt(transferMatch[1], 10);
      const newSheriff = ctx.session.players.find(p => p.seatNumber === newSheriffSeat);
      if (newSheriff && newSheriff.isAlive) {
        // 移除旧警长
        sheriff.isSheriff = false;
        // 设置新警长
        newSheriff.isSheriff = true;
        ctx.session.sheriffSeat = newSheriffSeat;

        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'sheriff_transfer',
          type: 'sheriff_transfer',
          actorSeat: sheriffSeat,
          targetSeat: newSheriffSeat,
          data: {},
          timestamp: now,
        });
      }
    } else {
      // 不移交，警徽消失
      sheriff.isSheriff = false;
      ctx.session.sheriffSeat = null;
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }
}
