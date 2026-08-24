import React, { useState, useCallback } from 'react';
import { useGameSocket } from '../../hooks/useGameSocket.js';
import { SeatRing } from '../../components/SeatRing.js';
import { InfoPanel } from './InfoPanel.js';
import { EventLog } from './EventLog.js';
import { PlayerDetailModal } from './PlayerDetailModal.js';
import { GameOverModal } from './GameOverModal.js';

const GameControls: React.FC<{ status: string }> = ({ status }) => {
  if (status !== 'running' && status !== 'paused') return null;

  const callApi = async (action: 'pause' | 'resume' | 'stop') => {
    const labels = { pause: '暂停', resume: '恢复', stop: '终止' };
    try {
      const res = await fetch(`/api/admin/game/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e: any) {
      alert(`${labels[action]}失败: ${e.message || '网络错误'}`);
    }
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
      {status === 'running' && (
        <button
          onClick={() => callApi('pause')}
          className="px-3 py-1.5 bg-yellow-600/80 rounded-lg text-xs font-medium hover:bg-yellow-500 transition-colors"
        >
          ⏸ 暂停
        </button>
      )}
      {status === 'paused' && (
        <>
          <span className="px-3 py-1.5 bg-yellow-900/60 rounded-lg text-xs text-yellow-400">
            已暂停
          </span>
          <button
            onClick={() => callApi('resume')}
            className="px-3 py-1.5 bg-green-600/80 rounded-lg text-xs font-medium hover:bg-green-500 transition-colors"
          >
            ▶ 恢复
          </button>
        </>
      )}
      <button
        onClick={() => { if (confirm('确定终止当前对局？')) callApi('stop'); }}
        className="px-3 py-1.5 bg-red-600/80 rounded-lg text-xs font-medium hover:bg-red-500 transition-colors"
      >
        ⏹ 终止
      </button>
    </div>
  );
};

/** 阶段进度指示器 — 游戏化时间轴（夜晚→天亮→竞选→白天→结算） */
const PhaseProgress: React.FC<{ phase: string }> = ({ phase }) => {
  const steps = [
    { key: 'night', label: '夜晚', phases: ['night_wolf', 'night_seer', 'night_witch', 'night_settle'] },
    { key: 'dawn', label: '天亮', phases: ['dawn', 'last_words'] },
    { key: 'sheriff', label: '竞选', phases: ['sheriff_election', 'sheriff_speech', 'sheriff_vote'] },
    { key: 'day', label: '白天', phases: ['day_speech', 'day_vote', 'day_settle'] },
    { key: 'end', label: '结算', phases: ['hunter_shot', 'sheriff_transfer', 'game_over'] },
  ];

  const activeStep = steps.findIndex(s => s.phases.includes(phase));

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 glass-card rounded-badge">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] transition-all duration-300
            ${i === activeStep
              ? 'bg-gradient-to-r from-gold-500/30 to-gold-400/10 text-gold-300 font-bold shadow-gold-glow ring-1 ring-gold-400/40'
              : i < activeStep
                ? 'text-gray-400'
                : 'text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${i <= activeStep ? 'bg-gold-400' : 'bg-gray-700'}`} />
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span className={`text-[10px] ${i < activeStep ? 'text-gold-500/60' : 'text-gray-700'}`}>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

function getDefaultPosition(): { x: number; y: number } {
  return {
    x: Math.max(0, (window.innerWidth - 420) / 2),
    y: Math.max(60, (window.innerHeight - 500) / 2),
  };
}

export const SpectatorView: React.FC = () => {
  const { gameState, entries, connected } = useGameSocket();
  const [godMode, setGodMode] = useState(false);
  const [activeSeat, setActiveSeat] = useState<number | null>(null);
  const [pinnedSeats, setPinnedSeats] = useState<number[]>([]);
  const [activePosition, setActivePosition] = useState(getDefaultPosition);
  const [pinnedPositions, setPinnedPositions] = useState<Record<number, { x: number; y: number }>>({});

  // ⚠️ 所有 hooks 必须在 early-return 之前无条件调用（React Rules of Hooks）
  const handlePlayerClick = useCallback((seat: number) => {
    // 如果点击的是已钉住的玩家，取消钉住
    if (pinnedSeats.includes(seat)) {
      setPinnedSeats(prev => prev.filter(s => s !== seat));
      return;
    }
    // 否则切换或替换 activeSeat
    setActiveSeat(prev => {
      if (prev === seat) return null;
      return seat;
    });
    setActivePosition(getDefaultPosition());
  }, [pinnedSeats]);

  const handlePin = useCallback((seat: number) => {
    setPinnedSeats(prev => {
      if (prev.includes(seat)) return prev; // already pinned
      if (prev.length >= 3) {
        alert('最多同时钉住 3 个窗口');
        return prev;
      }
      return [...prev, seat];
    });
    // 为钉住窗口设置初始位置（偏移避免完全重叠）
    setPinnedPositions(prev => {
      if (prev[seat]) return prev;
      const count = Object.keys(prev).length;
      return {
        ...prev,
        [seat]: {
          x: getDefaultPosition().x + count * 30,
          y: getDefaultPosition().y + count * 30,
        },
      };
    });
    // 如果这个座位正好是当前 activeSeat，关闭 active
    setActiveSeat(prev => prev === seat ? null : prev);
  }, []);

  const handleUnpin = useCallback((seat: number) => {
    setPinnedSeats(prev => prev.filter(s => s !== seat));
  }, []);

  const updatePinnedPosition = useCallback((seat: number, pos: { x: number; y: number }) => {
    setPinnedPositions(prev => ({ ...prev, [seat]: pos }));
  }, []);

  // 构造选中的座位列表：activeSeat + 所有钉住的
  const selectedSeats = React.useMemo(() => {
    const seats: number[] = [];
    if (activeSeat !== null) seats.push(activeSeat);
    pinnedSeats.forEach(s => { if (!seats.includes(s)) seats.push(s); });
    return seats;
  }, [activeSeat, pinnedSeats]);

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-44px)]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🐺</div>
          <div className="text-gray-500 text-sm">正在连接服务器...</div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-44px)]">
        <div className="text-center">
          <div className="text-4xl mb-4">🎮</div>
          <div className="text-gray-500 text-sm">等待游戏开始</div>
          <div className="text-gray-700 text-xs mt-2">前往「游戏配置」创建对局</div>
        </div>
      </div>
    );
  }

  const nightPhase = ['night_wolf', 'night_seer', 'night_witch', 'night_settle'].includes(gameState.phase as string);
  const centerLabel = nightPhase ? '天黑请闭眼' : '天亮了';

  const getPlayer = (seat: number) =>
    gameState.players.find((p: any) => p.seatNumber === seat) || null;

  // 判断 activeSeat 是否应该显示（非钉住状态）
  const showActiveModal = activeSeat !== null && !pinnedSeats.includes(activeSeat);

  // 游戏结束检测
  const gameEnded = gameState.status === 'finished' || gameState.phase === 'game_over';

  return (
    <div className="h-[calc(100vh-44px)] p-3 flex flex-col gap-3 relative">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between shrink-0">
        <PhaseProgress phase={gameState.phase} />
        <div className="flex items-center gap-2">
          <GameControls status={gameState.status} />
          <button
            onClick={() => setGodMode(!godMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              godMode
                ? 'bg-purple-600/80 text-white hover:bg-purple-500 shadow-[0_0_12px_rgba(147,51,234,0.4)]'
                : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 border border-white/10'
            }`}
          >
            {godMode ? '👁️ 上帝视角' : '👤 观众视角'}
          </button>
        </div>
      </div>

      {/* 主体三栏 */}
      <div className="flex-1 grid grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,300px)] gap-3 min-h-0 min-w-0">
        <div className="min-w-0 min-h-0">
          <InfoPanel
            gameState={gameState}
            godMode={godMode}
            onPlayerClick={handlePlayerClick}
            selectedSeat={activeSeat}
          />
        </div>
        <div className="flex items-center justify-center min-h-0 min-w-0 overflow-hidden">
          <SeatRing
            players={gameState.players.map((p: any) => ({ ...p, camp: p.camp || 'good' }))}
            currentSpeaker={gameState.currentSpeaker}
            centerLabel={centerLabel}
            showRoles={godMode}
            onPlayerClick={handlePlayerClick}
            selectedSeats={selectedSeats}
            isNight={nightPhase}
          />
        </div>
        <div className="min-w-0 min-h-0">
          <EventLog entries={entries} godMode={godMode} />
        </div>
      </div>

      {/* 钉住窗口 — 无遮罩，直接浮在主界面上方 */}
      {pinnedSeats.map((seat, index) => (
        <PlayerDetailModal
          key={`pinned-${seat}`}
          seatNumber={seat}
          player={getPlayer(seat)}
          entries={entries}
          godMode={godMode}
          pinned={true}
          onClose={() => handleUnpin(seat)}
          onTogglePin={() => handleUnpin(seat)}
          position={pinnedPositions[seat] || {
            x: getDefaultPosition().x + index * 30,
            y: getDefaultPosition().y + index * 30,
          }}
          onPositionChange={(pos) => updatePinnedPosition(seat, pos)}
        />
      ))}

      {/* 非钉住浮窗 — 带遮罩 */}
      {showActiveModal && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setActiveSeat(null)}
          />
          <PlayerDetailModal
            seatNumber={activeSeat}
            player={getPlayer(activeSeat)}
            entries={entries}
            godMode={godMode}
            pinned={false}
            onClose={() => setActiveSeat(null)}
            onTogglePin={() => handlePin(activeSeat)}
            position={activePosition}
            onPositionChange={setActivePosition}
          />
        </>
      )}

      {/* 游戏结束弹窗 — 覆盖在所有内容之上 */}
      {gameEnded && <GameOverModal gameState={gameState} entries={entries} />}
    </div>
  );
};
