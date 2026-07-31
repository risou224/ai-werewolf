// ===== 模型配置 =====
// API 提供商配置：一个 API（endpoint + apiKey）下可挂多个模型
export interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  maxQpm: number;
  timeout: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  modelId: string;
  /** 所属 API 提供商 id；null = 独立模型（老逻辑） */
  providerId: string | null;
  enabled: boolean;
  maxQpm: number;
  timeout: number;
  createdAt: string;
  updatedAt: string;
}

// ===== 阵营与角色 =====
export type Camp = 'good' | 'evil';
export type RoleType = 'seer' | 'witch' | 'hunter' | 'idiot' | 'wolf' | 'villager';

export interface RoleDef {
  type: RoleType;
  name: string;
  camp: Camp;
  nightOrder: number;
}

// ===== 玩家配置 =====
export interface PlayerConfig {
  seatNumber: number;
  modelConfigId: string;
  modelInstanceLabel: string;
  systemPrompt: string;
}

// ===== 玩家运行时状态 =====
export interface PlayerState {
  seatNumber: number;
  roleType: RoleType;
  camp: Camp;
  isAlive: boolean;
  isSheriff: boolean;
  hasVoteRight: boolean;
  witchHasHeal: boolean;
  witchHasPoison: boolean;
  witchUsedHeal: boolean;
  witchUsedPoison: boolean;
  hunterCanShoot: boolean;
  idiotRevealed: boolean;
}

// ===== 游戏配置 =====
export interface GameConfig {
  id: string;
  name: string;
  totalPlayers: number;
  roles: RoleType[];
  players: PlayerConfig[];
  sheriffEnabled: boolean;
  sheriffVoteWeight: number;
  firstNightWitchPoison: boolean;
  maxSpeechChars: number;
  wolfDecisionMode: 'first' | 'majority' | 'unanimous';
  tieBreak: 'pk' | 'noOne';
  crossGameMemory: number;
  createdAt: string;
  updatedAt: string;
}

// ===== 游戏阶段 =====
export type GamePhase =
  | 'idle' | 'night_wolf' | 'night_seer' | 'night_witch' | 'night_settle'
  | 'dawn' | 'last_words'
  | 'sheriff_election' | 'sheriff_speech' | 'sheriff_vote'
  | 'day_speech' | 'day_vote' | 'day_settle'
  | 'hunter_shot' | 'sheriff_transfer' | 'game_over';

// ===== 游戏会话 =====
export interface GameSession {
  id: string;
  configId: string;
  status: 'pending' | 'running' | 'paused' | 'finished';
  phase: GamePhase;
  round: number;
  players: PlayerState[];
  sheriffSeat: number | null;
  winner: Camp | null;
  currentSpeaker: number | null;
  speechOrder: number[];
  startTime: string;
  endTime: string | null;
  createdAt: string;
}

// ===== 游戏事件 =====
export type EventType =
  | 'wolf_kill' | 'wolf_skip' | 'seer_check' | 'witch_heal' | 'witch_poison' | 'witch_skip'
  | 'hunter_shot' | 'vote' | 'eliminate' | 'death'
  | 'speech' | 'sheriff_elect' | 'sheriff_transfer'
  | string;  // 允许扩展角色事件

export interface GameEvent {
  id: string;
  sessionId: string;
  round: number;
  phase: GamePhase;
  type: EventType;
  actorSeat: number | null;
  targetSeat: number | null;
  data: Record<string, unknown>;
  timestamp: string;
}

// ===== 提示词阶段 =====
export type PromptStage =
  | 'identity_confirm' | 'wolf_kill' | 'seer_check' | 'witch_action'
  | 'dawn_result' | 'sheriff_stand' | 'sheriff_speech' | 'sheriff_vote'
  | 'day_speech' | 'day_vote' | 'last_words' | 'hunter_shot' | 'sheriff_transfer';

export interface PromptTemplate {
  id: string;
  stage: PromptStage;
  roleType: RoleType;
  content: string;
  version: number;
  createdAt: string;
}

// ===== LLM 响应 =====
export interface LLMResponse {
  thinking: string | null;
  internal: string | null;
  public_: string | null;
}

// ===== 对局总结 =====
export interface GameSummary {
  sessionId: string;
  date: string;
  modelList: string[];
  roleAssignment: Record<number, string>;
  winner: string;
  rounds: number;
  timeline: Array<{ round: number; phase: string; description: string }>;
  playerStats: Record<number, {
    seat: number; role: string; survivedRounds: number;
    speechCount: number; voteAccuracy: number | null; isMVP: boolean;
  }>;
}

// ===== 跨局记忆 =====
export interface CrossGameMemory {
  id: string;
  modelConfigId: string;
  instanceLabel: string;
  entries: Array<{
    gameNumber: number; role: string;
    survivedRounds: number; won: boolean; summary: string;
  }>;
}
