import React, { useState, useMemo } from 'react';
import type { LogEntry } from '../../utils/log-format.js';

interface EventLogProps {
  entries: LogEntry[];
  godMode?: boolean;
}

function buildExportText(entries: LogEntry[], godMode?: boolean): string {
  const lines = ['===== AI狼人杀对局日志 =====', `导出时间: ${new Date().toLocaleString('zh-CN')}`, ''];
  for (const e of entries) {
    lines.push(`${e.time} ${e.icon} ${e.text}`);
    if (godMode && e.thinking) lines.push(`  └─ 🧠 思考: ${e.thinking}`);
    if (godMode && e.internal) lines.push(`  └─ 📋 内部: ${e.internal}`);
    if (godMode && e.wolfThoughts) {
      for (const wt of e.wolfThoughts) {
        lines.push(`  └─ 🐺 ${wt.seat}号狼人:`);
        if (wt.thinking) lines.push(`     🧠 ${wt.thinking}`);
        if (wt.internal) lines.push(`     📋 ${wt.internal}`);
      }
    }
  }
  return lines.join('\n');
}

/** 截断长文本到 max 个字符，超出加 … */
function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export const EventLog: React.FC<EventLogProps> = ({ entries, godMode }) => {
  // godMode 下也默认折叠，仅展开被点击的条目 —— 避免大量 DOM 导致卡顿
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleExport = () => {
    const text = buildExportText(entries, godMode);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `狼人杀日志_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 反转一次，避免每次 render 都创建新数组引用
  const reversedEntries = useMemo(() => [...entries].reverse(), [entries]);

  return (
    <div className="glass-card rounded-card flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <h2 className="text-sm font-bold gold-text tracking-wider">对局日志</h2>
        <div className="flex items-center gap-3">
          {godMode && (
            <span className="text-[10px] text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-badge ring-1 ring-purple-400/30">
              👁️ 上帝视角
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="text-xs text-gray-500 hover:text-gold-400 disabled:opacity-30 transition-colors"
          >
            📥 导出
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 min-h-0">
        {entries.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-8">暂无日志</div>
        )}
        {reversedEntries.map(e => {
          const hasDetail = e.thinking || e.internal || e.wolfThoughts;
          const showDetail = expandedId === e.id;
          const isSpeech = e.kind === 'speech';

          /* 发言类条目 — 聊天气泡样式 */
          if (isSpeech) {
            const [speaker, ...contentParts] = e.text.split('：');
            const content = contentParts.join('：') || '（无内容）';
            return (
              <div key={e.id} className="bg-white/[0.05] rounded-card px-3 py-2.5 border border-white/10
                hover:border-gold-400/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-gray-600 text-[10px] shrink-0">{e.time}</span>
                  <span className="shrink-0 text-sm">{e.icon}</span>
                  <span className="text-gold-400 text-xs font-semibold shrink-0">
                    {speaker}
                  </span>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed break-words pl-5 border-l-2 border-gold-500/25 ml-1">
                  {content}
                </p>

                {/* godMode 紧凑预览 — 默认可见 */}
                {godMode && hasDetail && !showDetail && (
                  <div className="mt-1.5 ml-5 space-y-0.5">
                    {e.thinking && (
                      <div className="text-[10px] text-gray-500 leading-tight truncate border-l border-gray-700 pl-2">
                        🧠 {truncate(e.thinking)}
                      </div>
                    )}
                    {e.internal && (
                      <div className="text-[10px] text-gray-500 leading-tight truncate border-l border-gray-700 pl-2">
                        📋 {truncate(e.internal)}
                      </div>
                    )}
                  </div>
                )}

                {hasDetail && (
                  <button
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    className="mt-1 ml-5 text-[10px] text-gray-600 hover:text-gray-400"
                  >
                    {showDetail ? '▲ 收起' : '🧠 展开思考'}
                  </button>
                )}
                {showDetail && hasDetail && (
                  <div className="mt-1.5 ml-5 space-y-1">
                    {e.thinking && (
                      <div className="text-gray-500 border-l border-gray-700 pl-2 text-[11px]">
                        🧠 思考: {e.thinking}
                      </div>
                    )}
                    {e.internal && (
                      <div className="text-gray-500 border-l border-gray-700 pl-2 text-[11px]">
                        📋 内部: {e.internal}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          /* 系统事件 / 错误 — 紧凑行样式 */
          return (
            <div key={e.id} className={`text-xs py-1.5 border-b border-white/5 last:border-0 ${e.isError ? 'text-red-400' : ''}`}>
              <div className="flex items-start gap-1.5">
                <span className="text-gray-600 shrink-0 w-14">{e.time}</span>
                <span className="shrink-0">{e.icon}</span>
                <span className={`flex-1 break-words ${e.isError ? 'text-red-400' : 'text-gray-300'}`}>
                  {e.text}
                </span>
                {hasDetail && (
                  <button
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    className="shrink-0 text-gray-600 hover:text-gray-400"
                  >
                    {showDetail ? '▲' : '🧠'}
                  </button>
                )}
              </div>

              {/* godMode 紧凑预览 — 默认可见 */}
              {godMode && hasDetail && !showDetail && (
                <div className="mt-1 ml-16 space-y-0.5">
                  {e.thinking && (
                    <div className="text-[10px] text-gray-500 leading-tight truncate border-l border-gray-700 pl-2">
                      🧠 {truncate(e.thinking)}
                    </div>
                  )}
                  {e.internal && (
                    <div className="text-[10px] text-gray-500 leading-tight truncate border-l border-gray-700 pl-2">
                      📋 {truncate(e.internal)}
                    </div>
                  )}
                  {e.wolfThoughts && e.wolfThoughts.map((wt, wi) => (
                    <div key={wi} className="text-[10px] text-gray-500 leading-tight truncate border-l border-red-800/50 pl-2">
                      🐺 {wt.seat}号: {truncate(wt.thinking || wt.internal || '')}
                    </div>
                  ))}
                </div>
              )}

              {showDetail && hasDetail && (
                <div className="mt-1 ml-16 space-y-1">
                  {e.thinking && (
                    <div className="text-gray-500 border-l border-gray-700 pl-2">
                      🧠 思考: {e.thinking}
                    </div>
                  )}
                  {e.internal && (
                    <div className="text-gray-500 border-l border-gray-700 pl-2">
                      📋 内部: {e.internal}
                    </div>
                  )}
                  {e.wolfThoughts && e.wolfThoughts.map((wt, wi) => (
                    <div key={wi} className="text-gray-500 border-l border-red-800 pl-2 mb-1">
                      <div className="text-red-400 font-medium">{wt.seat}号狼人:</div>
                      {wt.thinking && <div className="ml-2">🧠 {wt.thinking}</div>}
                      {wt.internal && <div className="ml-2">📋 {wt.internal}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
