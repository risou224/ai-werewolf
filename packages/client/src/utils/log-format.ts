import type { GameEvent } from '@ai-werewolf/shared';

export interface LogEntry {
  id: string;
  time: string;
  icon: string;
  text: string;
  kind?: 'speech' | 'system' | 'error';
  thinking?: string | null;
  internal?: string | null;
  wolfThoughts?: Array<{ seat: number; thinking: string | null; internal: string | null; public_: string | null }>;
  isError?: boolean;
}

const PHASE_TEXT: Record<string, string> = {
  night_wolf: '天黑请闭眼，狼人请睁眼',
  night_seer: '预言家请睁眼查验',
  night_witch: '女巫请睁眼',
  night_settle: '夜晚结算中',
  dawn: '天亮了',
  day_speech: '进入白天发言阶段',
  day_vote: '进入投票放逐阶段',
  sheriff_election: '警长竞选开始',
  sheriff_speech: '警长竞选发言',
  sheriff_vote: '警长投票',
  hunter_shot: '猎人开枪',
  sheriff_transfer: '警长移交警徽',
  game_over: '游戏结束',
};

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });
  } catch { return ''; }
}

/** 把单个游戏事件转成第三人称叙事条目 */
export function eventToEntry(ev: GameEvent): LogEntry {
  const time = formatTime(ev.timestamp);
  const a = ev.actorSeat;
  const t = ev.targetSeat;
  const d = ev.data || {};

  switch (ev.type) {
    case 'speech':
      return {
        id: ev.id, time, icon: '💬', kind: 'speech',
        text: `${a}号发言：${(d.content as string) || '（无内容）'}`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'wolf_kill':
      return {
        id: ev.id, time, icon: '🔪', text: `狼人击杀了${t}号`,
        wolfThoughts: (d.wolfThoughts as LogEntry['wolfThoughts']) || undefined,
      };
    case 'seer_check':
      if (t === null) {
        return {
          id: ev.id, time, icon: '🔮',
          text: `预言家${a}号睁眼，但${d.note || '未给出有效查验目标'}`,
          thinking: (d.thinking as string) || null,
          internal: (d.internal as string) || null,
        };
      }
      return {
        id: ev.id, time, icon: '🔮',
        text: `预言家查验了${t}号，结果是${d.isWolf ? '狼人' : '好人'}`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'witch_heal':
      return {
        id: ev.id, time, icon: '💊', text: `女巫用解药救了${t}号`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'witch_poison':
      return {
        id: ev.id, time, icon: '☠️', text: `女巫用毒药毒了${t}号`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'witch_skip':
      return {
        id: ev.id, time, icon: '🧪',
        text: `女巫${a}号选择不使用药水`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'wolf_skip':
      return {
        id: ev.id, time, icon: '🐺',
        text: `狼人讨论后未达成击杀决策`,
        wolfThoughts: (d.wolfThoughts as LogEntry['wolfThoughts']) || undefined,
      };
    case 'hunter_shot':
      return {
        id: ev.id, time, icon: '🔫', text: `猎人开枪带走了${t}号`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'vote':
      return {
        id: ev.id, time, icon: '🗳️',
        text: `${a}号投票给${t}号`,
        thinking: (d.thinking as string) || null,
        internal: (d.internal as string) || null,
      };
    case 'eliminate':
      return { id: ev.id, time, icon: '⚖️', text: `${t}号被投票放逐` };
    case 'death':
      return { id: ev.id, time, icon: '💀', text: `${t}号死亡（${d.cause === 'wolf' ? '狼人击杀' : d.cause === 'poison' ? '中毒' : d.cause === 'vote' ? '被放逐' : '未知原因'}）` };
    case 'sheriff_elect':
      return { id: ev.id, time, icon: '👑', text: `${t}号当选警长` };
    case 'sheriff_transfer':
      return { id: ev.id, time, icon: '👑', text: `${a}号将警徽移交给${t}号` };
    case 'game_over':
      return {
        id: ev.id, time, icon: '🏆',
        text: `游戏结束·${(d.winner as string) === 'evil' ? '狼人获胜' : '好人获胜'}·MVP: ${(d.mvp as any)?.seatNumber || '?'}号`,
        thinking: null,
        internal: null,
      };
    default:
      return { id: ev.id, time, icon: '📌', text: ev.type };
  }
}

/** 阶段切换时生成一条叙事 */
export function phaseToEntry(phase: string, round: number): LogEntry | null {
  const text = PHASE_TEXT[phase];
  if (!text) return null;
  return {
    id: `phase-${phase}-${round}-${Date.now()}`,
    time: formatTime(new Date().toISOString()),
    icon: phase.startsWith('night') ? '🌙' : '☀️',
    text: `第${round}天 · ${text}`,
  };
}

/** LLM 错误转成叙事 */
export function errorToEntry(err: string): LogEntry {
  return {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: formatTime(new Date().toISOString()),
    icon: '⚠️',
    text: err,
    kind: 'error',
    isError: true,
  };
}
