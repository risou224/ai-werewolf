// 单实例守卫：保证系统同一时刻只有一个 AI 狼人杀实例在运行。
//
// 设计（前置任务，在 app ready 之前执行）：
//   1. 常规单实例（Electron requestSingleInstanceLock）：
//      新实例拿不到锁 → 已有实例存在 → 探活（读 instance.json 里的实际端口，请求 /api/health）。
//      - 健康 → 老实例收到 second-instance 事件并聚焦窗口，新实例直接退出（「用老进程」）。
//   2. 老实例卡死/失效：
//      instance.json 是服务监听成功后才写入的，所以「文件存在 + pid 存活 + 健康检查失败」
//      直接判定卡死 → taskkill 树杀老进程 → 等待单实例锁释放 → 新实例接管（端口随之释放）。
//   3. 拿不到 instance.json（旧版本实例等）→ 按进程名兜底：只杀「启动时间早于本实例」的
//      同名进程（portable 每次解压到随机临时目录，无法用路径判断；本实例自己的 GPU/渲染
//      子进程都是启动后才拉起的，StartTime 必然不早于主进程，天然不会被误杀）。
//
// 关键点：
//   - instance.json 写在 userData 下（单实例锁同样的键），记录 { pid, 实际端口, 时间戳 }。
//   - 探活走 HTTP /api/health，1.5s 超时。
//   - 杀进程用 taskkill /T /F 杀进程树；不用 process.kill(pid, 0) 探测存活——
//     Windows 上 process.kill 的 signal 会被忽略并直接强杀目标进程。
//   - 不依赖 wmic（新版 Windows 已移除），进程枚举用 tasklist / PowerShell。
import { app } from 'electron';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawnSync } from 'child_process';

const PROBE_ROUNDS = 6; // 等老实例写出 instance.json 的最大轮数（每轮 1s）
const RELOCK_ATTEMPTS = 20; // 杀老进程后重试抢锁次数（每 500ms）
const HEALTH_TIMEOUT_MS = 1000;

interface InstanceInfo {
  pid: number;
  port: number;
  ts: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 带毫秒时间戳的日志（排查单实例流程耗时用） */
function log(msg: string): void {
  const now = new Date();
  const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  console.log(`[single-instance ${ts}] ${msg}`);
}

function instanceFilePath(): string {
  return path.join(app.getPath('userData'), 'instance.json');
}

/** 把「本实例 pid + 实际监听端口」写入 userData/instance.json，供后续实例探活 */
export function writeInstanceInfo(port: number): void {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      instanceFilePath(),
      JSON.stringify({ pid: process.pid, port, ts: Date.now() })
    );
  } catch (err) {
    console.error('[single-instance] 写入实例信息失败:', err);
  }
}

function readInstanceInfo(): InstanceInfo | null {
  try {
    const info = JSON.parse(fs.readFileSync(instanceFilePath(), 'utf-8'));
    if (info && typeof info.pid === 'number' && typeof info.port === 'number') return info;
  } catch {
    /* 文件不存在或损坏 */
  }
  return null;
}

/** Windows 下判断 pid 是否存活（tasklist 查进程；不能 process.kill(pid, 0)——Windows 上会直接强杀） */
function isPidAlive(pid: number): boolean {
  const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
    encoding: 'utf-8',
    windowsHide: true,
  });
  return r.status === 0 && (r.stdout || '').includes(String(pid));
}

/**
 * HTTP 探活：请求老实例的 /api/health，能收到 2xx 响应才算健康。
 * 用原生 socket + 硬性 1s 截止（fetch/undici 在目标进程被挂起时，abort 可能无法
 * 中断 TCP connect，导致探测时间不可控；原生 socket 定时销毁是确定性的）。
 */
function probeHealth(port: number, timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    let data = '';
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('error', () => finish(false));
    socket.once('connect', () => {
      socket.write('GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
    });
    socket.on('data', (chunk) => {
      data += chunk.toString();
      if (/HTTP\/1\.1 2\d\d/.test(data)) finish(true);
    });
    socket.connect(port, '127.0.0.1');
  });
}

/** 杀掉 pid 所在进程树（Electron 主进程被杀，子进程随之退出） */
function killPidTree(pid: number): void {
  try {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    console.log(`[single-instance] 已终止老实例 pid=${pid}`);
  } catch {
    console.warn(`[single-instance] 终止老实例失败 pid=${pid}`);
  }
}

/** 兜底：按进程名找出其他 AI 狼人杀实例（portable 每次解压到随机临时目录，无法用路径判断）。
 *  只杀「启动时间早于本实例」的同名进程：本实例自己的 GPU/渲染/工具子进程都是
 *  本实例启动后才拉起的，StartTime 必然不早于主进程，天然被排除，不会误杀自己人。
 *  （不依赖 wmic——新版 Windows 已移除；用 PowerShell，Win10/11 均自带） */
