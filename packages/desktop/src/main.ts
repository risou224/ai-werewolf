import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { startServer } from '../../server/src/start.js';
import { saveDb } from '../../server/src/db/connection.js';

let mainWin: BrowserWindow | null = null;

/** 定位资源：打包后取 resourcesPath（extraResources），开发态取项目内路径 */
function resolveResource(rel: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, rel);
  if (rel === 'web') return path.join(app.getAppPath(), '..', 'client', 'dist');
  if (rel === 'sql-wasm.wasm') {
    return path.join(app.getAppPath(), '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  return path.join(app.getAppPath(), rel);
}

function createMainWindow(serverUrl: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    title: 'AI 狼人杀',
    backgroundColor: '#0a0a16',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(serverUrl + '/');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) {
      win.loadURL(url);
    } else if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.on('closed', () => {
    if (mainWin === win) mainWin = null;
  });
  return win;
}

function createLauncherWindow(serverUrl: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'AI 狼人杀 · 启动器',
    backgroundColor: '#0a0a16',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(serverUrl + '/launcher');
  win.webContents.setWindowOpenHandler(({ url }) => {
    // “重新打开浏览器”→ 聚焦/重建主窗口；外部链接（GitHub）→ 系统浏览器
    if (url.startsWith(serverUrl)) {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.show();
        mainWin.focus();
      } else {
        mainWin = createMainWindow(serverUrl);
      }
    } else if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  return win;
}

async function bootstrap(): Promise<void> {
  const webDir = resolveResource('web');
  const wasmPath = resolveResource('sql-wasm.wasm');

  // 后端与 Electron 同进程：DB 存用户数据目录，wasm 指定绝对路径
  process.env.SQL_WASM_PATH = wasmPath;
  process.env.DB_PATH = path.join(app.getPath('userData'), 'werewolf.db');

  const server = await startServer({ webDir });

  mainWin = createMainWindow(server.url);
  createLauncherWindow(server.url);
}

app.whenReady().then(() => {
  bootstrap().catch((err) => {
    console.error('启动失败:', err);
    app.quit();
  });
});

// 关闭所有窗口 = 退出整个进程（后端同进程，随之彻底关闭）
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  try {
    saveDb();
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
});

app.on('activate', () => {
  // macOS 点击 Dock 且无窗口时
  if (BrowserWindow.getAllWindows().length === 0 && process.platform === 'darwin') {
    // 后端已退出场景无需处理；常规启动走 bootstrap
  }
});
