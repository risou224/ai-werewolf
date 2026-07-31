import type { Camp, PlayerState } from '@ai-werewolf/shared';
import { getAllRoleDefs, type RoleDef } from '../db/seed-roles.js';

/** 兼容用常量：硬编码兜底（DB 读不到时使用） */
const FALLBACK_ROLE_DEFS: Record<string, { name: string; camp: Camp; nightOrder: number; skillTags: string[] }> = {
  wolf:     { name: '狼人',   camp: 'evil', nightOrder: 1, skillTags: ['wolf_team'] },
  seer:     { name: '预言家', camp: 'good', nightOrder: 2, skillTags: ['seer_check'] },
  witch:    { name: '女巫',   camp: 'good', nightOrder: 3, skillTags: ['witch_action'] },
  hunter:   { name: '猎人',   camp: 'good', nightOrder: 0, skillTags: ['death_trigger'] },
  idiot:    { name: '白痴',   camp: 'good', nightOrder: 0, skillTags: ['vote_passive'] },
  villager: { name: '平民',   camp: 'good', nightOrder: 0, skillTags: [] },
};

/** 同步访问的 ROLE_DEFS — 从 DB 缓存，初始为 fallback */
let _roleDefsCache: Map<string, RoleDef> | null = null;
function getRoleDefSync(roleType: string): RoleDef {
  if (_roleDefsCache && _roleDefsCache.has(roleType)) {
    return _roleDefsCache.get(roleType)!;
  }
  const fb = FALLBACK_ROLE_DEFS[roleType];
  return {
    type: roleType,
    name: fb?.name || roleType,
    camp: fb?.camp || 'good',
    nightOrder: fb?.nightOrder || 0,
    skillTags: fb?.skillTags || [],
    isBuiltin: true,
  };
}

/** 异步从 DB 加载并刷新缓存 */
export async function loadRoleDefs(): Promise<Map<string, RoleDef>> {
  const dbMap = await getAllRoleDefs();
  _roleDefsCache = dbMap;
  return dbMap;
}

/** 角色定义集合 — 用于 phase-machine 等需要完整列表的地方 */
export const ROLE_DEFS = {
  get: getRoleDefSync,
  getAll: (): RoleDef[] => {
    if (_roleDefsCache && _roleDefsCache.size > 0) return [..._roleDefsCache.values()];
    return Object.entries(FALLBACK_ROLE_DEFS).map(([type, v]) => ({ type, ...v, isBuiltin: true }));
  },
};

export function getWolves(players: PlayerState[]): PlayerState[] {
  return players.filter(p => p.isAlive && p.roleType === 'wolf');
}

export function getAlive(players: PlayerState[]): PlayerState[] {
  return players.filter(p => p.isAlive);
}

export function createPlayerState(seat: number, roleType: string): PlayerState {
  const def = getRoleDefSync(roleType);
  return {
    seatNumber: seat,
    roleType,
    camp: def.camp,
    isAlive: true,
    isSheriff: false,
    hasVoteRight: true,
    witchHasHeal: true,
    witchHasPoison: true,
    witchUsedHeal: false,
    witchUsedPoison: false,
    hunterCanShoot: true,
    idiotRevealed: false,
  };
}