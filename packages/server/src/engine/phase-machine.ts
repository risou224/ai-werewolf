import type { GamePhase, PlayerState, GameEvent } from '@ai-werewolf/shared';
import { getAlive } from './roles.js';

type TransitionCondition = (players: PlayerState[], round: number, sheriffEnabled: boolean) => boolean;

interface Transition {
  from: GamePhase;
  to: GamePhase;
  condition: TransitionCondition;
}

/**
 * 根据夜晚有技能的角色列表（按 nightOrder 排序）生成夜晚阶段序列
 * 返回的 phase 形如 'night_wolf'、'night_seer' 等
 */
export function buildNightSequence(roleTypes: string[]): GamePhase[] {
  return roleTypes.map(t => `night_${t}` as GamePhase);
}

export class PhaseStateMachine {
  private phase: GamePhase;
  private round: number;
  private nightSequence: GamePhase[];

  constructor(initialPhase: GamePhase = 'idle', round = 1, nightSequence: GamePhase[] = []) {
    this.phase = initialPhase;
    this.round = round;
    this.nightSequence = nightSequence;
  }

  private hasRole(players: PlayerState[], role: string): boolean {
    return players.some(p => p.isAlive && p.roleType === role);
  }

  /** 本轮夜晚是否有玩家死亡（用于 dawn → last_words） */
  private hasNightDeath(players: PlayerState[], round: number, events: GameEvent[]): boolean {
    return events.some(e => e.type === 'death' && e.round === round && (e.data as any)?.cause === 'wolf');
  }

  /** 本轮白天是否有玩家死亡（仅投票产生的死亡，避免夜晚死亡触发 day_settle → last_words 循环） */
  private hasDayDeath(players: PlayerState[], round: number, events: GameEvent[]): boolean {
    return events.some(e => e.type === 'death' && e.round === round && (e.data as any)?.cause === 'vote');
  }

  private hasSheriff(players: PlayerState[]): boolean {
    return players.some(p => p.isAlive && p.isSheriff);
  }

  getCurrentPhase(): GamePhase { return this.phase; }
  getRound(): number { return this.round; }
  setPhase(phase: GamePhase): void { this.phase = phase; }
  incrementRound(): void { this.round++; }
  getNightSequence(): GamePhase[] { return this.nightSequence; }

  next(players: PlayerState[], sheriffEnabled: boolean, events: GameEvent[] = []): GamePhase {
    const t = this.getTransitions(players, events);
    const match = t.find(t => t.from === this.phase && t.condition(players, this.round, sheriffEnabled));
    if (!match) throw new Error(`无有效阶段转换: ${this.phase}`);

    if (this.phase === 'day_settle' && match.to === 'night_wolf') {
      this.round++;
    }

    this.phase = match.to;
    return this.phase;
  }

  /** 根据当前 nightSequence 动态生成夜晚转换表 */
  private getNightTransitions(): Transition[] {
    if (this.nightSequence.length === 0) {
      // 兼容旧路径：未提供序列时退回硬编码（永远不该发生，但兜底）
      return [
        { from: 'night_wolf', to: 'night_seer', condition: () => true },
        { from: 'night_seer', to: 'night_witch', condition: () => true },
        { from: 'night_witch', to: 'night_settle', condition: () => true },
      ];
    }
    const trans: Transition[] = [];
    // 第一个夜晚阶段：只能从 idle 进来
    trans.push({ from: 'idle', to: this.nightSequence[0], condition: () => true });
    // 阶段间串联
    for (let i = 0; i < this.nightSequence.length; i++) {
      const cur = this.nightSequence[i];
      const next = i + 1 < this.nightSequence.length ? this.nightSequence[i + 1] : 'night_settle';
      trans.push({ from: cur, to: next, condition: () => true });
    }
    // 最后一个夜晚阶段到 night_settle
    const last = this.nightSequence[this.nightSequence.length - 1];
    trans.push({ from: last, to: 'night_settle', condition: () => true });
    return trans;
  }

  private getTransitions(players: PlayerState[], events: GameEvent[] = []): Transition[] {
    const fixed: Transition[] = [
      { from: 'night_settle',    to: 'dawn',              condition: () => true },
      { from: 'dawn',            to: 'last_words',        condition: (p, r) => this.hasNightDeath(p, r, events) },
      { from: 'dawn',            to: 'sheriff_election',  condition: (p, r, se) => r === 1 && se && !this.hasSheriff(p) },
      { from: 'dawn',            to: 'day_speech',        condition: (p, r, se) => r > 1 || !se || this.hasSheriff(p) },
      { from: 'last_words',      to: 'sheriff_election',  condition: (p, r, se) => r === 1 && se && !this.hasSheriff(p) },
      { from: 'last_words',      to: 'day_speech',        condition: (p, r, se) => r > 1 || !se || this.hasSheriff(p) },
      { from: 'last_words',      to: 'hunter_shot',       condition: (p) => p.some(pl => !pl.isAlive && pl.roleType === 'hunter' && pl.hunterCanShoot) },
      { from: 'sheriff_election',to: 'day_speech',        condition: () => true },
      { from: 'day_speech',      to: 'day_vote',          condition: () => true },
      { from: 'day_vote',        to: 'day_settle',        condition: () => true },
      { from: 'day_settle',      to: 'last_words',        condition: (p, r) => this.hasDayDeath(p, r, events) },
      { from: 'day_settle',      to: 'night_wolf',        condition: () => true },
      { from: 'hunter_shot',     to: 'sheriff_transfer',  condition: (p) => p.some(x => !x.isAlive && x.isSheriff) },
      { from: 'hunter_shot',     to: 'night_wolf',        condition: () => true },
      { from: 'sheriff_transfer',to: 'night_wolf',        condition: () => true },
      { from: 'game_over',       to: 'game_over',         condition: () => true },
    ];
    return [...this.getNightTransitions(), ...fixed];
  }
}