import { getDb, saveDb } from './connection.js';

export async function initSchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS model_configs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, endpoint TEXT NOT NULL,
      api_key TEXT NOT NULL, model_id TEXT NOT NULL,
      provider_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1, max_qpm INTEGER NOT NULL DEFAULT 30,
      timeout INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_providers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, endpoint TEXT NOT NULL,
      api_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
      max_qpm INTEGER NOT NULL DEFAULT 30, timeout INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
      CREATE TABLE IF NOT EXISTS game_configs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, total_players INTEGER NOT NULL DEFAULT 12,
        roles TEXT NOT NULL, players TEXT NOT NULL,
        board_preset_id TEXT,
        sheriff_enabled INTEGER NOT NULL DEFAULT 1, sheriff_vote_weight REAL NOT NULL DEFAULT 1.5,
        first_night_witch_poison INTEGER NOT NULL DEFAULT 1, max_speech_chars INTEGER NOT NULL DEFAULT 300,
        wolf_decision_mode TEXT NOT NULL DEFAULT 'first', tie_break TEXT NOT NULL DEFAULT 'pk',
        cross_game_memory INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS role_defs (
        type TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        camp TEXT NOT NULL,
        night_order INTEGER NOT NULL DEFAULT 0,
        skill_tags TEXT NOT NULL DEFAULT '[]',
        is_builtin INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS board_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_players INTEGER NOT NULL,
        roles TEXT NOT NULL,
        rules TEXT NOT NULL DEFAULT '{}',
        is_builtin INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY, config_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', phase TEXT NOT NULL DEFAULT 'idle',
      round INTEGER NOT NULL DEFAULT 1, players TEXT NOT NULL,
      sheriff_seat INTEGER, winner TEXT, current_speaker INTEGER,
      speech_order TEXT, start_time TEXT, end_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (config_id) REFERENCES game_configs(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_events (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      round INTEGER NOT NULL, phase TEXT NOT NULL, type TEXT NOT NULL,
      actor_seat INTEGER, target_seat INTEGER, data TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES game_sessions(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY, stage TEXT NOT NULL, role_type TEXT NOT NULL,
      content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_summaries (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES game_sessions(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cross_game_memories (
      id TEXT PRIMARY KEY, model_config_id TEXT NOT NULL,
      instance_label TEXT NOT NULL, entries TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (model_config_id) REFERENCES model_configs(id)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON game_events(session_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_templates_stage_role ON prompt_templates(stage, role_type);`);

    // ======== 兼容旧数据库的 ALTER TABLE ========
    // 老 db 里 game_configs 表没有 board_preset_id 列，CREATE IF NOT EXISTS 不会加列
    // 用 PRAGMA table_info 检查后选择性 ALTER TABLE
    const gameConfigsCols = db.exec(`PRAGMA table_info(game_configs)`);
    const existingCols = new Set(
      gameConfigsCols.length > 0 ? gameConfigsCols[0].values.map(r => r[1] as string) : []
    );
    if (!existingCols.has('board_preset_id')) {
      db.run(`ALTER TABLE game_configs ADD COLUMN board_preset_id TEXT`);
      console.log('[schema] 升级: game_configs 添加 board_preset_id 列');
    }

    // 老 db 里 model_configs 表没有 provider_id 列（v2.x 之前的独立模型配置）
    const modelConfigsCols = db.exec(`PRAGMA table_info(model_configs)`);
    const mcCols = new Set(
      modelConfigsCols.length > 0 ? modelConfigsCols[0].values.map(r => r[1] as string) : []
    );
    if (!mcCols.has('provider_id')) {
      db.run(`ALTER TABLE model_configs ADD COLUMN provider_id TEXT`);
      console.log('[schema] 升级: model_configs 添加 provider_id 列');
    }

    // 服务器重启时，将残留的 running/paused 状态重置为 stopped
    // 因为 orchestrator 是内存对象，重启后不存在了
    db.run(`UPDATE game_sessions SET status = 'stopped' WHERE status IN ('running', 'paused')`);

  saveDb();
  console.log('数据库 schema 初始化完成');
}
