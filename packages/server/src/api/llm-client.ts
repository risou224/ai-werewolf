import fetch from 'node-fetch';
import type { LLMResponse } from '@ai-werewolf/shared';

export interface LLMClientConfig {
  endpoint: string;
  apiKey: string;
  modelId: string;
  timeout: number;
  maxRetries: number;
}

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    externalSignal?: AbortSignal,
  ): Promise<LLMResponse> {
    const url = `${this.config.endpoint.replace(/\/$/, '')}/chat/completions`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      const timer = setTimeout(() => controller.abort(), this.config.timeout * 1000);
      externalSignal?.addEventListener('abort', onExternalAbort);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.modelId,
            messages,
            response_format: { type: 'json_object' },
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content in response');

        return this.parseResponse(content);
      } catch (err: any) {
        lastError = err;
        if (attempt < this.config.maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    }
    throw lastError || new Error('All retries failed');
  }

  private parseResponse(content: string): LLMResponse {
    try {
      const parsed = JSON.parse(content);
      const pub = parsed.public !== undefined ? parsed.public : parsed.public_;
      return {
        thinking: parsed.thinking ?? null,
        internal: parsed.internal ?? null,
        public_: pub ?? null,
      };
    } catch {
      return { thinking: null, internal: null, public_: content };
    }
  }
}
