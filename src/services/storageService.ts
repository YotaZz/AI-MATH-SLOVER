
import { DEFAULT_CONFIG, type AppConfig, type HistoryItem } from "../types";

const CONFIG_KEY = 'ai_math_config_v2';
const HISTORY_KEY = 'ai_math_history_v2';
const MAX_HISTORY = 20;

export const loadConfig = (): AppConfig => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {}
  return DEFAULT_CONFIG;
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const loadHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) { return []; }
};

export const saveHistoryItem = (item: HistoryItem) => {
  try {
    const list = loadHistory();
    list.unshift(item);
    if (list.length > MAX_HISTORY) list.splice(MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch(e) {}
};

export const clearHistory = () => localStorage.removeItem(HISTORY_KEY);

export const updateLatestHistoryChat = (chat: any[]) => {
    try {
        const list = loadHistory();
        if (list.length > 0) {
            list[0].chat = chat;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        }
    } catch(e) {}
};
