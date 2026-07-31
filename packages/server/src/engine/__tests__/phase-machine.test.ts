import { describe, it, expect } from 'vitest';
import { PhaseStateMachine, buildNightSequence } from '../phase-machine.js';
import { createPlayerState } from '../roles.js';

describe('PhaseStateMachine', () => {
  const players = [
    createPlayerState(1, 'seer'),
    createPlayerState(2, 'witch'),
    createPlayerState(3, 'wolf'),
    createPlayerState(4, 'wolf'),
    createPlayerState(5, 'villager'),
    createPlayerState(6, 'villager'),
  ];

  // 标准 9 人局：wolf×3 + seer + witch + hunter + villager×3 — 夜晚序列为 wolf,seer,witch
  const standardSeq = buildNightSequence(['wolf', 'seer', 'witch']);

  it('buildNightSequence 生成正确序列', () => {
    expect(buildNightSequence(['wolf', 'seer', 'witch'])).toEqual(['night_wolf', 'night_seer', 'night_witch']);
  });

  it('起始 idle → night_wolf', () => {
    const m = new PhaseStateMachine('idle', 1, standardSeq);
    expect(m.next(players, true)).toBe('night_wolf');
  });

  it('night_wolf → night_seer', () => {
    const m = new PhaseStateMachine('night_wolf', 1, standardSeq);
    expect(m.next(players, true)).toBe('night_seer');
  });

  it('night_seer → night_witch', () => {
    const m = new PhaseStateMachine('night_seer', 1, standardSeq);
    expect(m.next(players, true)).toBe('night_witch');
  });

  it('night_witch → night_settle', () => {
    const m = new PhaseStateMachine('night_witch', 1, standardSeq);
    expect(m.next(players, true)).toBe('night_settle');
  });

  it('night_settle → dawn', () => {
    const m = new PhaseStateMachine('night_settle', 1, standardSeq);
    expect(m.next(players, true)).toBe('dawn');
  });

  it('dawn（第1轮，有警长模式）→ sheriff_election', () => {
    const m = new PhaseStateMachine('dawn', 1, standardSeq);
    expect(m.next(players, true)).toBe('sheriff_election');
  });

  it('dawn（第2轮）→ day_speech', () => {
    const m = new PhaseStateMachine('dawn', 2, standardSeq);
    expect(m.next(players, true)).toBe('day_speech');
  });

  it('全流程：idle → night_wolf → night_seer → night_witch → night_settle → dawn', () => {
    const m = new PhaseStateMachine('idle', 1, standardSeq);
    expect(m.next(players, true)).toBe('night_wolf');
    expect(m.next(players, true)).toBe('night_seer');
    expect(m.next(players, true)).toBe('night_witch');
    expect(m.next(players, true)).toBe('night_settle');
    expect(m.next(players, true)).toBe('dawn');
  });

  it('getRound / getCurrentPhase 正确', () => {
    const m = new PhaseStateMachine('idle', 1, standardSeq);
    expect(m.getCurrentPhase()).toBe('idle');
    expect(m.getRound()).toBe(1);
    m.next(players, true);
    expect(m.getCurrentPhase()).toBe('night_wolf');
  });

  it('【扩展】只有狼人的夜晚序列', () => {
    const seq = buildNightSequence(['wolf']);
    const m = new PhaseStateMachine('idle', 1, seq);
    expect(m.next(players, true)).toBe('night_wolf');
    expect(m.next(players, true)).toBe('night_settle');
  });

  it('【扩展】狼+女巫（无预言家）的夜晚序列', () => {
    const seq = buildNightSequence(['wolf', 'witch']);
    const m = new PhaseStateMachine('idle', 1, seq);
    expect(m.next(players, true)).toBe('night_wolf');
    expect(m.next(players, true)).toBe('night_witch');
    expect(m.next(players, true)).toBe('night_settle');
  });

  it('【扩展】自定义角色（night_wolf 之后是 night_guard）', () => {
      const seq = buildNightSequence(['wolf', 'guard']);
      const m = new PhaseStateMachine('idle', 1, seq);
      expect(m.next(players, true)).toBe('night_wolf');
      expect(m.next(players, true)).toBe('night_guard');
      expect(m.next(players, true)).toBe('night_settle');
    });

    it('【死循环修复】第一轮白天有人被投死→day_settle→last_words; 第二轮无人死→day_settle→night_wolf(round+1)', () => {
      const m = new PhaseStateMachine('night_settle', 1, standardSeq);
      // 第一晚结算（无死亡）→ dawn
      expect(m.next(players, true, [])).toBe('dawn');
      // 跳过 sheriff，进入 day_speech
      const daySpeechState = new PhaseStateMachine('day_speech', 1, standardSeq);
      expect(daySpeechState.next(players, true, [])).toBe('day_vote');
      // day_vote→day_settle（无人被放逐）
      expect(daySpeechState.next(players, true, [])).toBe('day_settle');
      // day_settle 在第一轮，如果有人被投票放逐（cause='vote'）→ last_words
      const eventsWithDayDeath = [{ type: 'death', round: 1, targetSeat: 3, phase: 'day_settle', data: { cause: 'vote' } } as any];
      const settleMachine = new PhaseStateMachine('day_settle', 1, standardSeq);
      expect(settleMachine.next(players, true, eventsWithDayDeath)).toBe('last_words');
      // 第二轮 day_settle，无人死 → night_wolf 且 round 应+1
      const settleMachineR2 = new PhaseStateMachine('day_settle', 2, standardSeq);
      expect(settleMachineR2.next(players, true, [])).toBe('night_wolf');
      expect(settleMachineR2.getRound()).toBe(3); // 进入第三天
    });

    it('【死循环修复】全场有死人但本轮无死亡事件→day_settle→night_wolf（不会卡死循环）', () => {
      // 模拟场上 3 号死了但本轮没产生 death 事件（如玩家在第一轮就死了）
      const deadPlayer = { ...createPlayerState(3, 'wolf'), isAlive: false };
      const playersWithDead = [...players, deadPlayer];
      const settleMachine = new PhaseStateMachine('day_settle', 2, standardSeq);
      // 第二轮 events 为空（无人死亡），应该走 night_wolf 而不是 last_words
      expect(settleMachine.next(playersWithDead, true, [])).toBe('night_wolf');
    });
});