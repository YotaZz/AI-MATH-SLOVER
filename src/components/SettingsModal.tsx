
import React, { useState, useEffect } from 'react';
import { X, KeyRound, ChevronRight, ChevronDown } from 'lucide-react';
import { MODEL_MAPPINGS, type AppConfig } from '../types';

interface Props {
  config: AppConfig;
  onSave: (cfg: AppConfig) => void;
  onClose: () => void;
}

// Encryption constants provided by user
const ENCRYPTED_KEYS = {
  Dashscope: '435f1f0601515655025153515302530002560b0c05570b020401535705050a55560d02',
  Google: '717d4855634d705c755e5d7e69646476627743727c73045b5b6261727542484c7145545c6a0306',
  DMXAPI: '435f1f5c09775e627457020c7d5c5c45777c4a7b457563730206547305477c437c7a48525d645c457f5e016d716d62475a4102'
};

// XOR Decryption helper
const xorDecrypt = (cipherHex: string, key: string): string => {
  try {
    // Convert hex string to byte array
    const data = new Uint8Array(cipherHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const keyBytes = new TextEncoder().encode(key);
    const out = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(out);
  } catch (e) {
    console.error("Decryption failed:", e);
    return "";
  }
};

const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [secretKey, setSecretKey] = useState("");
  const [showApiKeys, setShowApiKeys] = useState(false);

  useEffect(() => { setLocalConfig(config); }, [config]);

  const handleSave = () => {
    let finalConfig = { ...localConfig };

    // Auto-calculate keys if secret key is provided
    if (secretKey.trim()) {
        const inputKey = secretKey.trim();
        finalConfig.apiKeyDashScope = xorDecrypt(ENCRYPTED_KEYS.Dashscope, inputKey);
        finalConfig.apiKeyGoogle = xorDecrypt(ENCRYPTED_KEYS.Google, inputKey);
        finalConfig.apiKeyDMX = xorDecrypt(ENCRYPTED_KEYS.DMXAPI, inputKey);
    }

    if (!finalConfig.apiKeyDashScope && !finalConfig.apiKeyGoogle && !finalConfig.apiKeyDMX) {
        alert("请至少输入一个 API Key 或有效的快捷密钥");
        return;
    }
    onSave(finalConfig);
  };

  const currentMapping = MODEL_MAPPINGS[localConfig.modelFamily];

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* 密钥快捷填充区域 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
            <label className="block text-xs font-bold text-blue-600 mb-2 uppercase flex items-center gap-1">
              <KeyRound size={14} /> 快捷密钥 (可选)
            </label>
            <div className="relative">
                <input 
                  type="password"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  placeholder="输入密钥，保存时自动计算填充..."
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                />
                <div className="absolute right-3 top-2.5 text-xs text-blue-400 select-none pointer-events-none">
                   保存自动应用
                </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Collapsible API Keys Section */}
          <div>
            <button 
                onClick={() => setShowApiKeys(!showApiKeys)}
                className="flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors w-full select-none"
            >
                {showApiKeys ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                API Keys 配置 (手动)
            </button>
            
            {showApiKeys && (
                <div className="mt-3 space-y-3 pl-1 animate-in slide-in-from-top-2 duration-200">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">DashScope API Key (Qwen)</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                            placeholder="sk-..."
                            value={localConfig.apiKeyDashScope}
                            onChange={e => setLocalConfig({...localConfig, apiKeyDashScope: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Google API Key (Gemini)</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                            placeholder="AIza..."
                            value={localConfig.apiKeyGoogle}
                            onChange={e => setLocalConfig({...localConfig, apiKeyGoogle: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">DMXAPI Key (DeepSeek)</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                            placeholder="sk-..."
                            value={localConfig.apiKeyDMX || ""}
                            onChange={e => setLocalConfig({...localConfig, apiKeyDMX: e.target.value})}
                        />
                    </div>
                </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">模型配置</h4>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">视觉模型 (Vision)</label>
                <select 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={localConfig.modelVision}
                    onChange={e => setLocalConfig({...localConfig, modelVision: e.target.value})}
                >
                    <option value="qwen3-vl-plus">qwen3-vl-plus (DashScope)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Google)</option>
                    <option value="DeepSeek-OCR-Free">DeepSeek-OCR-Free (DMX)</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">推理模型系列 (Solver Family)</label>
                <select 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-2"
                    value={localConfig.modelFamily}
                    onChange={e => setLocalConfig({...localConfig, modelFamily: e.target.value as any})}
                >
                    <option value="qwen">Qwen 系列</option>
                    <option value="gemini">Gemini 系列</option>
                </select>
                
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 font-mono border border-gray-100 space-y-1">
                    <div className="flex justify-between"><span>快速模式:</span><span className="font-bold text-gray-700">{currentMapping.fast}</span></div>
                    <div className="flex justify-between"><span>深度思考:</span><span className="font-bold text-gray-700">{currentMapping.thinking}</span></div>
                </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button onClick={handleSave} className="bg-[#615ced] hover:bg-[#4f4bc6] text-white font-semibold py-2 px-6 rounded-lg transition shadow-md">保存配置</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
