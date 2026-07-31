import type { GameSession, PlayerState, GameEvent, GamePhase, Camp } from '@ai-werewolf/shared';
import { PhaseStateMachine, buildNightSequence } from '../engine/phase-machine.js';
import { checkVictory } from '../engine/victory.js';
import { Server as SocketServer } from 'socket.io';
import { getDb, saveDb } from '../db/connection.js';
import { buildHandlerRegistry } from '../engine/handlers/index.js';
import type { PhaseHandler, HandlerContext } from '../engine/handlers/types.js';
import { LLMClient } from '../api/llm-client.js';
import { PromptEngine } from '../api/prompt-engine.js';
import { ContextAssembler } from '../api/context-assembler.js';
import { getAlive, ROLE_DEFS } from '../engine/roles.js';
import type { RoleDef } from '../db/seed-roles.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const promptEngine = new PromptEngine();
const contextAssembler = new ContextAssembler();

interface PlayerModelInfo {
  seatNumber: number;
  systemPrompt: string;
  modelInstanceLabel: string;
  client: LLMClient;
}

export class GameOrchestrator {
  private session: GameSession;
  private phaseMachine: PhaseStateMachine;
  private handlerRegistry: Map<GamePhase, PhaseHandler>;
  private io: SocketServer;
  private events: GameEvent[] = [];
  private _isRunning = false;
  private modelClients: Map<number, PlayerModelInfo> = new Map();
  private cachedConfig: Record<string, any> | null = null;
  private sheriffEnabled = true;
  private recentErrors: string[] = [];
  private winCondition: 'slaughter_city' | 'slaughter_side' = 'slaughter_city';

  constructor(session: GameSession, io: SocketServer, nightSequence?: string[]) {
    this.session = session;
    // 根据该局所有角色（去重）按 nightOrder 排序，生成夜晚阶段序列
    const seq = nightSequence || this.defaultNightSequence(session.players);
    const phases = buildNightSequence(seq);
    this.phaseMachine = new PhaseStateMachine(session.phase as GamePhase, session.round, phases);
    this.handlerRegistry = buildHandlerRegistry(seq);
    this.io = io;
  }

  /** 默认序列：从 session.players 提取角色类型，按 nightOrder 排序去重 */
  private defaultNightSequence(players: PlayerState[]): string[] {
    const unique = [...new Set(players.map(p => p.roleType))];
    return unique
      .map(t => ({ t, order: ROLE_DEFS.get(t).nightOrder }))
      .filter(x => x.order > 0)
      .sort((a, b) => a.order - b.order)
      .map(x => x.t);
  }

  get isRunning(): boolean { return this._isRunning; }
  get phase(): GamePhase { return this.phaseMachine.getCurrentPhase(); }
  get sessionData(): GameSession { return this.session; }

