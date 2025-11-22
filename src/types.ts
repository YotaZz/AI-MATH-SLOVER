
export type ModelFamily = 'qwen' | 'gemini';

export interface AppConfig {
  apiKeyDashScope: string;
  apiKeyGoogle: string;
  apiKeyDMX: string; // New DMXAPI Key
  modelVision: string;
  modelFamily: ModelFamily;
}

export interface HistoryItem {
  id: number;
  time: string;
  img: string; // base64
  prob: string;
  sol: string;
  chat: ChatMessage[];
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
  reasoning?: string; // For deep thinking models
}

export interface StreamResponse {
  content: string;
  reasoning: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  apiKeyDashScope: "",
  apiKeyGoogle: "",
  apiKeyDMX: "",
  modelVision: "qwen3-vl-plus",
  modelFamily: "qwen"
};

export const MODEL_MAPPINGS = {
  qwen: {
    fast: 'qwen3-max',
    thinking: 'qwen3-max-preview' // or deepseek-r1 distills depending on provider
  },
  gemini: {
    fast: 'gemini-2.5-flash',
    thinking: 'gemini-2.5-pro'
  }
};
