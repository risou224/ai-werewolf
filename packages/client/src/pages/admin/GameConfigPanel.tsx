import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ModelItem {
  id: string; name: string; endpoint: string; model_id: string;
  provider_id?: string | null;
}

interface ProviderItem {
  id: string; name: string; endpoint: string; api_key?: string; enabled: number;
  models: ModelItem[];
}

interface SeatConfig {
  seatNumber: number;
  modelConfigId: string;
  modelInstanceLabel: string;
  systemPrompt: string;
}

interface RoleDef {
  type: string;
  name: string;
  camp: 'good' | 'evil';
  nightOrder: number;
  skillTags: string[];
}

interface BoardPreset {
  id: string;
  name: string;
  totalPlayers: number;
  roles: string[];
  rules: Record<string, any>;
  isBuiltin: boolean;
}

const DEFAULT_ROLE_OPTIONS = ['wolf', 'seer', 'witch', 'hunter', 'idiot', 'villager'];

export const GameConfigPanel: React.FC = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [roleDefs, setRoleDefs] = useState<RoleDef[]>([]);
  const [boards, setBoards] = useState<BoardPreset[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('builtin_12');
  const [customMode, setCustomMode] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(12);
  const [configName, setConfigName] = useState('标准12人局');
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [seats, setSeats] = useState<SeatConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [gameStatus, setGameStatus] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/models').then(r => r.json()).then(setModels);
    fetch('/api/admin/providers').then(r => r.json()).then(setProviders).catch(() => {});
    fetch('/api/admin/role-defs').then(r => r.json()).then(setRoleDefs).catch(() => {});
    fetch('/api/admin/board-presets').then(r => r.json()).then(setBoards).catch(() => {});
    fetch('/api/admin/game/status').then(r => r.json()).then(data => {
      if (data.status && data.status !== 'no_game') {
        setGameStatus(data.status);
        setSessionId(data.id);
      }
    }).catch(() => {});
  }, []);

  // 当选择板子时，自动填入总人数、配置名、角色列表
  useEffect(() => {
    if (customMode) return;
    const board = boards.find(b => b.id === selectedBoardId);
    if (board) {
      setTotalPlayers(board.totalPlayers);
      setConfigName(board.name);
      setCustomRoles(board.roles);
    }
  }, [selectedBoardId, boards, customMode]);

  // 生成座位
  useEffect(() => {
    const newSeats: SeatConfig[] = [];
    for (let i = 1; i <= totalPlayers; i++) {
      newSeats.push({
        seatNumber: i,
        modelConfigId: models.length > 0 ? models[0].id : '',
        modelInstanceLabel: `Player-${i}`,
        systemPrompt: '',
      });
    }
    setSeats(newSeats);
  }, [totalPlayers, models]);

  const handleModelChange = (seatIndex: number, modelId: string) => {
    setSeats(prev => prev.map((s, i) => i === seatIndex ? { ...s, modelConfigId: modelId } : s));
  };

  const handleLabelChange = (seatIndex: number, label: string) => {
    setSeats(prev => prev.map((s, i) => i === seatIndex ? { ...s, modelInstanceLabel: label } : s));
  };

  // 随机分配模型：优先不重复（模型足够时每个座位不同模型），
  // 模型不够时随机重复；分配结果随机打乱顺序和位置
  const handleRandomAssign = () => {
    const seatCount = customRoles.length || totalPlayers;
    const available = models.filter(m => m.id);
    if (available.length === 0 || seatCount === 0) return;

    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // 1. 打乱模型列表，取前 min(座位数, 模型数) 个 → 保证不重复优先
    const shuffledModels = shuffle(available);
    const uniqueCount = Math.min(seatCount, available.length);
    const assigned: string[] = [];
    for (let i = 0; i < uniqueCount; i++) {
      assigned.push(shuffledModels[i].id);
    }
    // 2. 模型不够：剩余座位从全部模型中随机重复
    while (assigned.length < seatCount) {
      assigned.push(available[Math.floor(Math.random() * available.length)].id);
    }
    // 3. 再随机打乱一次 → 顺序和位置随机
    const final = shuffle(assigned);

    setSeats(prev => prev.map((seat, i) =>
      i < final.length ? { ...seat, modelConfigId: final[i] } : seat
    ));
  };

  const handleAddRole = (roleType: string) => {
    if (customRoles.length >= 20) return;
    setCustomRoles(prev => [...prev, roleType]);
    setTotalPlayers(customRoles.length + 1);
  };

  const handleRemoveRole = (idx: number) => {
    setCustomRoles(prev => prev.filter((_, i) => i !== idx));
    setTotalPlayers(prev => Math.max(3, prev - 1));
  };

  const handleSaveCustomBoard = async () => {
    if (!configName.trim() || customRoles.length < 3) {
      setError('自定义板子至少需要 3 个角色');
      return;
    }
    try {
      const res = await fetch('/api/admin/board-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: configName, totalPlayers: customRoles.length, roles: customRoles, rules: {} }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error('保存失败');
      // 刷新板子列表并选中新建的
      const refreshed = await fetch('/api/admin/board-presets').then(r => r.json());
      setBoards(refreshed);
      setSelectedBoardId(data.id);
      setCustomMode(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteCustomBoard = async (id: string) => {
    if (!confirm('确定删除这个自定义板子？')) return;
    try {
      const res = await fetch(`/api/admin/board-presets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '删除失败');
      const refreshed = await fetch('/api/admin/board-presets').then(r => r.json());
      setBoards(refreshed);
      if (selectedBoardId === id) setSelectedBoardId('builtin_12');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStartGame = async () => {
    setSaving(true);
    setError(null);

    const emptySeats = seats.filter(s => !s.modelConfigId);
    if (emptySeats.length > 0) {
      setError(`以下座位未绑定模型: ${emptySeats.map(s => s.seatNumber).join('、')}`);
      setSaving(false);
      return;
    }

    try {
      const roles = customMode ? customRoles : (boards.find(b => b.id === selectedBoardId)?.roles || []);
      const actualTotal = roles.length;
      const adjustedSeats = seats.slice(0, actualTotal);

      // 从板子预设读取 sheriffEnabled（默认 true）
      const board = customMode ? null : boards.find(b => b.id === selectedBoardId);
      const sheriffEnabled = board?.rules?.sheriffEnabled !== false;

      const configRes = await fetch('/api/admin/game-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configName,
          totalPlayers: actualTotal,
          roles,
          players: adjustedSeats,
          sheriffEnabled,
          boardPresetId: customMode ? undefined : selectedBoardId,
        }),
      });
      const configData = await configRes.json();
      if (!configData.ok) throw new Error('创建配置失败');

      const startRes = await fetch('/api/admin/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: configData.id }),
      });
      const startData = await startRes.json();
      if (!startData.ok) throw new Error(startData.error || '开局失败');

      setSessionId(startData.sessionId);
      setGameStatus('running');

      setTimeout(() => navigate('/'), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (gameStatus === 'running') {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎮</div>
        <h2 className="text-xl font-bold mb-2">游戏进行中</h2>
        <p className="text-gray-400 mb-4">对局 ID: {sessionId}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-amber-600 rounded-lg hover:bg-amber-500"
          >
            👁️ 前往观战
          </button>
          <button
            onClick={async () => {
              await fetch('/api/admin/game/stop', { method: 'POST' });
              setGameStatus(null);
              setSessionId(null);
            }}
            className="px-6 py-3 bg-red-600 rounded-lg hover:bg-red-700"
          >
            终止游戏
          </button>
        </div>
      </div>
    );
  }

  const currentBoard = boards.find(b => b.id === selectedBoardId);
  const roleCounts: Record<string, number> = {};
  (customMode ? customRoles : currentBoard?.roles || []).forEach(r => {
    roleCounts[r] = (roleCounts[r] || 0) + 1;
  });

  return (
    <div>
      <h2 className="text-xl font-bold gold-text mb-6">游戏配置</h2>

      {/* 板子选择 */}
      <div className="glass-card rounded-card p-4 mb-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm text-gray-400">选择板子</h3>
          <button
            onClick={() => setCustomMode(!customMode)}
            className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white"
          >
            {customMode ? '切换到预设' : '🛠️ 自定义板子'}
          </button>
        </div>

        {!customMode && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1">配置名称</label>
                <input
                  className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white"
                  value={configName}
                  onChange={e => setConfigName(e.target.value)}
                />
              </div>
              <div className="w-48">
                <label className="text-sm text-gray-400 block mb-1">板子</label>
                <select
                  className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white"
                  value={selectedBoardId}
                  onChange={e => setSelectedBoardId(e.target.value)}
                >
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.isBuiltin ? '★' : '☆'} {b.name} ({b.totalPlayers}人)
                    </option>
                  ))}
                </select>
              </div>
              {currentBoard && !currentBoard.isBuiltin && (
                <button
                  onClick={() => handleDeleteCustomBoard(currentBoard.id)}
                  className="self-end px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-xs text-white"
                >
                  删除板子
                </button>
              )}
            </div>
            {currentBoard && (
              <>
                <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                  {Object.entries(roleCounts).map(([type, count]) => {
                    const def = roleDefs.find(d => d.type === type);
                    return (
                      <span key={type} className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded">
                        {def?.name || type} × {count}
                      </span>
                    );
                  })}
                </div>
                {/* 规则标签 */}
                <div className="text-[10px] text-gray-500 flex gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 bg-white/[0.05] border border-white/5 rounded">
                    {currentBoard.rules?.winCondition === 'slaughter_side' ? '屠边' : '屠城'}
                  </span>
                  <span className="px-1.5 py-0.5 bg-white/[0.05] border border-white/5 rounded">
                    {currentBoard.rules?.sheriffEnabled === false ? '无警长' : '有警长'}
                  </span>
                  {currentBoard.rules?.firstNightWitchPoison === false && (
                    <span className="px-1.5 py-0.5 bg-white/[0.05] border border-white/5 rounded">首夜禁毒</span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {customMode && (
          <>
            <div>
              <label className="text-sm text-gray-400 block mb-1">板子名称</label>
              <input
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white"
                placeholder="例：自定义8人局"
                value={configName}
                onChange={e => setConfigName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                当前角色 ({customRoles.length} 人)
              </label>
              <div className="flex gap-1 flex-wrap mb-2 min-h-[40px] p-2 bg-white/[0.03] border border-white/10 rounded">
                {customRoles.length === 0 && (
                  <span className="text-xs text-gray-500 py-2 px-1">点击下方按钮添加角色</span>
                )}
                {customRoles.map((role, idx) => {
                  const def = roleDefs.find(d => d.type === role);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleRemoveRole(idx)}
                      className="text-xs px-2 py-1 bg-white/[0.06] hover:bg-wolfred-500/30 border border-white/10 rounded text-white"
                      title="点击移除"
                    >
                      {def?.name || role} ×
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1 flex-wrap">
                {(roleDefs.length > 0 ? roleDefs.map(d => d.type) : DEFAULT_ROLE_OPTIONS).map(roleType => {
                  const def = roleDefs.find(d => d.type === roleType);
                  return (
                    <button
                      key={roleType}
                      onClick={() => handleAddRole(roleType)}
                      className={`text-xs px-2 py-1 rounded border border-white/10 ${
                        def?.camp === 'evil'
                          ? 'bg-wolfred-500/20 hover:bg-wolfred-500/40 text-wolfred-400'
                          : 'bg-purple-500/15 hover:bg-purple-500/35 text-purple-300'
                      }`}
                    >
                      + {def?.name || roleType}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleSaveCustomBoard}
              className="text-sm px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-white"
            >
              💾 保存为新板子
            </button>
          </>
        )}
      </div>

      {/* 座位编排 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">
          座位编排（{customRoles.length || totalPlayers} 个座位）
        </h3>
        <button
          onClick={handleRandomAssign}
          disabled={models.length === 0}
          className="text-sm px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="随机分配模型：优先不重复，模型不够时随机重复，顺序位置随机"
        >
          🎲 随机分配模型
        </button>
      </div>
      <div className="glass-card rounded-card p-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {seats.slice(0, customRoles.length || totalPlayers).map((seat, i) => (
            <div key={seat.seatNumber} className="bg-white/[0.04] border border-white/10 rounded-card p-3">
              <div className="text-sm text-yellow-400 font-bold mb-2">{seat.seatNumber}号座位</div>
              <div className="space-y-2">
                <select
                  className="w-full px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-sm text-white"
                  value={seat.modelConfigId}
                  onChange={e => handleModelChange(i, e.target.value)}
                >
                  <option value="">选择模型</option>
                  {/* 按 API 配置分组 */}
                  {providers.map(p => (
                    <optgroup key={p.id} label={`${p.name}（${p.models.length}）`}>
                      {p.models.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  ))}
                  {/* 独立模型（老配置） */}
                  {models.filter(m => !m.provider_id).length > 0 && (
                    <optgroup label="独立模型">
                      {models.filter(m => !m.provider_id).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <input
                  className="w-full px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-sm text-white"
                  placeholder="人格标签（可选）"
                  value={seat.modelInstanceLabel}
                  onChange={e => handleLabelChange(i, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4 text-sm text-red-300">{error}</div>
      )}

      <button
        onClick={handleStartGame}
        disabled={saving || models.length === 0 || (customRoles.length || totalPlayers) < 3}
        className="w-full py-3 bg-green-600 rounded-lg font-bold text-lg hover:bg-green-700
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? '准备中...' : models.length === 0 ? '请先添加模型' : '🎬 开始游戏'}
      </button>
    </div>
  );
};
