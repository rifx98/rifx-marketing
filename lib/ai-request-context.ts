import { AsyncLocalStorage } from 'node:async_hooks';

export interface AiRequestContext {
  openaiKey?: string;
  falKey?: string;
  groqKey?: string;
  visualProvider?: 'openai' | 'flux' | 'sharp';
}

const requestContext = new AsyncLocalStorage<Readonly<AiRequestContext>>();

export function runWithAiRequestContext<T>(
  context: AiRequestContext,
  operation: () => Promise<T>,
): Promise<T> {
  return requestContext.run(Object.freeze({ ...context }), operation);
}

export function getAiCredential(provider: 'openai' | 'fal' | 'groq'): string | undefined {
  const context = requestContext.getStore();
  if (provider === 'openai') return context?.openaiKey || process.env.OPENAI_API_KEY;
  if (provider === 'fal') return context?.falKey || process.env.FAL_KEY;
  return context?.groqKey || process.env.GROQ_API_KEY;
}

export function getRequestVisualProvider(): AiRequestContext['visualProvider'] {
  return requestContext.getStore()?.visualProvider;
}
