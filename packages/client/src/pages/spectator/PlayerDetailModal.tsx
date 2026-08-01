import React, { useMemo, useRef, useCallback } from 'react';
import type { LogEntry } from '../../utils/log-format.js';
import { RoleIcon, ROLE_LABELS, ROLE_COLORS, SheriffCrown } from '../../components/RoleIcon.js';

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
  const roleColor = roleType ? ROLE_COLORS[roleType] : '#94a3b8';
  // 观众视角不泄露身份：匿名问号图腾 + 中性灰
  const iconRole = godMode ? (roleType || 'unknown') : 'unknown';
  const iconColor = godMode ? roleColor : '#8a8fa3';
  const headerBg = godMode
    ? `linear-gradient(120deg, ${roleColor}26 0%, rgba(20,20,42,0) 55%)`
    : 'linear-gradient(120deg, rgba(255,255,255,0.05) 0%, rgba(20,20,42,0) 55%)';
  const headerEdge = godMode ? roleColor : 'rgba(255,255,255,0.14)';

  return (
    <div
      className="fixed left-0 top-0 z-50 pointer-events-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div
        className="w-[420px] max-h-[70vh] rounded-card overflow-hidden flex flex-col pointer-events-auto animate-pop-in
          bg-night-900/95 border border-white/15 shadow-card-glow backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 — 可拖动，身份色渐变 */}
        <div
          className={`relative flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing select-none`}
          style={{ background: headerBg }}
          onMouseDown={handleMouseDown}
        >
          {/* 身份色顶边（观众视角为中性灰） */}
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: headerEdge }} />
          <div className="flex items-center gap-3">
            <RoleIcon role={iconRole} size={44} color={iconColor} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-100">{seatNumber}号玩家</span>
                {player?.isSheriff && <SheriffCrown size={15} className="text-gold-400" />}
                {player?.isAlive ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-camp-good/15 text-camp-good ring-1 ring-camp-good/30 rounded-badge">存活</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/10 text-gray-500 ring-1 ring-gray-500/30 rounded-badge">死亡</span>
                )}
              </div>
              {/* 上帝视角才显示身份 */}
              {godMode && (
                <div className="text-xs mt-0.5 font-medium" style={{ color: roleColor }}>
                  <span className="flex items-center gap-1">
                    身份：{roleLabel}
                    {roleType === 'witch' && player && (
                      <span className="text-[10px] text-gray-400 font-normal">
                        解药{player.witchUsedHeal ? '已用' : '有'} · 毒药{player.witchUsedPoison ? '已用' : '有'}
                      </span>
                    )}
                  </span>
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
              <div key={e.id} className="bg-white/[0.04] rounded-lg px-3 py-2 border border-white/10">
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
                      <div key={wi} className="text-gray-500 border-l border-wolfred-500/40 pl-2 text-[11px]">
                        <span className="text-wolfred-400">{wt.seat}号狼人:</span>
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
