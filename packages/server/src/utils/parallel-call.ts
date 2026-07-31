/**
 * Utility for running parallel LLM calls with timeout and fallback.
 */

export interface ParallelTask<T> {
  label: string;
  fn: () => Promise<T>;
}

export interface ParallelOptions<T> {
  timeoutMs?: number;
  fallback?: () => T;
}

/**
 * Run multiple async tasks in parallel with a per-task timeout.
 * Returns results in the same order as the input tasks.
 * If a task times out or throws, the fallback value is used.
 */
export async function parallelCall<T>(
  tasks: ParallelTask<T>[],
  options: ParallelOptions<T> = {},
): Promise<T[]> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const fallback = options.fallback ?? (() => null as unknown as T);

  const results = await Promise.allSettled(
    tasks.map(({ label, fn }) => callWithTimeout(fn, fallback, timeoutMs, label)),
  );

  return results.map(r => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    // Shouldn't happen since callWithTimeout catches errors, but be safe
    return fallback();
  });
}

/**
 * Wraps an async function with a timeout and fallback value.
 * If the function takes longer than timeoutMs, or throws, the fallback value is returned.
 */
export async function callWithTimeout<T>(
  fn: () => Promise<T>,
  fallback: () => T,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (label) {
          console.warn(`[parallel-call] TIMEOUT: "${label}" exceeded ${timeoutMs}ms`);
        }
        resolve(fallback());
      }
    }, timeoutMs);

    fn()
      .then(result => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch(err => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (label) {
            console.warn(`[parallel-call] ERROR: "${label}" — ${(err as Error).message ?? err}`);
          }
          resolve(fallback());
        }
      });
  });
}

/**
 * Majority vote: returns the most common item, or null if tied / empty.
 */
export function majorityVote<T>(items: (T | null)[]): T | null {
  const valid = items.filter((v): v is T => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  const count = new Map<T, number>();
  for (const item of valid) {
    count.set(item, (count.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let maxItem: T | null = null;
  for (const [item, c] of count) {
    if (c > maxCount) {
      maxCount = c;
      maxItem = item;
    }
  }

  // 检查平票
  const tied = [...count.values()].filter(c => c === maxCount);
  return tied.length > 1 ? null : maxItem;
}

/**
 * Extract a target seat number from a callPlayerModel result.
 * Checks internal first, then public_ as fallback.
 */
export function extractTargetNumber(
  result: { thinking: string | null; internal: string | null; public_: string | null } | null,
): number | null {
  if (!result) return null;
  const raw = result.internal ?? result.public_;
  if (!raw) return null;
  // 从自然语言中提取数字，兼容 "刀 5号"、"查验 3号"、"5" 等格式
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
