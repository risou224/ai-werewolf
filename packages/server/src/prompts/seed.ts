import { getDb, saveDb } from '../db/connection.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedDefaultPrompts(): Promise<void> {
  const db = await getDb();

  // 动态扫描 defaults/ 目录下的所有 .md 文件作为 stage
  const defaultsDir = path.join(__dirname, 'defaults');
  if (!existsSync(defaultsDir)) {
    console.warn('[seed] defaults 目录不存在，跳过');
    return;
  }
  const stages = readdirSync(defaultsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));

  // 动态从 role_defs 表读取角色列表
  const roleResult = db.exec('SELECT type FROM role_defs');
  const roleTypes: string[] = roleResult.length > 0
    ? roleResult[0].values.map(row => row[0] as string)
    : ['wolf', 'seer', 'witch', 'hunter', 'idiot', 'villager'];

  let count = 0;
  let skip = 0;

  for (const stage of stages) {
    const filePath = path.join(defaultsDir, `${stage}.md`);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf-8');

    for (const roleType of roleTypes) {
      // 删除旧版本再插入，确保模板更新后生效
      db.run(`DELETE FROM prompt_templates WHERE stage = ? AND role_type = ?`, [stage, roleType]);
      const id = `${stage}_${roleType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run(
        `INSERT INTO prompt_templates (id, stage, role_type, content, version, created_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`,
        [id, stage, roleType, content]
      );
      count++;
    }
  }

  saveDb();
  console.log(`[seed] 已刷新 ${count} 条提示词模板（${stages.length} stages × ${roleTypes.length} roles, 跳过 ${skip} 个）`);
}