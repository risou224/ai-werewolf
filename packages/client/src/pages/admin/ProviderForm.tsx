import React, { useState } from 'react';
import { useAdminAPI } from '../../hooks/useAdminAPI.js';

interface ProviderModelItem {
  id: string;
  name: string;
  model_id: string;
}

interface ProviderFormData {
  name: string;
  endpoint: string;
  apiKey?: string;
}

interface ProviderFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editProvider?: {
    id: string;
    name: string;
    endpoint: string;
    apiKey?: string;
    /** 该 API 下已挂载的模型 */
    models?: ProviderModelItem[];
  };
}

interface CandidateModel {
  modelId: string;
  name: string;
  /** 是否已挂载在该 API 下 */
  existing: boolean;
}

/**
 * API 配置表单：填 endpoint + apiKey，测试连接后拉取该 API 下的所有模型，
 * 通过勾选/取消勾选管理挂载的模型（编辑模式下取消勾选已挂载模型 = 移除）。
 */
export const ProviderForm: React.FC<ProviderFormProps> = ({ onClose, onSuccess, editProvider }) => {
  const { createProvider, updateProvider, deleteModel, addProviderModels, testEndpoint, fetchAvailableModels } = useAdminAPI();
  const isEdit = !!editProvider;

  const [form, setForm] = useState<ProviderFormData>({
    name: editProvider?.name || '',
    endpoint: editProvider?.endpoint || '',
    apiKey: editProvider?.apiKey || '',
  });
  const [submitting, setSubmitting] = useState(false);

  // 测试连接状态
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [endpointSuggestion, setEndpointSuggestion] = useState('');

  // 拉取模型状态
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetched, setFetched] = useState(false); // 是否已成功拉取过
  const [candidates, setCandidates] = useState<CandidateModel[]>(() =>
    (editProvider?.models || []).map(m => ({ modelId: m.model_id, name: m.name, existing: true }))
  );
  // 勾选状态：仅编辑模式下已挂载的模型默认勾选；拉取到的新模型一律不默认勾选，由用户手动选
  const [checked, setChecked] = useState<Set<string>>(() =>
    new Set((editProvider?.models || []).map(m => m.model_id))
  );

  // 已挂载的 model_id -> 模型配置 id（用于移除时删除）
  const existingById = new Map<string, string>();
  (editProvider?.models || []).forEach(m => existingById.set(m.model_id, m.id));

  const handleTestConnection = async () => {
    if (!form.endpoint) return;
    setTestStatus('testing');
    setTestError('');
    setEndpointSuggestion('');
    const result = await testEndpoint(form.endpoint, form.apiKey || undefined);
    setTestStatus(result.ok ? 'ok' : 'fail');
    if (!result.ok) {
      setTestError(result.error || '连接失败');
      const base = form.endpoint.replace(/\/$/, '');
      if (/404/.test(result.error || '')) {
        setEndpointSuggestion(`可能是路径不正确，试试在末尾补全路径，如 ${base}/v1`);
      } else if (/401|403/.test(result.error || '')) {
        setEndpointSuggestion('可能是 API Key 无效或已过期');
      } else if (/ENOTFOUND|ECONNREFUSED|fetch failed/.test(result.error || '')) {
        setEndpointSuggestion('无法连接到该地址，请检查 URL 是否正确、服务是否运行');
      }
    }
  };

  const handleFetchModels = async () => {
    if (!form.endpoint) return;
    setFetchingModels(true);
    setTestError('');
    setEndpointSuggestion('');
    const result = await fetchAvailableModels(form.endpoint, form.apiKey || undefined);
    setFetchingModels(false);
    if (result.ok && result.models.length > 0) {
      setFetched(true);
      setTestStatus('ok');
      // 合并：拉取到的 + 已挂载的（已挂载但拉取列表没有的保留，防止误删）
      setCandidates(prev => {
        const map = new Map<string, CandidateModel>();
        prev.forEach(c => map.set(c.modelId, c));
        result.models.forEach(m => {
          if (!map.has(m.id)) map.set(m.id, { modelId: m.id, name: m.name, existing: false });
        });
        return [...map.values()];
      });
      // 新拉取到的模型不自动勾选，保持用户已有的勾选状态不变（编辑模式下已挂载的仍保持勾选）
    } else {
      setTestStatus('fail');
      setTestError(result.error || '未获取到模型');
      const base = form.endpoint.replace(/\/$/, '');
      if (/404/.test(result.error || '')) {
        setEndpointSuggestion(`可能是路径不正确，试试在末尾补全路径，如 ${base}/v1`);
      }
    }
  };

  const toggleModel = (modelId: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editProvider) {
        // 1. 更新 API 配置信息（endpoint/key 变更会同步到其下所有模型）
        await updateProvider(editProvider.id, form);

        // 2. diff 模型：勾选新增 → 添加；取消勾选已挂载 → 移除
        const toAdd = [...checked].filter(mid => !existingById.has(mid));
        const toRemove = [...existingById.keys()].filter(mid => !checked.has(mid));
        if (toAdd.length > 0) {
          await addProviderModels(editProvider.id, toAdd.map(mid => {
            const c = candidates.find(c => c.modelId === mid);
            return { modelId: mid, name: c?.name || mid };
          }));
        }
        for (const mid of toRemove) {
          const cfgId = existingById.get(mid)!;
          await deleteModel(cfgId);
        }
      } else {
        const models = [...checked].map(mid => {
          const c = candidates.find(c => c.modelId === mid);
          return { modelId: mid, name: c?.name || mid };
        });
        await createProvider({ ...form, models });
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = checked.size;
  const existingCount = candidates.filter(c => c.existing).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-night-900/95 border border-white/15 rounded-card p-6 w-[34rem] space-y-4 max-h-[90vh] overflow-y-auto shadow-card-glow backdrop-blur-xl">
        <h3 className="text-lg font-bold gold-text">{isEdit ? '编辑 API 配置' : '添加 API 配置'}</h3>
        <p className="text-xs text-gray-500">
          一个 API 配置 = 一个地址 + 一个 Key，下面可以挂多个模型。勾选 = 挂载，取消勾选已挂载的模型 = 移除。
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API 名称</label>
          <input
            className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white text-sm"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="如 DeepSeek 官方 / 小米 MiMo"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API 地址</label>
          <input
            className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white text-sm"
            value={form.endpoint}
            onChange={e => { setForm({ ...form, endpoint: e.target.value }); setTestStatus('idle'); setFetched(false); }}
            placeholder="https://api.deepseek.com/v1 或 https://your-domain.com/api/v1"
            required
          />
          {endpointSuggestion && (
            <p className="text-yellow-400 text-xs mt-1">{endpointSuggestion}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API Key</label>
          <input
            className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-white text-sm"
            type="password"
            value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-...（本地服务可留空）"
          />
        </div>

        {/* 测试连接 + 拉取模型 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!form.endpoint || testStatus === 'testing'}
            className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-sm hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {testStatus === 'testing' ? '测试中...' : '🔌 测试连接'}
          </button>
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={!form.endpoint || fetchingModels}
            className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/10 rounded text-sm hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {fetchingModels ? '拉取中...' : '📋 拉取模型'}
          </button>
        </div>

        {/* 测试结果提示 */}
        {testStatus === 'ok' && (
          <div className="text-green-400 text-xs">✓ 连接成功</div>
        )}
        {testStatus === 'fail' && (
          <div className="text-red-400 text-xs">✗ {testError}</div>
        )}

        {/* 模型多选列表（添加/编辑模式都显示） */}
        {candidates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-gray-400">
                模型列表（勾选 {selectedCount}/{candidates.length}）
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChecked(new Set(candidates.map(c => c.modelId)))}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setChecked(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  清空
                </button>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto bg-white/[0.03] border border-white/10 rounded p-2 space-y-1">
                          {candidates.map(c => (
                            <label key={c.modelId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.06] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.has(c.modelId)}
                    onChange={() => toggleModel(c.modelId)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-200 truncate flex-1">{c.name}</span>
                  {c.existing && <span className="text-[10px] text-emerald-400 shrink-0">已挂载</span>}
                </label>
              ))}
            </div>
            {isEdit && existingCount > 0 && selectedCount < existingCount && (
              <p className="text-yellow-400 text-xs mt-1">
                ⚠️ 你取消了 {existingCount - selectedCount} 个已挂载模型的勾选，保存后将移除它们
              </p>
            )}
            {!fetched && (
              <p className="text-xs text-gray-500 mt-1">
                💡 点「拉取模型」可显示该 API 下所有可用模型；已挂载模型始终显示在列表中。
              </p>
            )}
          </div>
        )}

        {candidates.length === 0 && (
          <div className="text-xs text-gray-500">
            💡 点击「拉取模型」自动获取该 API 下所有可用模型并勾选；也可直接保存后到模型列表添加。
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || !form.name.trim() || !form.endpoint}
            className="px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '提交中...' : isEdit ? '保存修改' : `确认添加${selectedCount > 0 ? `（含 ${selectedCount} 个模型）` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
};
