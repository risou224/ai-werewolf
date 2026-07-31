import { randomUUID } from 'crypto';
import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';
import { getAlive, ROLE_DEFS } from '../roles.js';
import { electSheriff } from '../sheriff.js';
import { parallelCall, callWithTimeout } from '../../utils/parallel-call.js';

export class SheriffElectionHandler implements PhaseHandler {
  phase: GamePhase = 'sheriff_election';

  async execute(ctx: HandlerContext): Promise<void> {
    const alive = getAlive(ctx.session.players);
    const config = await ctx.getConfig();
    const sheriffWeight = config.sheriff_vote_weight || 1.5;

    // Step 1: 参选决策 (parallel)
    const decisionResults = await parallelCall(
      alive.map(player => {
        const def = ROLE_DEFS.get(player.roleType);
        return {
          label: `${player.seatNumber}号${def.name}参选决策`,
          fn: () => ctx.callPlayerModel(player, 'sheriff_stand', { roleName: def.name }),
        };
      }),
      { timeoutMs: 30000, fallback: () => ({ thinking: null, internal: null, public_: null }) },
    );
    const candidates: number[] = [];
    decisionResults.forEach((result, i) => {
      const decision = result.internal || '';
      if (decision.includes('参选') && !decision.includes('不参选')) {
        candidates.push(alive[i].seatNumber);
      }
    });

    if (candidates.length === 0) {
      // 无人参选
      ctx.broadcastState();
      return;
    }

    ctx.broadcastState();
    await ctx.wait(1000);

    // Step 2: 竞选发言
    const candidateSpeeches: string[] = [];
    for (const seat of candidates) {
      const player = alive.find(p => p.seatNumber === seat);
      if (!player) continue;

      ctx.session.currentSpeaker = seat;
      ctx.broadcastState();

      const def = ROLE_DEFS.get(player.roleType);
      const result = await callWithTimeout(
        () => ctx.callPlayerModel(player, 'sheriff_speech', {
          seatNumber: String(seat),
          roleName: def.name,
        }),
        () => ({ thinking: null, internal: null, public_: null }),
        30000,
      );

      if (result.public_) {
        candidateSpeeches.push(result.public_);
        const now = new Date().toISOString();
        await ctx.addEvent({
          id: randomUUID(),
          sessionId: ctx.session.id,
          round: ctx.session.round,
          phase: 'sheriff_speech',
          type: 'speech',
          actorSeat: seat,
          targetSeat: null,
          data: { content: result.public_, thinking: result.thinking, internal: result.internal, type: 'sheriff_speech' },
          timestamp: now,
        });
        ctx.broadcastState();
      }
      await ctx.wait(1000);
    }

    ctx.session.currentSpeaker = null;
    ctx.broadcastState();

    // Step 3: 投票选警长 (parallel)
    const nonCandidates = alive.filter(p => !candidates.includes(p.seatNumber));
    const voteResults = await parallelCall(
      nonCandidates.map(player => {
        const def = ROLE_DEFS.get(player.roleType);
        return {
          label: `${player.seatNumber}号${def.name}投票`,
          fn: () => ctx.callPlayerModel(player, 'sheriff_vote', {
            seatNumber: String(player.seatNumber),
            roleName: def.name,
            candidateSpeeches: candidateSpeeches.join('\n') || '暂无',
          }),
        };
      }),
      { timeoutMs: 30000, fallback: () => ({ thinking: null, internal: null, public_: null }) },
    );
    const voteMap = new Map<number, number>();
    voteResults.forEach((result, i) => {
      const target = this.parseVote(result.public_);
      if (target !== null) {
        voteMap.set(nonCandidates[i].seatNumber, target);
      }
    });

    const result = electSheriff(voteMap, sheriffWeight, ctx.session.players);
    if (result.elected !== null) {
      ctx.session.sheriffSeat = result.elected;
      const now = new Date().toISOString();
      await ctx.addEvent({
        id: randomUUID(),
        sessionId: ctx.session.id,
        round: ctx.session.round,
        phase: 'sheriff_vote',
        type: 'sheriff_elect',
        actorSeat: null,
        targetSeat: result.elected,
        data: {},
        timestamp: now,
      });
    }

    ctx.broadcastState();
    await ctx.wait(1500);
  }

  private parseVote(public_: string | null): number | null {
    if (!public_) return null;
    const trimmed = public_.trim();
    if (trimmed.includes('弃票') || trimmed.includes('弃权')) return null;
    const match = trimmed.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}
