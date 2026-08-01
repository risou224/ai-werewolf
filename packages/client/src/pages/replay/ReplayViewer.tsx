import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { SeatRing } from '../../components/SeatRing.js';
import { InfoPanel } from '../spectator/InfoPanel.js';
import { EventLog } from '../spectator/EventLog.js';
import { eventToEntry } from '../../utils/log-format.js';
import type { PlayerState, GameEvent, RoleType, Camp, GamePhase, EventType } from '@ai-werewolf/shared';

interface ReplayPlayer {
  seat: number;
  role: RoleType;
  camp: Camp;
}

interface ReplayTimelineEvent {
  index: number;
  timestamp: string;
  round: number;
  phase: string;
  type: string;
  actorSeat: number | null;
  targetSeat: number | null;
  data: Record<string, unknown>;
}

interface ReplayData {
  sessionId: string;
  startTime: string;
  endTime: string;
  totalRounds: number;
  winner: string | null;
  players: ReplayPlayer[];
  timeline: ReplayTimelineEvent[];
}

interface BuiltPlayerState extends PlayerState {}

interface BuiltGameState {
  players: BuiltPlayerState[];
  currentSpeaker: number | null;
  sheriffSeat: number | null;
  round: number;
  phase: string;
}

interface ReplayListItem {
  sessionId: string;
  startTime: string;
  totalRounds: number;
  winner: string | null;
  playerCount: number;
}