function listOtherInstancePids(): number[] {
  try {
    const script = [
      `$me = Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue`,
      `if (-not $me) { exit 0 }`,
      `Get-Process -Name 'AI狼人杀' -ErrorAction SilentlyContinue`,
      `  | Where-Object { $_.Id -ne ${process.pid} -and $_.StartTime -lt $me.StartTime }`,
      `  | Select-Object -ExpandProperty Id`,
    ].join('; ');
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf-8',
      windowsHide: true,
    });
    if (r.status !== 0 || !r.stdout) return [];
    const pids: number[] = [];
    for (const line of r.stdout.split(/\r?\n/)) {
      const pid = Number(line.trim());
      if (pid > 0) pids.push(pid);
    }
    return pids;
  } catch {
    return [];
  }
}

/**
 * 单实例守卫。返回 true = 本实例继续启动；false = 本实例应退出（由老实例接管）。
 * @param onSecondInstance 作为主实例时收到「新实例请求」的回调（通常用于聚焦窗口）
 *
 * 顺序很重要：不能一上来就 requestSingleInstanceLock —— 老实例若已挂起，它的命名管道
 * 不响应，锁调用会阻塞 ~20s。所以先读 instance.json 探活：
 *   健康 → 再调锁（健康实例的管道握手瞬时完成，同时触发老实例聚焦窗口）→ 让位；
 *   卡死 → 先 taskkill 掉老进程，再调锁（管道随进程消亡，瞬间拿到锁）→ 接管。
 */
export async function ensureSingleInstance(onSecondInstance: () => void): Promise<boolean> {
  // 0) 读实例信息；老实例刚启动、还没写文件时轮询等待（最多 PROBE_ROUNDS 秒）
  let info = readInstanceInfo();
  for (let i = 0; i < PROBE_ROUNDS && !info; i++) {
    await sleep(1000);
    info = readInstanceInfo();
  }

  if (info && isPidAlive(info.pid)) {
    // 文件存在 + pid 存活 ⇒ 老实例服务曾就绪。健康检查失败 = 卡死，两次确认即可判死。
    log(`探活 pid=${info.pid} port=${info.port}（第 1 次）`);
    let healthy = info.port > 0 && (await probeHealth(info.port));
    if (!healthy && info.port > 0) {
      await sleep(1000);
      log(`探活 pid=${info.pid} port=${info.port}（第 2 次确认）`);
      healthy = await probeHealth(info.port);
    }
    if (healthy) {
      // 健康：调锁触发老实例的 second-instance（聚焦窗口）。健康实例的管道握手是瞬时的。
      const lock = app.requestSingleInstanceLock();
      if (!lock) {
        log('老实例健康，本次启动让位，由老实例接管（窗口已聚焦）');
        return false;
      }
      // 极端：探活时健康、拿锁时老实例恰好退出 → 我们成为主实例
      app.on('second-instance', onSecondInstance);
      log('探活健康但拿锁时老实例已退出，作为主实例启动');
      return true;
    }
    // 卡死 → 先杀老进程，再抢锁（避免锁调用阻塞在老实例的管道上）
    log('老实例无响应，判定为卡死，正在终止老实例…');
    killPidTree(info.pid);
  } else if (!info) {
    // 等了几秒仍无 instance.json：可能是旧版本实例（不写该文件）占着锁
    log('无法读取老实例信息，按进程名兜底处理…');
  } else {
    log('instance.json 中的 pid 已不存在（残留文件），直接接管');
  }

  // 3) 按进程名兜底：杀其他「早于本实例启动」的同名实例
  //    （portable 每次解压到随机临时目录，无法用路径判断；只杀早于自己的，绝不误杀本实例子进程）
  const others = listOtherInstancePids();
  if (others.length > 0) log(`按进程名兜底，终止其他实例: ${others.join(',')}`);
  for (const pid of others) killPidTree(pid);

  // 4) 标准抢锁（此时老实例要么已死要么不存在，管道握手不会阻塞）
  let gotLock = app.requestSingleInstanceLock();
  for (let i = 0; i < RELOCK_ATTEMPTS && !gotLock; i++) {
    await sleep(500);
    gotLock = app.requestSingleInstanceLock();
  }
  if (!gotLock) {
    console.error('[single-instance] 无法获取单实例锁，退出。');
    return false;
  }
  app.on('second-instance', onSecondInstance);
  log('获取单实例锁成功，作为主实例启动');
  return true;
}
