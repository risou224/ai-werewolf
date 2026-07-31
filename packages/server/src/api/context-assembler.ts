import type { PlayerState, GameSession, GameEvent } from '@ai-werewolf/shared';

export class ContextAssembler {
  assemble(actor: PlayerState, session: GameSession, recentEvents: GameEvent[]): string {
    const parts: string[] = [];

    const aliveList = session.players
      .filter(p => p.isAlive)
      .map(p => `${p.seatNumber}号`)
      .join('、');
    parts.push(`当前存活玩家：${aliveList}`);
    parts.push(`当前轮次：第 ${session.round} 天`);

    if (actor.roleType === 'wolf') {
      const wolfBuddies = session.players
        .filter(p => p.isAlive && p.roleType === 'wolf' && p.seatNumber !== actor.seatNumber)
        .map(p => `${p.seatNumber}号`);
      parts.push(`你的狼人同伴：${wolfBuddies.join('、') || '无（你已无同伴）'}`);
    }

    if (actor.roleType === 'seer') {
      const seerEvents = recentEvents.filter(
        e => e.type === 'seer_check' && e.actorSeat === actor.seatNumber
      );
      if (seerEvents.length > 0) {
        parts.push('你的查验记录：');
        for (const ev of seerEvents) {
          const result = (ev.data as any)?.isWolf ? '🔴 狼人' : '🟢 好人';
          parts.push(`- ${ev.targetSeat}号 → ${result}`);
        }
      }
    }

    if (recentEvents.length > 0) {
      parts.push('\n最近事件：');
      for (const ev of recentEvents.slice(-5)) {
        parts.push(`- ${this.eventSummary(ev)}`);
      }
    }

    return parts.join('\n');
  }

  private eventSummary(ev: GameEvent): string {
    switch (ev.type) {
      case 'wolf_kill': return `${ev.targetSeat}号被狼人袭击`;
      case 'seer_check': return `预言家查验了 ${ev.targetSeat}号`;
      case 'witch_heal': return `女巫使用了救药`;
      case 'witch_poison': return `女巫使用了毒药`;
      case 'death': return `${ev.targetSeat}号死亡`;
      case 'vote': return `${ev.actorSeat}号投票给 ${ev.targetSeat}号`;
      case 'eliminate': return `${ev.targetSeat}号被放逐`;
      default: return `${ev.type}: ${ev.targetSeat ?? ''}`;
    }
  }
}