function buildStateAt(replay: ReplayData, index: number): BuiltGameState {
  const players: BuiltPlayerState[] = replay.players.map(p => ({
    seatNumber: p.seat,
    roleType: p.role,
    camp: p.camp,
    isAlive: true,
    isSheriff: false,
    hasVoteRight: true,
    witchHasHeal: true,
    witchHasPoison: true,
    witchUsedHeal: false,
    witchUsedPoison: false,
    hunterCanShoot: true,
    idiotRevealed: false,
  }));

  let currentSpeaker: number | null = null;
  let sheriffSeat: number | null = null;
  let round = 1;
  let phase = 'idle';

  const eventsUpTo = replay.timeline.slice(0, index + 1);
  for (const ev of eventsUpTo) {
    round = ev.round;
    phase = ev.phase;
    if ((ev.type === 'death' || ev.type === 'eliminate') && ev.targetSeat) {
      const p = players.find(pl => pl.seatNumber === ev.targetSeat);
      if (p) p.isAlive = false;
    }
    if (ev.type === 'sheriff_elect' && ev.targetSeat) {
      sheriffSeat = ev.targetSeat;
      const p = players.find(pl => pl.seatNumber === ev.targetSeat);
      if (p) p.isSheriff = true;
    }
    if (ev.type === 'speech') {
      currentSpeaker = ev.actorSeat;
    }
  }

  return { players, currentSpeaker, sheriffSeat, round, phase };
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

// ---------- Replay List View ----------

const ReplayList: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const [replays, setReplays] = useState<ReplayListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/replays')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setReplays(Array.isArray(data) ? data : data?.replays ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-werewolf-bg">
        <div className="text-gray-400 text-lg">加载回放列表...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-werewolf-bg">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">加载失败</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-werewolf-bg text-white min-h-screen p-8">
      <h1 className="text-3xl font-bold text-yellow-400 mb-8">📺 游戏回放</h1>
      {replays.length === 0 ? (
        <div className="text-gray-500 text-center py-12">暂无回放记录</div>
      ) : (
        <div className="grid gap-4 max-w-3xl mx-auto">
          {replays.map(replay => (
            <div
              key={replay.sessionId}
              onClick={() => onSelect(replay.sessionId)}
              className="glass-card rounded-card p-5 cursor-pointer border border-white/10 hover:border-gold-400/40 transition-all hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold mb-1">
                    游戏 #{replay.sessionId.slice(0, 8)}
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>🕐 {formatTime(replay.startTime)}</div>
                    <div>👥 {replay.playerCount} 名玩家 · 🔄 {replay.totalRounds} 轮</div>
                    {replay.winner && (
                      <div className={replay.winner === 'good' ? 'text-green-400' : 'text-red-400'}>
                        🏆 {replay.winner === 'good' ? '好人阵营胜利' : '狼人阵营胜利'}
                      </div>
                    )}
                  </div>
                </div>
                <button className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded text-sm font-bold">
                  播放 ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Replay Player View ----------

const ReplayPlayer: React.FC<{ replayId: string }> = ({ replayId }) => {
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/replays/${replayId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ReplayData) => {
        setReplay(data);
        setCurrentIndex(0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [replayId]);

  // Playback interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (playing && replay) {
      const baseInterval = 1500; // ms between events
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          if (next >= replay.timeline.length - 1) {
            setPlaying(false);
            return replay.timeline.length - 1;
          }
          return next;
        });
      }, baseInterval / speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, speed, replay]);

  const handlePlayPause = useCallback(() => {
    if (!replay) return;
    if (currentIndex >= replay.timeline.length - 1) {
      setCurrentIndex(0);
    }
    setPlaying(prev => !prev);
  }, [replay, currentIndex]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!replay) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const idx = Math.round(pct * (replay.timeline.length - 1));
    setCurrentIndex(Math.max(0, Math.min(idx, replay.timeline.length - 1)));
  }, [replay]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-werewolf-bg">
        <div className="text-gray-400 text-lg">加载回放...</div>
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div className="flex items-center justify-center h-screen bg-werewolf-bg">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">加载回放失败</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  const builtState = buildStateAt(replay, currentIndex);
  const progress = replay.timeline.length > 1
    ? (currentIndex / (replay.timeline.length - 1)) * 100
    : 0;
  const currentEvent = replay.timeline[currentIndex];

  // Map builtState to the format InfoPanel expects
  const infoPanelState = {
    phase: builtState.phase,
    round: builtState.round,
    status: currentIndex >= replay.timeline.length - 1 ? 'ended' : 'running',
    sheriffSeat: builtState.sheriffSeat,
    winner: currentIndex >= replay.timeline.length - 1 ? replay.winner : null,
    players: builtState.players,
  };

  return (
    <div className="text-white min-h-screen p-4 flex flex-col">
      {/* Controls Bar */}
      <div className="glass-card rounded-card p-3 mb-4 flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-1.5 rounded font-bold text-sm"
        >
          {playing ? '⏸ 暂停' : currentIndex >= replay.timeline.length - 1 ? '🔄 重播' : '▶ 播放'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">速度:</span>
          {[1, 2, 4, 8].map(s => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-1 rounded text-xs font-bold ${
                speed === s
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white/[0.06] text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="text-gray-400 text-xs">
          事件 {currentIndex + 1} / {replay.timeline.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="bg-white/[0.06] border border-white/10 rounded-full h-2 mb-4 cursor-pointer relative overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="bg-yellow-500 h-full rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
        {currentEvent && (
          <div className="absolute top-4 left-0 right-0 text-center text-gray-500 text-xs">
            [{currentEvent.round}d] {currentEvent.phase} — {currentEvent.type}
            {currentEvent.actorSeat && ` ${currentEvent.actorSeat}号`}
          </div>
        )}
      </div>

      {/* Main Display */}
      <div className="grid grid-cols-[280px_1fr_300px] gap-4 flex-1 min-h-0">
        <InfoPanel gameState={infoPanelState} />
        <div className="flex flex-col items-center justify-center">
          <SeatRing
            players={builtState.players}
            currentSpeaker={builtState.currentSpeaker}
            centerLabel={
              builtState.phase === 'game_over'
                ? '🏁 游戏结束'
                : builtState.phase.includes('night')
                  ? '🌙 夜晚'
                  : '☀️ 白天'
            }
          />
        </div>
        <EventLog
          entries={replay.timeline.slice(0, currentIndex + 1).map(ev => eventToEntry({
            id: `replay-${ev.index}`,
            sessionId: replay.sessionId,
            round: ev.round,
            phase: ev.phase as GamePhase,
            type: ev.type as EventType,
            actorSeat: ev.actorSeat,
            targetSeat: ev.targetSeat,
            data: ev.data as Record<string, unknown>,
            timestamp: ev.timestamp,
          }))}
        />
      </div>
    </div>
  );
};

// ---------- Main Export ----------

export const ReplayViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <ReplayList onSelect={(selectedId) => {
      window.history.pushState(null, '', `/replay/${selectedId}`);
      // Force re-render by wrapping in a key-changing component
      window.location.href = `/replay/${selectedId}`;
    }} />;
  }

  return <ReplayPlayer replayId={id} />;
};
