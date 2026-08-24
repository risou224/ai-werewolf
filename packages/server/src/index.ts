import { startServer } from './start.js';

// 独立 Node 入口（dev 用 tsx watch、打包版用 esbuild bundle 这个文件）：
// 启动后端并自动打开浏览器。
startServer({ openBrowser: true }).catch(console.error);
