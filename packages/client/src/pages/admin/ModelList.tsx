import React, { useEffect, useState } from 'react';
import { useAdminAPI } from '../../hooks/useAdminAPI.js';
import { ModelForm } from './ModelForm.js';
import { ProviderForm } from './ProviderForm.js';

interface ModelItem {
  id: string; name: string; endpoint: string; model_id: string; api_key?: string;
  provider_id?: string | null; enabled: number;
}

interface ProviderItem {
  id: string; name: string; endpoint: string; api_key?: string; enabled: number;
  models: ModelItem[];
}

export const ModelList: React.FC = () => {
  const { fetchModels, fetchProviders, deleteModel, deleteProvider, testEndpoint } = useAdminAPI();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);
  const [modelFormProvider, setModelFormProvider] = useState<ProviderItem | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail'>>({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [p, m] = await Promise.all([fetchProviders(), fetchModels()]);
    setProviders(p);
    setModels(m);
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('确定删除该模型配置？')) return;
    await deleteModel(id);
    loadAll();
  };

  const handleDeleteProvider = async (p: ProviderItem) => {
    if (!confirm(`确定删除 API 配置「${p.name}」及其下 ${p.models.length} 个模型？`)) return;
    await deleteProvider(p.id);
    loadAll();
  };

  const handleTest = async (endpoint: string, apiKey: string | undefined, id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: undefined as any }));
    const result = await testEndpoint(endpoint, apiKey);
    setTestingId(null);
    setTestResults(prev => ({ ...prev, [id]: result.ok ? 'ok' : 'fail' }));
  };

  const toggleExpand = (id: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 独立模型（老逻辑：provider_id 为空的模型配置）
  const standaloneModels = models.filter(m => !m.provider_id);

  const renderModelRow = (model: ModelItem, showProviderHint: boolean) => (
    <div key={model.id} className="bg-white/[0.04] rounded-lg p-3 flex items-center justify-between border border-white/10">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-200 text-sm">{model.name}</span>
          {testResults[model.id] === 'ok' && <span className="text-emerald-400 text-xs">✓ 连通</span>}
          {testResults[model.id] === 'fail' && <span className="text-red-400 text-xs">✗ 不通</span>}
        </div>
        <div className="text-gray-500 text-xs mt-0.5 truncate">
          <span className="text-gray-400">{model.model_id}</span>
          {showProviderHint && model.provider_id && (
            <span className="text-gray-600"> · 挂在 {providers.find(p => p.id === model.provider_id)?.name || 'API'} 下</span>
          )}
          {!showProviderHint && <span> — {model.endpoint}</span>}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => handleTest(model.endpoint, (model as any).api_key || '', model.id)}
          disabled={testingId === model.id}
          className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
        >
          {testingId === model.id ? '测试中...' : '测试'}
        </button>
        <button
          onClick={() => { setEditingModel(model); setShowModelForm(true); }}
          className="text-yellow-400 hover:text-yellow-300 text-sm"
        >
          编辑
        </button>
        <button onClick={() => handleDeleteModel(model.id)} className="text-red-400 hover:text-red-300 text-sm">
          删除
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold gold-text">模型管理</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingProvider(null); setShowProviderForm(true); }}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors text-sm font-medium"
          >
            + 添加 API 配置
          </button>
          <button
            onClick={() => { setEditingModel(null); setModelFormProvider(null); setShowModelForm(true); }}
            className="px-4 py-2 bg-amber-600 rounded-lg hover:bg-amber-500 transition-colors text-sm font-medium"
          >
            + 添加独立模型
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-6">
        💡 一个 API 配置（地址 + Key）可挂多个模型，配一次全都能用；独立模型是老式用法，每个模型单独填地址和 Key。
      </p>

      {/* API 提供商列表 */}
      {providers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-400 mb-3">API 配置</h3>
          <div className="space-y-2">
            {providers.map(provider => (
              <div key={provider.id} className="glass-card rounded-card overflow-hidden">
                {/* 卡片头部 */}
                <div className="p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(provider.id)}
                        className={`text-gray-400 hover:text-gray-200 transition-transform ${expandedProviders.has(provider.id) ? 'rotate-90' : ''}`}
                      >
                        ▶
                      </button>
                      <span className="font-bold text-gray-200">{provider.name}</span>
                      <span className="text-xs text-gray-500 bg-white/[0.06] rounded-full px-2 py-0.5 border border-white/10">
                        {provider.models.length} 个模型
                      </span>
                      {testResults[`p_${provider.id}`] === 'ok' && <span className="text-emerald-400 text-xs">✓ 连通</span>}
                      {testResults[`p_${provider.id}`] === 'fail' && <span className="text-red-400 text-xs">✗ 不通</span>}
                    </div>
                    <div className="text-gray-500 text-xs mt-1 truncate">{provider.endpoint}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleTest(provider.endpoint, provider.api_key, `p_${provider.id}`)}
                      disabled={testingId === `p_${provider.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
                    >
                      {testingId === `p_${provider.id}` ? '测试中...' : '测试'}
                    </button>
                    <button
                      onClick={() => { setEditingProvider(provider); setShowProviderForm(true); }}
                      className="text-yellow-400 hover:text-yellow-300 text-sm"
                    >
                      编辑
                    </button>
                    <button onClick={() => handleDeleteProvider(provider)} className="text-red-400 hover:text-red-300 text-sm">
                      删除
                    </button>
                  </div>
                </div>

                {/* 展开后的模型列表 */}
                {expandedProviders.has(provider.id) && (
                  <div className="px-4 pb-4 border-t border-white/10 pt-3">
                    <div className="space-y-2 mb-3">
                      {provider.models.length === 0 && (
                        <div className="text-gray-600 text-sm py-2">该 API 下还没有模型</div>
                      )}
                      {provider.models.map(model => renderModelRow(model, true))}
                    </div>
                    <button
                      onClick={() => { setEditingModel(null); setModelFormProvider(provider); setShowModelForm(true); }}
                      className="text-sm px-3 py-1.5 bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/40 transition-colors"
                    >
                      + 添加模型到该 API
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 独立模型（老功能保留） */}
      {standaloneModels.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-400 mb-3">独立模型</h3>
          <div className="space-y-2">
            {standaloneModels.map(model => renderModelRow(model, false))}
          </div>
        </div>
      )}

      {providers.length === 0 && standaloneModels.length === 0 && (
        <div className="text-gray-600 text-center py-12">
          暂无配置。
          <br />
          推荐点击「添加 API 配置」：填一次地址和 Key，勾选多个模型一次搞定。
        </div>
      )}

      {/* 弹窗 */}
      {showProviderForm && (
        <ProviderForm
          onClose={() => setShowProviderForm(false)}
          onSuccess={() => { setShowProviderForm(false); loadAll(); }}
          editProvider={editingProvider ? {
            id: editingProvider.id,
            name: editingProvider.name,
            endpoint: editingProvider.endpoint,
            apiKey: editingProvider.api_key || '',
            models: (editingProvider.models || []).map(m => ({
              id: m.id,
              name: m.name,
              model_id: m.model_id,
            })),
          } : undefined}
        />
      )}
      {showModelForm && (
        <ModelForm
          onClose={() => setShowModelForm(false)}
          onSuccess={() => { setShowModelForm(false); loadAll(); }}
          editModel={editingModel ? {
            id: editingModel.id,
            name: editingModel.name,
            endpoint: editingModel.endpoint,
            apiKey: (editingModel as any).api_key || '',
            modelId: editingModel.model_id,
            providerId: editingModel.provider_id ?? null,
          } : undefined}
          provider={modelFormProvider ? {
            id: modelFormProvider.id,
            name: modelFormProvider.name,
            endpoint: modelFormProvider.endpoint,
            apiKey: modelFormProvider.api_key || '',
          } : null}
        />
      )}
    </div>
  );
};
