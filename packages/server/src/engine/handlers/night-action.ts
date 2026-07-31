import { randomUUID } from 'crypto';
import type { GamePhase, PlayerState } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { ROLE_DEFS } from '../roles.js';
import { parallelCall, majorityVote, extractTargetNumber } from '../../utils/parallel-call.js';

/**
 * 通用夜晚行动 handler — 根据 roleType 和 skill_tags 自动分派技能
 * - wolf_team：狼人并行击杀（多数决）
 * - seer_check：预言家查验
 * - witch_action：女巫救毒（含首夜禁毒规则）
 * - 其他：通用单人行动，调用 stage='night_<roleType>'
 */
export class NightActionHandler implements PhaseHandler {
  constructor(public readonly roleType: string) {}

  get phase(): GamePhase {
    return `night_${this.roleType}` as GamePhase;
  }

  async execute(ctx: HandlerContext): Promise<void> {
    const def = ctx.getRoleDef(this.roleType);
    const tags = def.skillTags;

    const aliveOfRole = ctx.session.players.filter(p => p.isAlive && p.roleType === this.roleType);
    if (aliveOfRole.length === 0) {
      ctx.broadcastState();
      await ctx.wait(500);
      return;
    }

    if (tags.includes('wolf_team')) {
      await this.wolfKill(ctx, aliveOfRole);
    } else if (tags.includes('seer_check')) {
      await this.seerCheck(ctx, aliveOfRole[0]);
    } else if (tags.includes('witch_action')) {
      await this.witchAction(ctx, aliveOfRole[0]);
    } else {
      // 默认：单人夜晚行动（守卫、白痴王等扩展角色用）
      await this.defaultAction(ctx, aliveOfRole[0]);
    }
  }

  private async wolfKill(ctx: HandlerContext, wolves: PlayerState[]): Promise<void> {
    const config = await ctx.getConfig();
    const mode: string = config.wolf_decision_mode || 'first';

    const results = await parallelCall(
      wolves.map(wolf => ({
        label: `${wolf.seatNumber}号狼人`,
        fn: () => ctx.callPlayerModel(wolf, 'wolf_kill', {
          wolfBuddies: wolves.filter(w => w.seatNumber !== wolf.seatNumber).map(w => `${w.seatNumber}号`).join('、') || '无同伴',
        }),
      })),
      { timeoutMs: 30000, fallback: () => ({ thinking: null, internal: null, public_: null }) }
    );

    ctx.broadcastState();

    const wolfThoughts = results.map((r, idx) => ({
      seat: wolves[idx].seatNumber,
      thinking: r.thinking,
      internal: r.internal,
      public_: r.public_,
    }));

    let targetSeat: number | null = null;
    if (mode === 'first') {
      for (const r of results) {
        const seat = extractTargetNumber(r);
        if (seat !== null) { targetSeat = seat; break; }
      }
    } else {
      const votes = results.map(r => extractTargetNumber(r)).filter((v): v is number => v !== null);
      targetSeat = majorityVote(votes);
    }

    const now = new Date().toISOString();

    if (targetSeat === null) {
      await ctx.addEvent({
        id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_wolf',
        type: 'wolf_skip', actorSeat: null, targetSeat: null,
        data: { wolfThoughts, note: '狼人未达成击杀决策' }, timestamp: now,
      });
      ctx.broadcastState();
      await ctx.wait(1500);
      return;
    }

    await ctx.addEvent({
      id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_wolf',
      type: 'wolf_kill', actorSeat: null, targetSeat,
      data: { wolfThoughts }, timestamp: now,
    });
    ctx.broadcastState();
    await ctx.wait(1500);
  }

  private async seerCheck(ctx: HandlerContext, seer: PlayerState): Promise<void> {
    const result = await ctx.callPlayerModel(seer, 'seer_check');
    const targetSeat = this.parseTarget(result.internal);
    const now = new Date().toISOString();

    if (targetSeat === null) {
      await ctx.addEvent({
        id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_seer',
        type: 'seer_check', actorSeat: seer.seatNumber, targetSeat: null,
        data: { isWolf: null, thinking: result.thinking, internal: result.internal, public_: result.public_, note: '未给出有效查验目标' },
        timestamp: now,
      });
      ctx.broadcastState();
      await ctx.wait(1000);
      return;
    }

    const target = ctx.session.players.find(p => p.seatNumber === targetSeat);
    const isWolf = target ? target.camp === 'evil' : false;

    await ctx.addEvent({
      id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_seer',
      type: 'seer_check', actorSeat: seer.seatNumber, targetSeat,
      data: { isWolf, thinking: result.thinking, internal: result.internal, public_: result.public_ },
      timestamp: now,
    });

    ctx.broadcastState();
    await ctx.wait(1000);
  }

