
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  onClose: () => void;
  onSend: (msg: string) => void;
}

const ChatWindow: React.FC<Props> = ({ isOpen, messages, isLoading, onClose, onSend }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 right-6 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-[60] h-96 animate-in fade-in slide-in-from-bottom-4 duration-200 origin-bottom-right">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center rounded-t-xl shrink-0">
            <h3 className="font-bold text-gray-700 text-sm flex items-center">
                <Bot size={18} className="mr-2 text-blue-500" />
                AI 助教追问
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm custom-scrollbar bg-white">
            <div className="text-center text-gray-400 text-xs my-2">基于当前题目的上下文对话</div>
            
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user' 
                            ? 'bg-blue-50 text-blue-900 rounded-tr-none' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}>
                        {msg.role === 'user' ? msg.content : <MarkdownRenderer content={msg.content} />}
                        {msg.reasoning && (
                            <div className="mt-2 text-xs text-gray-500 border-l-2 border-gray-300 pl-2 font-mono bg-gray-50 p-1 rounded">
                                {msg.reasoning}
                            </div>
                        )}
                    </div>
                </div>
            ))}
            
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 flex items-center">
                         <Loader2 size={16} className="animate-spin text-gray-400" />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors" 
                    placeholder="输入问题..." 
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || isLoading}
                    className="bg-[#615ced] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#4f4bc6] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all transform active:scale-95"
                >
                    <Send size={14} />
                </button>
            </div>
        </form>
    </div>
  );
};

export default ChatWindow;
