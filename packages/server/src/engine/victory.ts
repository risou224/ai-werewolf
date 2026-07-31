import type { PlayerState, Camp } from '@ai-werewolf/shared';
import { ROLE_DEFS } from './roles.js';

export interface VictoryResult {
  gameOver: boolean;
  winner: Camp | null;
}

/**
 * 检查胜负
 * @param players 当前所有玩家
 * @param winCondition 'slaughter_city'（屠城）狼人数 >= 好人数；'slaughter_side'（屠边）神牌或平民任一方全灭
 */
export function checkVictory(
  players: PlayerState[],
  winCondition: 'slaughter_city' | 'slaughter_side' = 'slaughter_city',
): VictoryResult {
  const aliveWolves = players.filter(p => p.isAlive && p.camp === 'evil');
  const aliveGood = players.filter(p => p.isAlive && p.camp === 'good');

  // 所有狼人死亡 → 好人胜
  if (aliveWolves.length === 0) {
    return { gameOver: true, winner: 'good' };
  }

  if (winCondition === 'slaughter_city') {
    if (aliveWolves.length >= aliveGood.length) {
      return { gameOver: true, winner: 'evil' };
    }
  } else {
    // 屠边：有技能的好人（神牌） 或 无技能的好人（平民）任一方全灭 → 狼人胜
    const aliveGods = aliveGood.filter(p => {
      const def = ROLE_DEFS.get(p.roleType);
      return def && def.skillTags && def.skillTags.length > 0;
    });
    const aliveVillagers = aliveGood.filter(p => {
      const def = ROLE_DEFS.get(p.roleType);
      return def && (!def.skillTags || def.skillTags.length === 0);
    });
    if (aliveGods.length === 0 || aliveVillagers.length === 0) {
      return { gameOver: true, winner: 'evil' };
    }
  }

  return { gameOver: false, winner: null };
}