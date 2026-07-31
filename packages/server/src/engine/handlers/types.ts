import type { GameSession, GameEvent, GamePhase, PlayerState } from '@ai-werewolf/shared';
import { Server as SocketServer } from 'socket.io';
import type { RoleDef } from '../db/seed-roles.js';

export interface PhaseHandler {
  phase: GamePhase;
  execute(ctx: HandlerContext): Promise<void>;
}

export interface HandlerContext {
  session: GameSession;
  io: SocketServer;
  events: GameEvent[];
  addEvent(event: GameEvent): Promise<void>;
  broadcastState(): void;
  getAlive(): PlayerState[];
  getConfig(): Promise<Record<string, any>>;
  getRoleDef(roleType: string): RoleDef;
  callPlayerModel(
    player: PlayerState,
    stage: string,
    extraVars?: Record<string, string>,
  ): Promise<{ thinking: string | null; internal: string | null; public_: string | null }>;
  wait(ms: number): Promise<void>;
}