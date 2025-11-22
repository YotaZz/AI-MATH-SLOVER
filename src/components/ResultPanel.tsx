
import React, { useState, useEffect, useRef } from 'react';
import { Brain, PenLine, Check, Edit3, StopCircle, MessageSquare } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export type PanelState = 'empty' | 'thinking' | 'verify' | 'result';

interface Props {
  state: PanelState;
  loadingStep?: string;
  loadingDesc?: string;
  problemText: string;
  solutionText: string;
  reasoningText: string;
  isGenerating: boolean; // Replaced isThinkingUpdate to strictly control cursor
  modelName?: string;
  onProblemChange: (text: string) => void;
  onConfirmProblem: () => void;
  onCancelVerify: () => void;
  onEditRequest: () => void;
  onStopGeneration: () => void;
  onChatToggle: () => void;
  isChatOpen: boolean;
}

const ResultPanel: React.FC<Props> = ({
  state, loadingStep, loadingDesc, problemText, solutionText, reasoningText, 
  isGenerating, modelName, onProblemChange, onConfirmProblem, onCancelVerify, onEditRequest, onStopGeneration,
  onChatToggle, isChatOpen
}) => {
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  if (state === 'thinking') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#615ced] rounded-full animate-spin mb-4"></div>
        <h3 className="text-[#615ced] font-bold mb-1">{loadingStep || '处理中...'}</h3>
        <p className="text-gray-400 text-xs">{loadingDesc}</p>
        <button onClick={onStopGeneration} className="mt-6 bg-red-500 text-white px-4 py-2 rounded-full shadow hover:bg-red-600 flex items-center gap-2 text-sm transition-all">
            <StopCircle size={16} /> 停止生成
        </button>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 select-none">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Brain size={32} className="text-gray-300" />
        </div>
        <p>等待输入</p>
        <p className="text-xs mt-2 text-gray-300">在左侧书写 → 点击识别求解</p>
      </div>
    );
  }

  if (state === 'verify') {
    return (
      <div className="p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-bold text-gray-800 flex items-center">
            <Edit3 size={16} className="text-blue-500 mr-2" /> 修改识别结果
          </h3>
        </div>
        <div className="flex-1 flex flex-col gap-4 min-h-0 mb-4">
          <div className="flex flex-col gap-1 h-1/3 min-h-[120px]">
            <label className="text-xs font-bold text-gray-400 uppercase">LaTeX 源码</label>
            <textarea
              className="flex-1 w-full border border-gray-300 rounded-lg p-3 font-mono text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50"
              value={problemText}
              onChange={(e) => onProblemChange(e.target.value)}
              placeholder="在此修改识别内容..."
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-h-0">
            <label className="text-xs font-bold text-gray-400 uppercase">预览</label>
            <div className="flex-1 border border-gray-200 rounded-lg p-4 bg-white overflow-y-auto shadow-sm">
              <MarkdownRenderer content={problemText} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={onCancelVerify} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">取消</button>
          <button onClick={onConfirmProblem} className="flex-1 bg-[#615ced] hover:bg-[#4f4bc6] text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center justify-center gap-2">
            <Check size={16} /> 确认并求解
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2 overflow-hidden mr-2 flex-1 min-w-0">
          <div className="truncate text-sm text-gray-700 font-mono" title={problemText}>
             {problemText.length > 50 ? problemText.substring(0, 50) + '...' : problemText}
          </div>
        </div>
        <button onClick={onEditRequest} className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1">
          <PenLine size={12} /> 修改
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-32 custom-scrollbar">
        {reasoningText && (
           <details className="mb-4 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-sm group" open={isGenerating}>
             <summary className="px-4 py-2 bg-gray-100 cursor-pointer font-semibold text-gray-600 select-none flex items-center hover:bg-gray-200 transition">
               <Brain size={14} className="mr-2 text-blue-500" /> 深度思考过程
             </summary>
             <div className={`p-4 text-gray-600 font-mono whitespace-pre-wrap bg-white border-t border-gray-200 ${isGenerating ? 'typing-cursor' : ''}`}>
               {reasoningText}
             </div>
           </details>
        )}
        
        <div className={`${isGenerating && !reasoningText ? 'typing-cursor' : ''}`}>
           {/* When reasoning is active, main content isn't typing. When reasoning done (or none), main content types. */}
           {/* Actually simplified: just let markdown renderer handle static content, cursor is appended to container if streaming main content */}
           <div className={isGenerating && solutionText ? 'typing-cursor' : ''}>
              <MarkdownRenderer content={solutionText} />
           </div>
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Model Badge Floating */}
      {modelName && (
        <div className="absolute bottom-6 left-6 z-20 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-md border border-gray-200 text-xs text-gray-500 font-mono pointer-events-none">
          {modelName}
        </div>
      )}

      {/* Chat Toggle Button (Bottom Right of Result Panel) */}
      <button 
          onClick={onChatToggle}
          className={`absolute bottom-6 right-6 z-30 bg-[#615ced] text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-[#4f4bc6] transition-all transform hover:scale-105 ${isChatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
          title="追问 AI"
      >
          <MessageSquare size={20} />
      </button>

    </div>
  );
};

export default ResultPanel;
