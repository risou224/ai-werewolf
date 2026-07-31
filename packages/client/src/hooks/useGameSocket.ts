import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameEvent, GamePhase } from '@ai-werewolf/shared';
import type { LogEntry } from '../utils/log-format.js';
import { eventToEntry, phaseToEntry, errorToEntry } from '../utils/log-format.js';

interface GameState {
  phase: GamePhase;
  round: number;
  status: string;
  players: any[];
  sheriffSeat: number | null;
  winner: string | null;
  currentSpeaker: number | null;
  speechOrder: number[];
  errors?: string[];
}

export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  const lastPhaseRef = useRef<string>('');
  const lastErrorCountRef = useRef(0);

  useEffect(() => {
    const s = io('ws://localhost:3001');

    s.on('connect', () => {
      setConnected(true);
      fetch('/api/game/current-state')
        .then(r => r.json())
        .then(data => {
          if (data && data.status && data.status !== 'no_game') {
            setGameState(data);
          }
        })
        .catch(() => {});
      s.emit('join_game', 'current');
    });

    s.on('disconnect', () => setConnected(false));

    s.on('game_state', (state: GameState) => {
      // 阶段切换叙事
      if (state.phase !== lastPhaseRef.current) {
        const entry = phaseToEntry(state.phase, state.round);
        if (entry) setEntries(prev => [...prev.slice(-199), entry]);
        lastPhaseRef.current = state.phase;
      }

      // LLM 错误叙事（只增不重复）
      if (state.errors && state.errors.length > lastErrorCountRef.current) {
        const newErrors = state.errors.slice(lastErrorCountRef.current);
        newErrors.forEach(err => {
          setEntries(prev => [...prev.slice(-199), errorToEntry(err)]);
        });
        lastErrorCountRef.current = state.errors.length;
      }

      setGameState(state);
    });

    s.on('game_event', (ev: GameEvent) => {
      const entry = eventToEntry(ev);
      setEntries(prev => [...prev.slice(-199), entry]);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  return { socket, gameState, entries, connected };
}
