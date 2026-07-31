import type { GamePhase } from '@ai-werewolf/shared';
import type { PhaseHandler } from './types.js';
import { NightActionHandler } from './night-action.js';
import { NightSettleHandler } from './night-settle.js';
import { DawnHandler } from './dawn.js';
import { LastWordsHandler } from './last-words.js';
import { SheriffElectionHandler } from './sheriff-election.js';
import { DaySpeechHandler } from './day-speech.js';
import { DayVoteHandler } from './day-vote.js';
import { DaySettleHandler } from './day-settle.js';
import { HunterShotHandler } from './hunter-shot.js';
import { SheriffTransferHandler } from './sheriff-transfer.js';

/**
 * 根据 nightSequence 动态构建 handler 注册表
 * nightSequence 是按 nightOrder 排序的有夜晚技能的角色列表
 * 如 ['wolf', 'seer', 'witch'] → 注册 night_wolf, night_seer, night_witch 三个 handler
 */
export function buildHandlerRegistry(nightSequence: string[]): Map<GamePhase, PhaseHandler> {
  const registry = new Map<GamePhase, PhaseHandler>();

  // 动态注册夜晚行动 handler
  for (const roleType of nightSequence) {
    registry.set(`night_${roleType}` as GamePhase, new NightActionHandler(roleType));
  }

  // 固定阶段 handler
  registry.set('night_settle', new NightSettleHandler());
  registry.set('dawn', new DawnHandler());
  registry.set('last_words', new LastWordsHandler());
  registry.set('sheriff_election', new SheriffElectionHandler());
  registry.set('day_speech', new DaySpeechHandler());
  registry.set('day_vote', new DayVoteHandler());
  registry.set('day_settle', new DaySettleHandler());
  registry.set('hunter_shot', new HunterShotHandler());
  registry.set('sheriff_transfer', new SheriffTransferHandler());

  return registry;
}

/** 兼容旧 API — 默认注册 wolf/seer/witch 三阶段 */
const defaultRegistry = buildHandlerRegistry(['wolf', 'seer', 'witch']);
export function getHandler(phase: GamePhase): PhaseHandler | undefined {
  return defaultRegistry.get(phase);
}