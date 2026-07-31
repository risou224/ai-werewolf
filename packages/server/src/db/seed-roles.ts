import { getDb, saveDb } from './connection.js';

export interface RoleDef {
  type: string;
  name: string;
  camp: 'good' | 'evil';
  nightOrder: number;
  skillTags: string[];
  isBuiltin: boolean;
}

export interface BoardPreset {
  id: string;
  name: string;
  totalPlayers: number;
  roles: string[];
  rules: Record<string, any>;
  isBuiltin: boolean;
}

/** 内置角色定义 seed */
const BUILTIN_ROLES: RoleDef[] = [
  { type: 'wolf',     name: '狼人',   camp: 'evil', nightOrder: 1, skillTags: ['wolf_team'], isBuiltin: true },
  { type: 'seer',     name: '预言家', camp: 'good', nightOrder: 2, skillTags: ['seer_check'], isBuiltin: true },
  { type: 'witch',    name: '女巫',   camp: 'good', nightOrder: 3, skillTags: ['witch_action'], isBuiltin: true },
  { type: 'hunter',   name: '猎人',   camp: 'good', nightOrder: 0, skillTags: ['death_trigger'], isBuiltin: true },
  { type: 'idiot',    name: '白痴',   camp: 'good', nightOrder: 0, skillTags: ['vote_passive'], isBuiltin: true },
  { type: 'villager', name: '平民',   camp: 'good', nightOrder: 0, skillTags: [], isBuiltin: true },
];

/** 内置板子预设 seed */
const BUILTIN_BOARDS: BoardPreset[] = [
  // ===== 6人局 =====
  {
    id: 'builtin_6',
    name: '6人屠城局（有警长）',
    totalPlayers: 6,
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  {
    id: 'builtin_6_no_sheriff',
    name: '6人屠城局（无警长）',
    totalPlayers: 6,
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: false },
    isBuiltin: true,
  },
  {
    id: 'builtin_6_slaughter_side',
    name: '6人屠边局',
    totalPlayers: 6,
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'],
    rules: { winCondition: 'slaughter_side', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  // ===== 9人局 =====
  {
    id: 'builtin_9',
    name: '9人标准屠城局',
    totalPlayers: 9,
    roles: ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  {
    id: 'builtin_9_slaughter_side',
    name: '9人屠边局',
    totalPlayers: 9,
    roles: ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    rules: { winCondition: 'slaughter_side', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  {
    id: 'builtin_9_no_sheriff',
    name: '9人无警长局',
    totalPlayers: 9,
    roles: ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: false },
    isBuiltin: true,
  },
  {
    id: 'builtin_9_no_first_poison',
    name: '9人首夜禁毒局',
    totalPlayers: 9,
    roles: ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: false, sheriffEnabled: true },
    isBuiltin: true,
  },
  // ===== 12人局 =====
  {
    id: 'builtin_12',
    name: '12人标准屠城局',
    totalPlayers: 12,
    roles: ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  {
    id: 'builtin_12_slaughter_side',
    name: '12人屠边局',
    totalPlayers: 12,
    roles: ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'],
    rules: { winCondition: 'slaughter_side', firstNightWitchPoison: true, sheriffEnabled: true },
    isBuiltin: true,
  },
  {
    id: 'builtin_12_no_sheriff',
    name: '12人无警长局',
    totalPlayers: 12,
    roles: ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: true, sheriffEnabled: false },
    isBuiltin: true,
  },
  {
    id: 'builtin_12_no_first_poison',
    name: '12人首夜禁毒局',
    totalPlayers: 12,
    roles: ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'idiot'],
    rules: { winCondition: 'slaughter_city', firstNightWitchPoison: false, sheriffEnabled: true },
    isBuiltin: true,
  },
];

export async function seedRolesAndBoards(): Promise<void> {
  const db = await getDb();

  // seed 角色定义（已存在的跳过）
  for (const r of BUILTIN_ROLES) {
    const stmt = db.prepare('SELECT type FROM role_defs WHERE type = ?');
    stmt.bind([r.type]);
    if (stmt.step()) { stmt.free(); continue; }
    stmt.free();
    db.run(
      `INSERT INTO role_defs (type, name, camp, night_order, skill_tags, is_builtin) VALUES (?, ?, ?, ?, ?, ?)`,
      [r.type, r.name, r.camp, r.nightOrder, JSON.stringify(r.skillTags), r.isBuiltin ? 1 : 0]
    );
  }

  // seed 板子预设（delete + reinsert 确保更新）
  for (const b of BUILTIN_BOARDS) {
    const stmt = db.prepare('SELECT id FROM board_presets WHERE id = ?');
    stmt.bind([b.id]);
    if (stmt.step()) {
      stmt.free();
      // 已存在，更新内置板子（自定义板子不受影响）
      if (b.isBuiltin) {
        const now = new Date().toISOString();
        db.run(
          `UPDATE board_presets SET name = ?, total_players = ?, roles = ?, rules = ?, is_builtin = 1, updated_at = ? WHERE id = ?`,
          [b.name, b.totalPlayers, JSON.stringify(b.roles), JSON.stringify(b.rules), now, b.id]
        );
      }
      continue;
    }
    stmt.free();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO board_presets (id, name, total_players, roles, rules, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.id, b.name, b.totalPlayers, JSON.stringify(b.roles), JSON.stringify(b.rules), b.isBuiltin ? 1 : 0, now, now]
    );
  }

  saveDb();
  console.log(`[seed] 已 seed ${BUILTIN_ROLES.length} 个角色, ${BUILTIN_BOARDS.length} 个板子`);
}

/** 从 DB 读取所有角色定义 */
export async function getAllRoleDefs(): Promise<Map<string, RoleDef>> {
  const db = await getDb();
  const result = db.exec('SELECT * FROM role_defs');
  const map = new Map<string, RoleDef>();
  if (result.length === 0) return map;
  const { columns, values } = result[0];
  for (const row of values) {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    try {
      obj.skill_tags = JSON.parse(obj.skill_tags);
    } catch { obj.skill_tags = []; }
    map.set(obj.type, {
      type: obj.type,
      name: obj.name,
      camp: obj.camp,
      nightOrder: obj.night_order,
      skillTags: obj.skill_tags,
      isBuiltin: !!obj.is_builtin,
    });
  }
  return map;
}

/** 从 DB 读取所有板子预设 */
export async function getAllBoardPresets(): Promise<BoardPreset[]> {
  const db = await getDb();
  const result = db.exec('SELECT * FROM board_presets ORDER BY is_builtin DESC, total_players ASC');
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    try { obj.roles = JSON.parse(obj.roles); } catch { obj.roles = []; }
    try { obj.rules = JSON.parse(obj.rules); } catch { obj.rules = {}; }
    return {
      id: obj.id,
      name: obj.name,
      totalPlayers: obj.total_players,
      roles: obj.roles,
      rules: obj.rules,
      isBuiltin: !!obj.is_builtin,
    };
  });
}