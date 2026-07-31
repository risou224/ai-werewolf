import React, { useState } from 'react';
import { useAdminAPI } from '../../hooks/useAdminAPI.js';

interface ModelFormData {
  name: string;
  endpoint: string;
  apiKey?: string;
  modelId: string;
  providerId?: string | null;
}

interface ModelFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editModel?: { id: string } & ModelFormData;
  /** 传入时强制归入该 provider（添加模式下隐藏 endpoint/apiKey，继承自 provider） */
  provider?: { id: string; name: string; endpoint: string; apiKey?: string } | null;
}

interface ProviderPreset {
  name: string;
  endpoint: string;
  models: Array<{ label: string; modelId: string }>;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    models: [
      { label: 'DeepSeek-V4 (deepseek-chat)', modelId: 'deepseek-chat' },
      { label: 'DeepSeek-V4-0324 (deepseek-chat-0324)', modelId: 'deepseek-chat-0324' },
      { label: 'DeepSeek-V4-Reasoner (deepseek-reasoner)', modelId: 'deepseek-reasoner' },
    ],
  },
  {
    name: 'MiMo (小米)',
    endpoint: 'https://api.xiaomimimo.com/v1',
    models: [
      { label: 'MiMo-2.5 (mimo-2.5)', modelId: 'mimo-2.5' },
      { label: 'MiMo-2.5-Pro (mimo-2.5-pro)', modelId: 'mimo-2.5-pro' },
      { label: 'MiMo-2.5-Flash (mimo-2.5-flash)', modelId: 'mimo-2.5-flash' },
    ],
  },
  {
    name: '自定义',
    endpoint: '',
    models: [],
  },
];

export const ModelForm: React.FC<ModelFormProps> = ({ onClose, onSuccess, editModel, provider }) => {
  const { createModel, updateModel, testEndpoint, fetchAvailableModels } = useAdminAPI();
  // provider 模式下 endpoint/apiKey 继承自 provider，不在表单里编辑
  const inProvider = !!provider;
  const [form, setForm] = useState<ModelFormData>({
    name: editModel?.name || '',
    endpoint: inProvider ? (provider?.endpoint || '') : (editModel?.endpoint || ''),
    apiKey: inProvider ? (provider?.apiKey || '') : (editModel?.apiKey || ''),
    modelId: editModel?.modelId || '',
    providerId: editModel?.providerId ?? (provider?.id ?? null),
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // 测试连接状态
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [endpointSuggestion, setEndpointSuggestion] = useState('');

  // 拉取模型状态
  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; name: string }>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    setTestStatus('idle');
    setTestError('');
    setFetchedModels([]);
    const preset = PROVIDER_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setForm(prev => ({
        ...prev,
        endpoint: preset.endpoint,
        modelId: '',
        name: '',
      }));
    }
  };

  const handleModelSelect = (modelId: string) => {
    const preset = PROVIDER_PRESETS.find(p => p.name === selectedPreset);
    const model = preset?.models.find(m => m.modelId === modelId);
    const fetchedModel = fetchedModels.find(m => m.id === modelId);
    const label = model?.label || fetchedModel?.name || modelId;
    setForm(prev => ({
      ...prev,
      modelId,
      name: prev.name || label.split(' (')[0],
    }));
  };

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
      setFetchedModels(result.models);
      setTestStatus('ok');
    } else {
      setTestStatus('fail');
      setTestError(result.error || '未获取到模型');
      const base = form.endpoint.replace(/\/$/, '');
      if (/404/.test(result.error || '')) {
        setEndpointSuggestion(`可能是路径不正确，试试在末尾补全路径，如 ${base}/v1`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, providerId: form.providerId ?? null };
      if (editModel) {
        await updateModel(editModel.id, payload);
      } else {
        await createModel(payload);
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  // 合并预设模型 + 拉取到的模型（去重）
  const preset = PROVIDER_PRESETS.find(p => p.name === selectedPreset);
  const presetModels = preset?.models || [];
  const allModels = [
    ...presetModels.map(m => ({ id: m.modelId, name: m.label })),
    ...fetchedModels.filter(m => !presetModels.some(p => p.modelId === m.id)),
  ];

  const isEdit = !!editModel;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 w-[28rem] space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold">{isEdit ? '编辑模型' : '添加模型'}</h3>

        {/* 供应商预设（仅添加模式显示） */}
        {!isEdit && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">快速选择供应商</label>
            <div className="flex gap-2 flex-wrap">
              {PROVIDER_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetChange(preset.name)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedPreset === preset.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">模型名称</label>
          <input
            className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="如 DeepSeek-V4"
            required
          />
        </div>

        {inProvider ? (
          <div className="text-xs text-gray-500 bg-gray-900/60 rounded p-2">
            该模型挂在 <span className="text-blue-400">{provider?.name}</span> 下，
            使用其 API 地址和 Key：<span className="text-gray-400 break-all">{provider?.endpoint}</span>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API 地址</label>
              <input
                className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
                value={form.endpoint}
                onChange={e => { setForm({ ...form, endpoint: e.target.value }); setTestStatus('idle'); setFetchedModels([]); }}
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
                className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
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
                className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {testStatus === 'testing' ? '测试中...' : '🔌 测试连接'}
              </button>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={!form.endpoint || fetchingModels}
                className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
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
          </>
        )}

        {/* 模型选择：有模型列表时用下拉，否则用输入框 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">模型标识符</label>
          {allModels.length > 0 ? (
            <select
              className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
              value={form.modelId}
              onChange={e => handleModelSelect(e.target.value)}
            >
              <option value="">-- 选择模型 --</option>
              {allModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__manual__">手动输入...</option>
            </select>
          ) : (
            <input
              className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm"
              value={form.modelId}
              onChange={e => setForm({ ...form, modelId: e.target.value })}
              placeholder="deepseek-chat"
              required
            />
          )}
          {form.modelId === '__manual__' && (
            <input
              className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm mt-2"
              value=""
              onChange={e => setForm({ ...form, modelId: e.target.value })}
              placeholder="输入模型标识符"
              autoFocus
              required
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || !form.modelId || form.modelId === '__manual__'}
            className="px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '提交中...' : isEdit ? '保存修改' : '确认添加'}
          </button>
        </div>
      </form>
    </div>
  );
};
