import { useState, useCallback } from 'react';

const BASE = '/api/admin';

export function useAdminAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/models`);
      const data = await res.json();
      return data;
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createModel = useCallback(async (model: { name: string; endpoint: string; apiKey?: string; modelId: string; providerId?: string | null }) => {
    const res = await fetch(`${BASE}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    });
    return res.json();
  }, []);

  const updateModel = useCallback(async (id: string, model: { name: string; endpoint: string; apiKey?: string; modelId: string; providerId?: string | null }) => {
    const res = await fetch(`${BASE}/models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    });
    return res.json();
  }, []);

  const deleteModel = useCallback(async (id: string) => {
    await fetch(`${BASE}/models/${id}`, { method: 'DELETE' });
  }, []);

  const testConnection = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/models/${id}/test`);
      const data = await res.json();
      return data.ok;
    } catch {
      return false;
    }
  }, []);

  const testEndpoint = useCallback(async (endpoint: string, apiKey?: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE}/models/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey }),
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, []);

  const fetchAvailableModels = useCallback(async (endpoint: string, apiKey?: string): Promise<{ ok: boolean; models: Array<{ id: string; name: string }>; error?: string }> => {
    try {
      const res = await fetch(`${BASE}/models/fetch-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey }),
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, models: [], error: e.message };
    }
  }, []);

  // ===== API 提供商（一个 API 挂多个模型） =====

  const fetchProviders = useCallback(async (): Promise<any[]> => {
    try {
      const res = await fetch(`${BASE}/providers`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      setError(e.message);
      return [];
    }
  }, []);

  const createProvider = useCallback(async (provider: {
    name: string; endpoint: string; apiKey?: string;
    models?: Array<{ modelId: string; name?: string }>;
  }) => {
    const res = await fetch(`${BASE}/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider),
    });
    return res.json();
  }, []);

  const updateProvider = useCallback(async (id: string, provider: { name?: string; endpoint?: string; apiKey?: string; enabled?: number }) => {
    const res = await fetch(`${BASE}/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider),
    });
    return res.json();
  }, []);

  const deleteProvider = useCallback(async (id: string) => {
    await fetch(`${BASE}/providers/${id}`, { method: 'DELETE' });
  }, []);

  const addProviderModels = useCallback(async (id: string, models: Array<{ modelId: string; name?: string }>) => {
    const res = await fetch(`${BASE}/providers/${id}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    });
    return res.json();
  }, []);

  return { loading, error, fetchModels, createModel, updateModel, deleteModel, testConnection, testEndpoint, fetchAvailableModels, fetchProviders, createProvider, updateProvider, deleteProvider, addProviderModels };
}
