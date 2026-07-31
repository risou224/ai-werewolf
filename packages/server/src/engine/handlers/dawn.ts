import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler, HandlerContext } from './types.js';

export class DawnHandler implements PhaseHandler {
  phase: GamePhase = 'dawn';

  async execute(ctx: HandlerContext): Promise<void> {
    // dawn 阶段不调用 AI，仅广播夜间结果
    ctx.broadcastState();
    await ctx.wait(2000);
  }
}
