import type { AIConfig, AIProviderResult } from './ai-types';

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `Proveedor IA HTTP ${response.status}`);
  return data;
}

function extractOpenAIText(data: any) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output || []) for (const part of item?.content || []) if (typeof part?.text === 'string') chunks.push(part.text);
  return chunks.join('\n').trim();
}

export async function callAIProvider(config: AIConfig, apiKey: string, prompt: string, override: {
  model?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
} = {}): Promise<AIProviderResult> {
  const model = String(override.model || config.model || '').trim();
  const system = String(override.systemPrompt ?? config.system_prompt ?? '').trim();
  const maxOutputTokens = Math.max(32, Math.min(131072, Number(override.maxOutputTokens || config.max_output_tokens || 350)));
  if (!model) throw new Error('No hay modelo IA configurado.');
  if (!apiKey) throw new Error('No hay API Key configurada.');

  if (config.provider === 'openai') {
    const input: any[] = [];
    if (system) input.push({ role: 'system', content: system });
    input.push({ role: 'user', content: prompt });
    const data = await fetchJson('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input, max_output_tokens: maxOutputTokens }),
    });
    return {
      text: extractOpenAIText(data),
      inputTokens: Number(data?.usage?.input_tokens || 0),
      outputTokens: Number(data?.usage?.output_tokens || 0),
      requestId: data?.id || undefined,
    };
  }

  if (config.provider === 'anthropic') {
    const body: any = { model, max_tokens: maxOutputTokens, messages: [{ role: 'user', content: prompt }] };
    if (system) body.system = system;
    const data = await fetchJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      text: (data?.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text || '').join('\n').trim(),
      inputTokens: Number(data?.usage?.input_tokens || 0),
      outputTokens: Number(data?.usage?.output_tokens || 0),
      requestId: data?.id || undefined,
    };
  }

  if (config.provider === 'gemini') {
    const body: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const data = await fetchJson(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      text: (data?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('\n').trim(),
      inputTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
      outputTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
    };
  }

  if (config.provider === 'compatible') {
    if (!config.compatible_endpoint) throw new Error('Falta compatible_endpoint.');
    const messages: any[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const data = await fetchJson(config.compatible_endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxOutputTokens }),
    });
    return {
      text: String(data?.choices?.[0]?.message?.content || '').trim(),
      inputTokens: Number(data?.usage?.prompt_tokens || 0),
      outputTokens: Number(data?.usage?.completion_tokens || 0),
      requestId: data?.id || undefined,
    };
  }

  throw new Error('Proveedor IA no soportado.');
}
