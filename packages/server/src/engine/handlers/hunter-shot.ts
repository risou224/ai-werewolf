import { randomUUID } from 'crypto';
import type { GamePhase, PlayerState } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { getAlive } from '../roles.js';

export class HunterShotHandler implements PhaseHandler {
  phase: GamePhase = 'hunter_shot';

  async execute(ctx: HandlerContext): Promise<void> {
    // 通过事件找到本轮最近死亡的猎人（且可以开枪）
    const recentDeathEvents = ctx.events
      .filter(e => e.type === 'death' && e.round === ctx.session.round)
      .reverse(); // 最近的在前
    let hunter = null as PlayerState | null;
    for (const evt of recentDeathEvents) {
      const player = ctx.session.players.find(p => p.seatNumber === evt.targetSeat);
      if (player && !player.isAlive && player.roleType === 'hunter' && player.hunterCanShoot) {
        hunter = player;
        break;
      }
    }

    if (!hunter) {
      ctx.broadcastState();
      return;
    }

    // 检查是否被女巫毒杀（猎人被毒不能开枪）
    const poisoned = ctx.events.some(
      e => e.type === 'witch_poison' && e.targetSeat === hunter.seatNumber && e.round === ctx.session.round
    );
    if (poisoned) {
      hunter.hunterCanShoot = false;
      ctx.broadcastState();
      return;
    }

    const alive = getAlive(ctx.session.players);
    const deathReason = '狼人刀杀或放逐';

    const result = await ctx.callPlayerModel(hunter, 'hunter_shot', {
      seatNumber: String(hunter.seatNumber),
      deathReason,
    });

    const action = result.internal || '';
    const shotMatch = action.match(/(\d+)/);
    if (!shotMatch || action.includes('不开枪')) {
      hunter.hunterCanShoot = false;
      ctx.broadcastState();
      return;
    }

    const targetSeat = parseInt(shotMatch[1], 10);
    const target = ctx.session.players.find(p => p.seatNumber === targetSeat);
    if (target && target.isAlive) {
      target.isAlive = false;
      hunter.hunterCanShoot = false;

      const now = new Date().toISOString();
      await ctx.addEvent({
        id: randomUUID(),
        sessionId: ctx.session.id,
        round: ctx.session.round,
        phase: 'hunter_shot',
        type: 'hunter_shot',
        actorSeat: hunter.seatNumber,
        targetSeat,
        data: { thinking: result.thinking, internal: result.internal },
        timestamp: now,
      });
      await ctx.addEvent({
        id: randomUUID(),
        sessionId: ctx.session.id,
        round: ctx.session.round,
        phase: 'hunter_shot',
        type: 'death',
        actorSeat: null,
        targetSeat,
        data: { cause: 'hunter' },
        timestamp: now,
      });
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }
}
