import React, { useMemo, useRef, useCallback } from 'react';
import type { LogEntry } from '../../utils/log-format.js';

interface PlayerDetailModalProps {
  seatNumber: number;
  player: any | null;
  entries: LogEntry[];
  godMode: boolean;
  onClose: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  position: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
}

const ROLE_LABELS: Record<string, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫',
  hunter: '猎人', idiot: '白痴', villager: '平民',
};

const ROLE_COLORS: Record<string, string> = {
  wolf: 'text-red-400',
  seer: 'text-purple-400',
  witch: 'text-emerald-400',
  hunter: 'text-orange-400',
  idiot: 'text-sky-400',
  villager: 'text-gray-400',
};

/** 从 LogEntry.text 中提取座位号 */
function extractSeat(text: string): number | null {
  const m = text.match(/(\d+)号/);
  return m ? parseInt(m[1], 10) : null;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  seatNumber, player, entries, godMode, onClose,
  pinned = false, onTogglePin,
  position, onPositionChange,
}) => {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header, not from buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragState.current.isDragging = true;
    dragState.current.startX = e.clientX;
    dragState.current.startY = e.clientY;
    dragState.current.startPosX = position.x;
    dragState.current.startPosY = position.y;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      onPositionChange({
        x: dragState.current.startPosX + dx,
        y: dragState.current.startPosY + dy,
      });
    };

    const onMouseUp = () => {
      dragState.current.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [position, onPositionChange]);

  // 过滤出与该玩家相关的所有条目
  const playerEntries = useMemo(() => {
    return entries.filter(e => {
      // 发言条目：text 格式 "X号发言：..."
      if (e.text.startsWith(`${seatNumber}号发言`)) return true;
      // 其他条目：从 text 提取座位号
      const seats = e.text.match(/(\d+)号/g);
      if (seats) {
        return seats.some(s => parseInt(s) === seatNumber);
      }
      return false;
    });
  }, [seatNumber, entries]);

  const roleType = player?.roleType;
  const roleLabel = roleType ? ROLE_LABELS[roleType] || roleType : '未知';
  const roleColor = roleType ? ROLE_COLORS[roleType] || 'text-gray-400' : 'text-gray-400';

  return (
    <div
      className="fixed left-0 top-0 z-50 pointer-events-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div
        className="w-[420px] max-h-[70vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 — 可拖动 */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0 ${
            pinned ? 'cursor-grab' : 'cursor-grab'
          } active:cursor-grabbing select-none`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
              ${player?.isAlive ? 'bg-gray-800 text-gray-100' : 'bg-gray-900 text-gray-600'}`}>
              {seatNumber}号
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-100">{seatNumber}号玩家</span>
                {player?.isSheriff && <span className="text-amber-400 text-sm">👑</span>}
                {player?.isAlive ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">存活</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">死亡</span>
                )}
              </div>
              {/* 上帝视角才显示身份 */}
              {godMode && (
                <div className={`text-xs ${roleColor} mt-0.5`}>
                  身份：{roleLabel}
                  {roleType === 'wolf' && ' 🐺'}
                  {roleType === 'seer' && ' 🔮'}
                  {roleType === 'witch' && ' 💊'}
                  {roleType === 'hunter' && ' 🔫'}
                </div>
              )}
              {godMode && roleType === 'witch' && player && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  解药: {player.witchUsedHeal ? '已用' : '有'} · 毒药: {player.witchUsedPoison ? '已用' : '有'}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                className={`text-lg leading-none px-1.5 transition-colors ${
                  pinned ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={pinned ? '取消钉住' : '钉住窗口'}
              >
                📌
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none px-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 事件列表 — 始终显示 thinking/internal */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {playerEntries.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-8">该玩家暂无行动记录</div>
          ) : (
            playerEntries.map(e => (
              <div key={e.id} className="bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/40">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-gray-600 text-[10px] shrink-0">{e.time}</span>
                  <span className="shrink-0 text-sm">{e.icon}</span>
                  <span className={`text-xs flex-1 break-words ${e.isError ? 'text-red-400' : 'text-gray-300'}`}>
                    {e.text}
                  </span>
                </div>
                {/* 思考内容（始终显示，不需要 godMode 条件） */}
                {(e.thinking || e.internal) && (
                  <div className="mt-1 ml-5 space-y-0.5">
                    {e.thinking && (
                      <div className="text-gray-500 border-l border-gray-700 pl-2 text-[11px]">
                        🧠 {e.thinking}
                      </div>
                    )}
                    {e.internal && (
                      <div className="text-gray-500 border-l border-gray-700 pl-2 text-[11px]">
                        📋 {e.internal}
                      </div>
                    )}
                  </div>
                )}
                {/* 狼队思考 */}
                {e.wolfThoughts && (
                  <div className="mt-1 ml-5 space-y-0.5">
                    {e.wolfThoughts.map((wt, wi) => (
                      <div key={wi} className="text-gray-500 border-l border-red-800 pl-2 text-[11px]">
                        <span className="text-red-400">{wt.seat}号狼人:</span>
                        {wt.thinking && <div className="ml-2">🧠 {wt.thinking}</div>}
                        {wt.internal && <div className="ml-2">📋 {wt.internal}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
