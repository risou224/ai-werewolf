import 'dotenv/config';
import { initSchema } from './schema.js';
import { seedDefaultPrompts } from '../prompts/seed.js';
import { seedRolesAndBoards } from './seed-roles.js';

async function main() {
  console.log('正在初始化数据库...');
  await initSchema();
  await seedRolesAndBoards();
  await seedDefaultPrompts();
  console.log('数据库初始化完成！');
}

main().catch(console.error);
