import { randomUUID } from 'crypto';
import type { GamePhase, PlayerState } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { ROLE_DEFS, getAlive } from '../roles.js';

export class DaySpeechHandler implements PhaseHandler {
  phase: GamePhase = 'day_speech';

  async execute(ctx: HandlerContext): Promise<void> {
    const alive = getAlive(ctx.session.players);

    // 确定发言顺序：有警长从警长左手边开始，警长最后归票
    let speechOrder: number[];
    const sheriffSeat = ctx.session.sheriffSeat;

    if (sheriffSeat && alive.find(p => p.seatNumber === sheriffSeat)) {
      // 警长存活：从警长下家开始，警长最后
      const sorted = this.sortFromSeat(alive, sheriffSeat);
      // 警长移到末尾
      const idx = sorted.findIndex(s => s === sheriffSeat);
      if (idx >= 0) sorted.splice(idx, 1);
      speechOrder = [...sorted, sheriffSeat];
    } else {
      // 无警长：从存活最小号开始
      speechOrder = alive.map(p => p.seatNumber).sort((a, b) => a - b);
    }

    ctx.session.speechOrder = speechOrder;

    // 逐个发言
    for (let i = 0; i < speechOrder.length; i++) {
      const seat = speechOrder[i];
      const speaker = alive.find(p => p.seatNumber === seat);
      if (!speaker) continue;

      ctx.session.currentSpeaker = seat;
      ctx.broadcastState();

      const def = ROLE_DEFS.get(speaker.roleType);
      const previousSpeeches = ctx.events
        .filter(e => e.type === 'speech' && e.round === ctx.session.round)
        .map(e => (e.data as any)?.content || '')
        .join('\n');

      const result = await ctx.callPlayerModel(speaker, 'day_speech', {
        seatNumber: String(seat),
        roleName: def.name,
        campInfo: def.camp === 'good' ? '好人阵营' : '狼人阵营',
        speechOrder: String(i + 1),
        previousSpeeches: previousSpeeches || '暂无',
      });

      if (result.public_) {
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'day_speech',
          type: 'speech',
          actorSeat: seat,
          targetSeat: null,
          data: { content: result.public_, thinking: result.thinking, internal: result.internal },
          timestamp: now,
        });
        ctx.broadcastState();
      }

      await ctx.wait(1500);
    }

    ctx.session.currentSpeaker = null;
    ctx.broadcastState();
  }

  private sortFromSeat(players: PlayerState[], startSeat: number): number[] {
    const seats = players.map(p => p.seatNumber).sort((a, b) => a - b);
    const startIdx = seats.indexOf(startSeat);
    if (startIdx < 0) return seats;
    return [...seats.slice(startIdx), ...seats.slice(0, startIdx)];
  }
}
