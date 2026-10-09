import { createOpenAI } from '@ai-sdk/openai';
import 'dotenv/config';

const baseURL = process.env.API_BASE_URL || 'https://api.groq.com/openai/v1';
const apiKey = process.env.API_KEY || process.env.GROQ_API_KEY || '';

export const llmProvider = createOpenAI({
  baseURL,
  apiKey,
});

let resolvedModel = process.env.MODEL_NAME || '';

if (!resolvedModel) {
  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const modelList: string[] = (data.data || []).map((m: any) => m.id);

      // Filter out safeguard, audio, and specialized non-LLM models
      const textModels = modelList.filter(
        (m) =>
          !m.includes('safeguard') &&
          !m.includes('whisper') &&
          !m.includes('orpheus') &&
          !m.includes('prompt-guard')
      );

      console.log('🤖 [LLM Config] Available Text Models:', textModels);

      // Prioritize primary chat models: gpt-oss-120b -> gpt-oss-20b -> qwen -> first text model
      resolvedModel =
        textModels.find((m) => m === 'openai/gpt-oss-120b') ||
        textModels.find((m) => m === 'openai/gpt-oss-20b') ||
        textModels.find((m) => m.includes('qwen')) ||
        textModels[0] ||
        'openai/gpt-oss-120b';
    }
  } catch (err: any) {
    console.warn('⚠️ Could not fetch models list dynamically:', err.message);
  }
}

export const modelName = resolvedModel || 'openai/gpt-oss-120b';
console.log(`🤖 [LLM Config] Using active model: "${modelName}"`);
