import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: SqlJsDatabase | null = null;

// 运行时解析：打包/Electron 下由主进程在启动前注入环境变量，
// 必须在调用时读取（模块加载时 env 尚未注入）。
function resolveDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data', 'werewolf.db');
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (!db) {
    const wasmPath = process.env.SQL_WASM_PATH;
    const SQL = wasmPath
      ? await initSqlJs({ locateFile: () => wasmPath })
      : await initSqlJs();

    // 尝试从文件加载已有数据库
    const p = resolveDbPath();
    if (fs.existsSync(p)) {
      db = new SQL.Database(fs.readFileSync(p));
    } else {
      db = new SQL.Database();
    }
    db.run('PRAGMA foreign_keys = ON;');
  }
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const p = resolveDbPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(p, buffer);
}

export function getDbPath(): string {
  return resolveDbPath();
}
