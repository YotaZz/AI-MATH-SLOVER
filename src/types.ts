
export type ModelFamily = 'qwen' | 'gemini' | 'glm' | 'qwen3_8b';

export interface AppConfig {
  apiKeyDashScope: string;
  apiKeyGoogle: string;
  apiKeyDMX: string; // New DMXAPI Key
  modelVision: string;
  modelFamily: ModelFamily;
  secretKey?: string;
}

export interface HistoryItem {
  id: number;
  time: string;
  img: string; // base64
  prob: string;
  sol: string;
  chat: ChatMessage[];
  model: string;
  verification?: VerificationResult; // Store verification result in history
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

export interface VerificationResult {
  status: 'idle' | 'verifying' | 'success' | 'error';
  content: string; // The full text response (reasoning + result)
  isCorrect?: boolean; // Parsed result
  summary?: string; // Short summary
  modelUsed?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  apiKeyDashScope: "",
  apiKeyGoogle: "",
  apiKeyDMX: "",
  modelVision: "qwen3-vl-plus",
  modelFamily: "qwen",
  secretKey: ""
};

export const MODEL_MAPPINGS = {
  qwen: {
    fast: 'qwen3-max',
    thinking: 'qwen3-max-preview'
  },
  gemini: {
    fast: 'gemini-2.5-pro',
    thinking: 'gemini-2.5-pro'
  },
  glm: {
    fast: 'glm-4.5-flash',
    thinking: 'glm-4.5-flash' // GLM usually handles complex tasks well, mapped same for now
  },
  qwen3_8b: {
    fast: 'qwen3-8b',
    thinking: 'qwen3-8b' // Will use enable_thinking param in API
  }
};