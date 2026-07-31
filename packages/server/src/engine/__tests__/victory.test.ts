import { describe, it, expect } from 'vitest';
import { checkVictory } from '../victory.js';
import { createPlayerState } from '../roles.js';

describe('checkVictory', () => {
  it('游戏未结束：多方仍有存活', () => {
    const players = [
      createPlayerState(1, 'seer'),
      createPlayerState(2, 'wolf'),
      createPlayerState(3, 'villager'),
    ];
    const result = checkVictory(players);
    expect(result.gameOver).toBe(false);
    expect(result.winner).toBeNull();
  });

  it('好人胜利：所有狼人死亡', () => {
    const players = [
      { ...createPlayerState(1, 'seer'), isAlive: true },
      { ...createPlayerState(2, 'wolf'), isAlive: false },
      { ...createPlayerState(3, 'wolf'), isAlive: false },
      { ...createPlayerState(4, 'villager'), isAlive: true },
    ];
    const result = checkVictory(players);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe('good');
  });

  it('狼人胜利：狼人数 ≥ 好人数', () => {
    const players = [
      { ...createPlayerState(1, 'wolf'), isAlive: true },
      { ...createPlayerState(2, 'wolf'), isAlive: true },
      { ...createPlayerState(3, 'villager'), isAlive: true },
      { ...createPlayerState(4, 'seer'), isAlive: false },
    ];
    const result = checkVictory(players);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe('evil');
  });

  it('狼人胜利：2狼 vs 2好人', () => {
      const players = [
        { ...createPlayerState(1, 'wolf'), isAlive: true },
        { ...createPlayerState(2, 'wolf'), isAlive: true },
        { ...createPlayerState(3, 'villager'), isAlive: true },
        { ...createPlayerState(4, 'seer'), isAlive: true },
      ];
      const result = checkVictory(players);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('evil');
    });

    it('【屠边】神牌全灭 → 狼人胜（即使平民仍在）', () => {
      const players = [
        { ...createPlayerState(1, 'wolf'), isAlive: true },
        { ...createPlayerState(2, 'wolf'), isAlive: true },
        { ...createPlayerState(3, 'villager'), isAlive: true },
        { ...createPlayerState(4, 'seer'), isAlive: false },
        { ...createPlayerState(5, 'witch'), isAlive: false },
      ];
      const result = checkVictory(players, 'slaughter_side');
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('evil');
    });

    it('【屠边】平民全灭 → 狼人胜（即使神牌仍在）', () => {
      const players = [
        { ...createPlayerState(1, 'wolf'), isAlive: true },
        { ...createPlayerState(2, 'villager'), isAlive: false },
        { ...createPlayerState(3, 'villager'), isAlive: false },
        { ...createPlayerState(4, 'seer'), isAlive: true },
      ];
      const result = checkVictory(players, 'slaughter_side');
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('evil');
    });

    it('【屠边】仅狼人少 → 不结束（神+平民都还在）', () => {
      const players = [
        { ...createPlayerState(1, 'wolf'), isAlive: true },
        { ...createPlayerState(2, 'villager'), isAlive: true },
        { ...createPlayerState(3, 'seer'), isAlive: true },
      ];
      const result = checkVictory(players, 'slaughter_side');
      expect(result.gameOver).toBe(false);
    });
});