  private async witchAction(ctx: HandlerContext, witch: PlayerState): Promise<void> {
    const config = await ctx.getConfig();
    const firstNightPoisonAllowed = config.first_night_witch_poison !== false;
    const isFirstNight = ctx.session.round === 1;

    const killEvent = ctx.events
      .filter(e => e.type === 'wolf_kill' && e.round === ctx.session.round)
      .pop();

    const attackedSeat = killEvent?.targetSeat ?? null;
    const attackerIsSelf = attackedSeat === witch.seatNumber;

    let nightInfo: string;
    if (attackedSeat === null) nightInfo = '今晚无人被袭击。';
    else if (attackerIsSelf) nightInfo = `今晚你被袭击了！`;
    else nightInfo = `今晚 ${attackedSeat}号 被袭击了。`;

    let healAvailable = witch.witchHasHeal && !witch.witchUsedHeal;
    let poisonAvailable = witch.witchHasPoison && !witch.witchUsedPoison;
    // 首夜禁毒规则
    if (!firstNightPoisonAllowed && isFirstNight) {
      poisonAvailable = false;
    }

    const result = await ctx.callPlayerModel(witch, 'witch_action', {
      nightInfo,
      healStatus: healAvailable ? '可用' : '已使用',
      healAvailable: attackedSeat !== null ? (healAvailable ? '可以救' : '无法救') : '无人被刀',
      poisonStatus: poisonAvailable ? '可用' : (isFirstNight && !firstNightPoisonAllowed ? '首夜禁用' : '已使用'),
      poisonAvailable: poisonAvailable ? '可以毒人' : '已用毒',
    });

    const action = result.internal || '';
    const now = new Date().toISOString();
    let witchActed = false;

    const healMatch = action.match(/救\s*(\d+)/);
    let healTarget: number | null = null;
    if (healMatch && healAvailable && attackedSeat !== null) {
      healTarget = parseInt(healMatch[1], 10);
      witch.witchUsedHeal = true;
      witchActed = true;
      await ctx.addEvent({
        id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_witch',
        type: 'witch_heal', actorSeat: witch.seatNumber, targetSeat: healTarget,
        data: { thinking: result.thinking, internal: result.internal }, timestamp: now,
      });
    }

    const poisonMatch = action.match(/毒\s*(\d+)/);
    if (poisonMatch && poisonAvailable) {
      const poisonTarget = parseInt(poisonMatch[1], 10);
      const poisonPlayer = ctx.session.players.find(p => p.seatNumber === poisonTarget);
      if (!poisonPlayer || !poisonPlayer.isAlive) {
        // skip
      } else if (healTarget !== null && healTarget === poisonTarget) {
        // skip
      } else {
        poisonPlayer.isAlive = false;
        witch.witchUsedPoison = true;
        witchActed = true;
        await ctx.addEvent({
          id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_witch',
          type: 'witch_poison', actorSeat: witch.seatNumber, targetSeat: poisonTarget,
          data: { thinking: result.thinking, internal: result.internal }, timestamp: now,
        });
        await ctx.addEvent({
          id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_witch',
          type: 'death', actorSeat: null, targetSeat: poisonTarget,
          data: { cause: 'poison' }, timestamp: now,
        });
      }
    }

    if (!witchActed) {
      await ctx.addEvent({
        id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: 'night_witch',
        type: 'witch_skip', actorSeat: witch.seatNumber, targetSeat: null,
        data: { thinking: result.thinking, internal: result.internal, note: '女巫未使用药水' },
        timestamp: now,
      });
    }

    ctx.broadcastState();
    await ctx.wait(1000);
  }

  private async defaultAction(ctx: HandlerContext, player: PlayerState): Promise<void> {
    // 通用单人夜晚行动：调 night_<roleType> prompt stage
    const stage = `night_${this.roleType}`;
    const result = await ctx.callPlayerModel(player, stage);
    const targetSeat = this.parseTarget(result.internal);
    const now = new Date().toISOString();
    await ctx.addEvent({
      id: randomUUID(), sessionId: ctx.session.id, round: ctx.session.round, phase: this.phase,
      type: `${this.roleType}_action` as any, actorSeat: player.seatNumber, targetSeat,
      data: { thinking: result.thinking, internal: result.internal, public_: result.public_ },
      timestamp: now,
    });
    ctx.broadcastState();
    await ctx.wait(1000);
  }

  private parseTarget(internal: string | null): number | null {
    if (!internal) return null;
    const match = internal.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}