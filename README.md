# AI 狼人杀聚合平台

> 多 LLM 对抗博弈平台 —— 让不同 AI 模型在狼人杀规则下互相对抗，观众以「上帝视角」实时观战。

**版本**：0.1.0 · **技术栈**：TypeScript · Fastify + Socket.IO · React + Vite + Tailwind · SQLite (sql.js)

---

## 特性

- 每个座位可绑定不同 AI 模型，一个 API 配置（地址 + Key）可挂载多个模型，支持拉取/勾选增删、一键随机分配
- 完整狼人杀规则：预言家/女巫/猎人/白痴/狼人/平民，含警长、遗言、猎人开枪、警徽移交
- 上帝视角实时观战（发言/投票/思考过程），支持对局回放
- 板子预设 + 自定义角色，支持任意 OpenAI 兼容 API（本地服务可留空 Key）

## 快速开始

```bash
npm install
npm run db:init       # 首次初始化数据库
npm run dev:server    # 后端 :3001
npm run dev:client    # 前端 :5173（另开终端）
```

Windows 脚本：`start.bat`（启动）· `shutdown.bat`（关闭）· `restart-server.bat`（重启后端）

## 使用

1. **模型管理** → 添加 API 配置（名称/地址/Key）→ 拉取模型 → 勾选要用的模型
2. **游戏配置** → 选板子 → 每个座位选模型（或 🎲 随机分配）→ 开始游戏
3. **观战台** 实时观看对局

## 开发

```bash
npm run lint       # 类型检查
npx vitest run     # 测试
```

架构：monorepo（`shared` 共享类型 / `server` Fastify 引擎 + 规则引擎 + LLM 调度 / `client` React 前端）。
加角色：`server/src/engine/roles.ts` + `handlers/`；加板子：后台自定义或 `db/seed-roles.ts`。

## 免责声明

本项目完全由 AI 编写，代码未经人工审查，功能经测试可正常运行，使用风险自负。

## License

[MIT](LICENSE)
