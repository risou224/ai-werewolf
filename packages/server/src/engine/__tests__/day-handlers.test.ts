import { describe, it, expect } from 'vitest';
import type { GameSession, GameEvent, PlayerState } from '@ai-werewolf/shared';
import type { HandlerContext } from '../handlers/types.js';
import { createPlayerState } from '../roles.js';
import { PhaseStateMachine, buildNightSequence } from '../phase-machine.js';
import { SheriffElectionHandler } from '../handlers/sheriff-election.js';
import { DaySpeechHandler } from '../handlers/day-speech.js';
import { DayVoteHandler } from '../handlers/day-vote.js';
import { LastWordsHandler } from '../handlers/last-words.js';
import { SheriffTransferHandler } from '../handlers/sheriff-transfer.js';

// ===== 6 人局 fixture（复现「开启 6 人对局后界面卡死」的场景） =====
function makePlayers(): PlayerState[] {
  return [
    createPlayerState(1, 'wolf'),
    createPlayerState(2, 'wolf'),
    createPlayerState(3, 'seer'),
    createPlayerState(4, 'witch'),
    createPlayerState(5, 'villager'),
    createPlayerState(6, 'villager'),
  ];
}

function makeSession(players: PlayerState[], round = 1, sheriffSeat: number | null = null): GameSession {
  return {
    id: 'test-session',
    configId: 'test-config',
    status: 'running',
    phase: 'idle',
    round,
    players,
    sheriffSeat,
    winner: null,
    currentSpeaker: null,
    speechOrder: [],
    startTime: new Date().toISOString(),
    endTime: null,
    createdAt: new Date().toISOString(),
  };
}

function makeCtx(session: GameSession, events: GameEvent[] = []): HandlerContext {
  return {
    session,
    io: {} as any,
    events,
    addEvent: async () => {},
    broadcastState: () => {},
    getAlive: () => session.players.filter(p => p.isAlive),
    getConfig: async () => ({}),
    getRoleDef: (roleType: string) => ({
      type: roleType,
      name: roleType,
      camp: 'good',
      nightOrder: 0,
      skillTags: [],
      isBuiltin: true,
    }),
    callPlayerModel: async () => ({ thinking: null, internal: null, public_: null }),
    wait: async () => {},
  };
}

describe('白天阶段 handler 回归（v1.8 ROLE_DEFS 下标访问回归）', () => {
  // 回归测试：6 人局，无 LLM 输出（callPlayerModel 返回 null），
  // 所有白天 handler 必须能正常执行完，不抛 TypeError（v1.9 卡死根因）
  it('sheriff_election handler 正常执行（不再崩溃）', async () => {
    const session = makeSession(makePlayers());
    const ctx = makeCtx(session);
    await expect(new SheriffElectionHandler().execute(ctx)).resolves.toBeUndefined();
  });

  it('day_speech handler 正常执行（不再崩溃）', async () => {
    const session = makeSession(makePlayers());
    const ctx = makeCtx(session);
    await expect(new DaySpeechHandler().execute(ctx)).resolves.toBeUndefined();
  });

  it('day_vote handler 正常执行（不再崩溃）', async () => {
    const session = makeSession(makePlayers());
    const ctx = makeCtx(session);
    await expect(new DayVoteHandler().execute(ctx)).resolves.toBeUndefined();
  });

  it('last_words handler 对死亡玩家正常执行（不再崩溃）', async () => {
    const players = makePlayers();
    players[4].isAlive = false; // 5号死亡
    const session = makeSession(players);
    const deathEvent: GameEvent = {
      id: 'd1', sessionId: session.id, round: 1, phase: 'night_wolf',
      type: 'death', actorSeat: null, targetSeat: 5,
      data: { cause: 'wolf' }, timestamp: new Date().toISOString(),
    };
    const ctx = makeCtx(session, [deathEvent]);
    await expect(new LastWordsHandler().execute(ctx)).resolves.toBeUndefined();
  });

  it('sheriff_transfer handler 对死亡警长正常执行（不再崩溃）', async () => {
    const players = makePlayers();
    players[4].isAlive = false; // 5号警长死亡
    players[4].isSheriff = true;
    const session = makeSession(players, 3, 5);
    const ctx = makeCtx(session);
    await expect(new SheriffTransferHandler().execute(ctx)).resolves.toBeUndefined();
  });
});

describe('状态机：竞选阶段与 handler 注册表一致（v1.3 遗留矛盾）', () => {
  const seq = buildNightSequence(['wolf', 'seer', 'witch']);

  it('sheriff_election → day_speech 直连，不再经过无 handler 的 sheriff_speech/sheriff_vote', () => {
    const m = new PhaseStateMachine('sheriff_election', 1, seq);
    expect(m.next(makePlayers(), true)).toBe('day_speech');
  });

  it('完整首日流转：dawn → sheriff_election → day_speech → day_vote → day_settle → night_wolf', () => {
    const m = new PhaseStateMachine('dawn', 1, seq);
    const players = makePlayers();
    expect(m.next(players, true)).toBe('sheriff_election');
    expect(m.next(players, true)).toBe('day_speech');
    expect(m.next(players, true)).toBe('day_vote');
    expect(m.next(players, true)).toBe('day_settle');
    expect(m.next(players, true, [])).toBe('night_wolf');
  });

  it('每轮循环不再出现 sheriff_speech / sheriff_vote 阶段', () => {
    const m = new PhaseStateMachine('day_settle', 1, seq);
    const phases: string[] = [];
    const players = makePlayers();
    for (let i = 0; i < 12; i++) {
      phases.push(m.next(players, true, []));
    }
    expect(phases).not.toContain('sheriff_speech');
    expect(phases).not.toContain('sheriff_vote');
    expect(phases).toContain('day_speech');
    expect(phases).toContain('night_wolf');
  });
});