  async start(): Promise<void> {
    await this.loadModelClients();

    this._isRunning = true;
    this.session.status = 'running';
    this.broadcastState();

    while (this._isRunning) {
          // 清除上一轮的错误
          this.recentErrors = [];

          const victory = checkVictory(this.session.players, this.winCondition);
          if (victory.gameOver) {
        this.session.status = 'finished';
        this.session.winner = victory.winner;
        this.phaseMachine.setPhase('game_over');

        // ======== MVP 投票（每个玩家用 LLM 投票） ========
        const alivePlayers = this.session.players.map(p => `${p.seatNumber}号(${p.roleType})`).join('、');
        const votePrompt = `游戏结束了！${this.session.winner === 'evil' ? '狼人阵营' : '好人阵营'}获胜。
存活玩家: ${alivePlayers}
请投票选出本局 MVP（最有价值玩家），只回复一个数字表示座位号，可以加简短理由。例如: "3号，因为他..."`;

        const voteMap = new Map<number, number>(); // seatNumber → vote count
        const voteReasons: Array<{ voter: number; target: number; reason: string }> = [];

        // 并行调用所有有 LLM 的玩家投票
        const voteResults = await Promise.allSettled(
          this.session.players.map(async (player) => {
            const info = this.modelClients.get(player.seatNumber);
            if (!info) return null; // 无 LLM 的玩家不投票

            try {
              const messages = [
                { role: 'system' as const, content: info.systemPrompt },
                { role: 'user' as const, content: votePrompt },
              ];
              const response = await info.client.chat(messages);
              const text = response.public_ || response.thinking || '';
              const seatMatch = text.match(/(\d+)\s*号/);
              const seat = seatMatch ? parseInt(seatMatch[1], 10) : null;
              const validSeat = seat && this.session.players.some(p => p.seatNumber === seat) ? seat : null;
              return { voter: player.seatNumber, target: validSeat, reason: text.slice(0, 100) };
            } catch {
              return null;
            }
          })
        );

        for (const r of voteResults) {
          if (r.status === 'fulfilled' && r.value && r.value.target !== null) {
            const v = r.value;
            voteMap.set(v.target, (voteMap.get(v.target) || 0) + 1);
            if (v.reason) voteReasons.push(v);
          }
        }

        // 取票数最高者为 MVP（平票取第一个）
        let mvpSeat = this.session.players[0]?.seatNumber || 1;
        let mvpVotes = 0;
        for (const [seat, count] of voteMap) {
          if (count > mvpVotes) { mvpSeat = seat; mvpVotes = count; }
        }
        const mvpPlayer = this.session.players.find(p => p.seatNumber === mvpSeat);

        // ======== 生成 game_over 事件 ========
        await this.addEvent({
          id: randomUUID(),
          sessionId: this.session.id,
          round: this.session.round,
          phase: 'game_over',
          type: 'game_over',
          actorSeat: mvpSeat,
          targetSeat: null,
          data: {
            winner: this.session.winner,
            mvp: { seatNumber: mvpSeat, roleType: mvpPlayer?.roleType || '', votes: mvpVotes },
            votes: [...voteMap.entries()].map(([s, c]) => ({ seatNumber: s, votes: c })),
            voteReasons,
            finalRoles: this.session.players.map(p => ({ seatNumber: p.seatNumber, roleType: p.roleType, camp: p.camp, isAlive: p.isAlive })),
          },
          timestamp: new Date().toISOString(),
        });

        this.broadcastState();
        saveDb();

        // 生成回放文件
        try {
          const replayDir = path.join(process.cwd(), 'data', 'replays');
          if (!fs.existsSync(replayDir)) fs.mkdirSync(replayDir, { recursive: true });
          const replay = {
            sessionId: this.session.id,
            startTime: this.session.startTime,
            endTime: new Date().toISOString(),
            totalRounds: this.phaseMachine.getRound(),
            winner: this.session.winner,
            players: this.session.players.map(p => ({ seat: p.seatNumber, role: p.roleType, camp: p.camp })),
            timeline: this.events.map((ev, i) => ({
              index: i,
              timestamp: ev.timestamp,
              round: ev.round,
              phase: ev.phase,
              type: ev.type,
              actorSeat: ev.actorSeat,
              targetSeat: ev.targetSeat,
              data: ev.data,
            })),
          };
          fs.writeFileSync(path.join(replayDir, `replay_${this.session.id}.json`), JSON.stringify(replay, null, 2));
          console.log(`[Orchestrator] 回放文件已保存: replay_${this.session.id}.json`);
        } catch (err) {
          console.error('[Orchestrator] 回放文件生成失败:', err);
        }

        return;
      }

      const nextPhase = this.phaseMachine.next(this.session.players, this.sheriffEnabled, this.events);
            this.session.phase = nextPhase;
            this.session.round = this.phaseMachine.getRound();  // 同步轮次
            this.broadcastState();

            // 通过 handler 注册表派发
            const handler = this.handlerRegistry.get(nextPhase);
      if (handler) {
        try {
          await handler.execute(this.createContext());
        } catch (err) {
          console.error(`[Orchestrator] Handler ${nextPhase} 执行出错:`, err);
          // 出错时短暂等待后继续，避免卡死
          await new Promise(r => setTimeout(r, 2000));
        }
      } else if (nextPhase === 'game_over') {
        // game_over 由 victory 分支处理
        break;
      } else {
        console.warn(`[Orchestrator] 未找到 ${nextPhase} 的 handler`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  pause(): void {
    this._isRunning = false;
    this.session.status = 'paused';
    this.broadcastState();
  }

  resume(): void {
    this._isRunning = true;
    this.session.status = 'running';
    this.broadcastState();
    this.start().catch(console.error);
  }

  async addEvent(event: GameEvent): Promise<void> {
    this.events.push(event);
    this.io.emit('game_event', event);
    // 持久化到数据库
    try {
      const db = await getDb();
      db.run('INSERT INTO game_events (id, session_id, round, phase, type, actor_seat, target_seat, data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [event.id, event.sessionId, event.round, event.phase, event.type, event.actorSeat, event.targetSeat, JSON.stringify(event.data), event.timestamp]);
      saveDb();
    } catch (err) {
      console.error('[Orchestrator] 事件持久化失败:', err);
    }
  }

  // ======== handler 上下文 ========

  private createContext(): HandlerContext {
      const self = this;
      return {
        get session() { return self.session; },
        get io() { return self.io; },
        get events() { return self.events; },
        addEvent: (ev: GameEvent) => self.addEvent(ev),
        broadcastState: () => self.broadcastState(),
        getAlive: () => getAlive(self.session.players),
        getConfig: async () => self.getConfig(),
        getRoleDef: (roleType: string): RoleDef => ROLE_DEFS.get(roleType),
        callPlayerModel: async (player, stage, extraVars) => self.callPlayerModel(player, stage, extraVars || {}),
      wait: (ms: number) => new Promise(r => setTimeout(r, ms)),
    };
  }

  // ======== AI 调用 ========

  private async callPlayerModel(
    player: PlayerState,
    stage: string,
    extraVars: Record<string, string>,
  ): Promise<{ thinking: string | null; internal: string | null; public_: string | null }> {
    const info = this.modelClients.get(player.seatNumber);
    if (!info) {
      // 无模型配置时，返回默认值
      return { thinking: null, internal: null, public_: null };
    }

    try {
      const layer2 = await promptEngine.getLayer2(stage as any, player.roleType);
      // 生成 recentEvents 摘要供模板使用
      const recentEvents = this.events.slice(-5).map(ev => {
        switch (ev.type) {
          case 'wolf_kill': return `${ev.targetSeat}号被狼人袭击`;
          case 'seer_check': return `预言家查验了${ev.targetSeat}号`;
          case 'witch_heal': return `女巫使用了救药`;
          case 'witch_poison': return `女巫使用了毒药`;
          case 'death': return `${ev.targetSeat}号死亡`;
          case 'vote': return `${ev.actorSeat}号投票给${ev.targetSeat}号`;
          case 'eliminate': return `${ev.targetSeat}号被放逐`;
          case 'speech': return `${ev.actorSeat}号发言`;
          default: return ev.type;
        }
      }).join('；') || '暂无';

      const filled2 = promptEngine.fillTemplate(layer2, {
        seatNumber: String(player.seatNumber),
        aliveList: getAlive(this.session.players).map(p => `${p.seatNumber}号`).join('、'),
        recentEvents,
        ...extraVars,
      });

      const layer3 = contextAssembler.assemble(player, this.session, this.events);
      const messages = promptEngine.buildMessages(info.systemPrompt, filled2, layer3);

      const response = await info.client.chat(messages);
      return response;
    } catch (err: any) {
      console.error(`[AI] 玩家 ${player.seatNumber} 调用失败:`, err.message);
      this.recentErrors.push(`玩家${player.seatNumber}: ${err.message}`);
      if (this.recentErrors.length > 10) this.recentErrors.shift();
      return { thinking: null, internal: null, public_: null };
    }
  }

  // ======== 配置文件加载 ========

  private async getConfig(): Promise<Record<string, any>> {
      if (this.cachedConfig) return this.cachedConfig;

      const db = await getDb();
      const stmt = db.prepare(`SELECT * FROM game_configs WHERE id = ?`);
      stmt.bind([this.session.configId]);
      if (!stmt.step()) {
        stmt.free();
        this.cachedConfig = {};
        return this.cachedConfig;
      }
      const row = stmt.getAsObject();
      stmt.free();

      const config: Record<string, any> = {};
      for (const [col, val] of Object.entries(row)) {
        if ((col === 'roles' || col === 'players') && typeof val === 'string') {
          try { config[col] = JSON.parse(val); } catch { config[col] = val; }
        } else {
          config[col] = val;
        }
      }
      this.cachedConfig = config;
      this.sheriffEnabled = config.sheriff_enabled === 1 || config.sheriff_enabled === true;

      // 优先从 board_presets.rules 读取规则参数
      if (config.board_preset_id) {
        try {
          const bpStmt = db.prepare('SELECT rules FROM board_presets WHERE id = ?');
          bpStmt.bind([config.board_preset_id]);
          if (bpStmt.step()) {
            const rulesStr = bpStmt.getAsObject().rules;
            try {
              const rules = JSON.parse(rulesStr);
              if (rules.winCondition === 'slaughter_side') {
                this.winCondition = 'slaughter_side';
              }
              // 板子预设的 sheriffEnabled 覆盖配置（无警长板子强制禁用警长）
              if (rules.sheriffEnabled === false) {
                this.sheriffEnabled = false;
              }
            } catch {}
          }
          bpStmt.free();
        } catch {}
      }
      return config;
    }

  private async loadModelClients(): Promise<void> {
    const config = await this.getConfig();
    const seatConfigs: Array<{ seatNumber: number; modelConfigId: string; modelInstanceLabel: string; systemPrompt: string }>
      = config.players || [];

    const db = await getDb();

    for (const sc of seatConfigs) {
      const stmt = db.prepare(`SELECT * FROM model_configs WHERE id = ?`);
      stmt.bind([sc.modelConfigId]);
      if (!stmt.step()) { stmt.free(); continue; }
      const mc = stmt.getAsObject();
      stmt.free();

      const client = new LLMClient({
        endpoint: mc.endpoint,
        apiKey: mc.api_key,
        modelId: mc.model_id,
        timeout: mc.timeout || 30,
        maxRetries: 1,
      });

      this.modelClients.set(sc.seatNumber, {
        seatNumber: sc.seatNumber,
        systemPrompt: sc.systemPrompt || '你是一名狼人杀玩家，请根据游戏规则进行推理和发言。',
        modelInstanceLabel: sc.modelInstanceLabel,
        client,
      });
    }
  }

  // ======== 广播 ========

  private broadcastState(): void {
    // 如果是 game_over，提取 MVP 数据
    let mvpData: any = undefined;
    let finalRoles: any = undefined;
    if (this.session.phase === 'game_over') {
      const goEvent = this.events.filter(e => e.type === 'game_over').pop();
      if (goEvent?.data) {
        mvpData = goEvent.data.mvp;
        finalRoles = goEvent.data.finalRoles;
      }
    }

    this.io.emit('game_state', {
      phase: this.session.phase,
      round: this.session.round,
      status: this.session.status,
      players: this.session.players,
      sheriffSeat: this.session.sheriffSeat,
      winner: this.session.winner,
      currentSpeaker: this.session.currentSpeaker,
      speechOrder: this.session.speechOrder,
      errors: this.recentErrors.length > 0 ? [...this.recentErrors] : undefined,
      mvp: mvpData,
      finalRoles,
    });
  }
}
