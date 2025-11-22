
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Wand2, X } from 'lucide-react';
import Header from './components/Header';
import CanvasBoard from './components/CanvasBoard';
import type { CanvasHandle } from './components/CanvasBoard';
import ResultPanel from './components/ResultPanel';
import type { PanelState } from './components/ResultPanel';
import SettingsModal from './components/SettingsModal';
import HistoryDrawer from './components/HistoryDrawer';
import ChatWindow from './components/ChatWindow';
import { DEFAULT_CONFIG } from './types';
import type { AppConfig, HistoryItem, ChatMessage } from './types';
import { loadConfig, saveConfig, loadHistory, saveHistoryItem, clearHistory, updateLatestHistoryChat } from './services/storageService';
import { apiVisionParse, apiSolveProblem, apiChat, getSolverModel } from './services/apiService';

const App: React.FC = () => {
  // State
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Process State
  const [panelState, setPanelState] = useState<PanelState>('empty');
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingDesc, setLoadingDesc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Content Data
  const [problemText, setProblemText] = useState("");
  const [additionalText, setAdditionalText] = useState(""); // New state for manual input
  const [solutionText, setSolutionText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeModel, setActiveModel] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false); // State for input expansion

  // Refs
  const canvasRef = useRef<CanvasHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialization
  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    if (!cfg.apiKeyDashScope && !cfg.apiKeyGoogle) {
      setIsSettingsOpen(true);
    }
    setHistoryItems(loadHistory());
  }, []);

  // Determine current models for display
  const currentSolverModel = getSolverModel(config, isThinkingEnabled);

  // Actions
  const togglePanel = () => setIsPanelCollapsed(!isPanelCollapsed);

  const handleSettingsSave = (newConfig: AppConfig) => {
    saveConfig(newConfig);
    setConfig(newConfig);
    setIsSettingsOpen(false);
  };

  const abortCurrent = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    if (panelState === 'thinking') setPanelState('empty');
  };

  const handleSolve = async () => {
    abortCurrent();
    
    if (!config.apiKeyDashScope && !config.apiKeyGoogle) {
        alert("缺少 API Key，请检查设置。");
        setIsSettingsOpen(true);
        return;
    }

    const b64 = canvasRef.current?.getImageData();
    if (!b64) return alert("画板为空");

    if (isPanelCollapsed) setIsPanelCollapsed(false);
    
    setPanelState('thinking');
    setLoadingStep("正在识别图片");
    setLoadingDesc(config.modelVision);
    setProblemText("");
    setSolutionText("");
    setReasoningText("");
    setChatHistory([]);
    setActiveModel("");
    setIsGenerating(true);

    try {
        // 1. Vision
        const extractedText = await apiVisionParse(b64, config);
        
        // Combine vision result with manual input
        const combinedText = additionalText.trim() 
            ? `${extractedText}\n\n${additionalText}` 
            : extractedText;

        setProblemText(combinedText);
        
        // 2. Solving
        setLoadingStep("正在求解");
        setLoadingDesc(currentSolverModel);
        
        // Switch to result view to show streaming
        setPanelState('result');
        setActiveModel(currentSolverModel);
        
        abortControllerRef.current = new AbortController();
        
        const solverResponse = await apiSolveProblem(
            combinedText, 
            config, 
            isThinkingEnabled, 
            (content, reasoning, isReas) => {
                setSolutionText(content);
                setReasoningText(reasoning);
            },
            abortControllerRef.current.signal
        );

        abortControllerRef.current = null;
        setIsGenerating(false);
        
        // Save History
        const newItem: HistoryItem = {
            id: Date.now(),
            time: new Date().toLocaleString(),
            img: b64,
            prob: combinedText,
            sol: solverResponse.content,
            chat: [],
            model: currentSolverModel
        };
        saveHistoryItem(newItem);
        setHistoryItems(loadHistory());

    } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error(e);
        setIsGenerating(false);
        setPanelState('empty'); 
        alert(`错误: ${e.message}`);
    }
  };

  const handleConfirmVerify = async () => {
      abortCurrent();
      setPanelState('result');
      setSolutionText("");
      setReasoningText("");
      setChatHistory([]);
      setActiveModel(currentSolverModel);
      setIsGenerating(true);
      
      abortControllerRef.current = new AbortController();
      try {
          const solverResponse = await apiSolveProblem(
              problemText,
              config,
              isThinkingEnabled,
              (content, reasoning, isReas) => {
                  setSolutionText(content);
                  setReasoningText(reasoning);
              },
              abortControllerRef.current.signal
          );
          abortControllerRef.current = null;
      } catch (e: any) {
          if (e.name !== 'AbortError') alert(e.message);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleChatSend = async (msg: string) => {
      if (isChatLoading) return;
      
      const newHistory = [...chatHistory, { role: 'user', content: msg } as ChatMessage];
      setChatHistory(newHistory);
      setIsChatLoading(true);
      
      // We don't abort main solver here to allow parallel if user wants, but generally single stream
      // Create new controller for chat
      const chatAbortController = new AbortController();
      abortControllerRef.current = chatAbortController; 
      
      try {
          let aiResponseContent = "";
          let aiResponseReasoning = "";
          
          await apiChat(
              msg,
              problemText,
              solutionText,
              chatHistory,
              config,
              isThinkingEnabled,
              (content, reasoning) => {
                  aiResponseContent = content;
                  aiResponseReasoning = reasoning;
              },
              chatAbortController.signal
          );
          
          const aiMsg: ChatMessage = { role: 'assistant', content: aiResponseContent, reasoning: aiResponseReasoning };
          const finalHistory = [...newHistory, aiMsg];
          setChatHistory(finalHistory);
          updateLatestHistoryChat(finalHistory);
          
      } catch (e: any) {
           if(e.name !== 'AbortError') {
               setChatHistory([...newHistory, { role: 'system', content: `Error: ${e.message}` }]);
           }
      } finally {
          setIsChatLoading(false);
          if (abortControllerRef.current === chatAbortController) {
              abortControllerRef.current = null;
          }
      }
  };

  const handleHistorySelect = (item: HistoryItem) => {
      canvasRef.current?.loadFromBase64(item.img);
      setProblemText(item.prob);
      setSolutionText(item.sol);
      setReasoningText(""); 
      setChatHistory(item.chat || []);
      setPanelState('result');
      setActiveModel(item.model);
      setIsHistoryOpen(false);
      if(isPanelCollapsed) setIsPanelCollapsed(false);
      setAdditionalText(""); // Reset manual input when loading history
  };

  const handleHistoryClear = () => {
      if(confirm("确定要清空所有历史记录吗？")) {
          clearHistory();
          setHistoryItems([]);
      }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f3f4f6] font-sans text-gray-800">
      <Header 
        onHistoryClick={() => setIsHistoryOpen(true)} 
        onSettingsClick={() => setIsSettingsOpen(true)} 
      />

      <main className="flex-1 relative overflow-hidden flex">
        
        {/* Left: Drawing Board (Always full width essentially, covered by right panel) */}
        <div className="absolute inset-0 z-0">
            {/* Pass isPanelCollapsed to CanvasBoard to let it center the toolbar */}
            <CanvasBoard ref={canvasRef} isPanelCollapsed={isPanelCollapsed} />
            
            {/* Model Info - Bottom Left */}
            <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-400 pointer-events-none select-none bg-white/50 backdrop-blur-sm px-2 py-1 rounded">
                {config.modelVision} + {currentSolverModel}
            </div>

            {/* Bottom Controls: Centered based on visible canvas area */}
            {/* If Panel is collapsed (hidden), controls should be at right: 24px */}
            {/* If Panel is open (50% width), controls should be at right: 50% + 24px (effectively center of screen) */}
            <div 
                className="absolute bottom-6 z-10 flex flex-col items-end gap-3 transition-all duration-300 ease-in-out" 
                style={{ 
                    right: isPanelCollapsed ? '1.5rem' : 'calc(50% + 1.5rem)',
                }}
            >
                <div 
                    onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                    className="bg-white/90 backdrop-blur px-3 py-2 rounded-full shadow-md border border-gray-200 flex items-center cursor-pointer transition hover:bg-white select-none"
                >
                    <span className="text-xs font-bold text-gray-500 uppercase mr-2">深度思考</span>
                    <div className={`relative w-10 h-5 transition-all duration-300 rounded-full ${isThinkingEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${isThinkingEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                </div>

                <div className="flex items-end gap-2">
                  <div className="relative group">
                      <textarea 
                        value={additionalText}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        onChange={(e) => setAdditionalText(e.target.value)}
                        placeholder="文字补充(可选)..."
                        className={`
                            bg-white/90 backdrop-blur border border-gray-200 shadow-lg outline-none focus:ring-2 focus:ring-[#615ced] 
                            transition-all duration-300 ease-in-out text-sm placeholder:text-gray-400 resize-none custom-scrollbar
                            ${isInputFocused 
                                ? `h-48 rounded-2xl py-3 pl-4 pr-8 ${isPanelCollapsed ? 'w-80 md:w-96' : 'w-64 md:w-72'}` 
                                : 'h-[48px] w-40 md:w-56 rounded-full py-3 px-4 overflow-hidden whitespace-nowrap leading-normal'
                            }
                        `}
                      />
                      {additionalText && (
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); setAdditionalText(""); }}
                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-20"
                            title="清空"
                          >
                              <X size={14} />
                          </button>
                      )}
                  </div>
                  <button 
                      onClick={handleSolve}
                      className="h-[48px] bg-[#615ced] hover:bg-[#4f4bc6] text-white font-semibold px-6 rounded-full shadow-lg flex items-center gap-2 transition transform active:scale-95 whitespace-nowrap"
                  >
                      <Wand2 size={18} />
                      <span>识别求解</span>
                  </button>
                </div>
            </div>
        </div>

        {/* Right: Result Panel (Absolute overlay) */}
        <div 
            className={`absolute right-0 top-0 bottom-0 z-20 bg-white border-l border-gray-200 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col
                       ${isPanelCollapsed ? 'translate-x-full' : 'translate-x-0'}`}
            style={{ width: '50%', maxWidth: '100%' }}
        >
            {/* Toggle Splitter Button (Attached to panel) */}
            <button 
                onClick={togglePanel}
                className="absolute top-1/2 -left-6 transform -translate-y-1/2 z-50 
                           bg-white border border-gray-200 shadow-md text-gray-500 hover:text-blue-600 
                           w-6 h-12 rounded-l-xl flex items-center justify-center transition-colors"
                title={isPanelCollapsed ? "展开" : "折叠"}
            >
                {isPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <ResultPanel 
                state={panelState}
                loadingStep={loadingStep}
                loadingDesc={loadingDesc}
                problemText={problemText}
                solutionText={solutionText}
                reasoningText={reasoningText}
                isGenerating={isGenerating}
                modelName={activeModel}
                onProblemChange={setProblemText}
                onConfirmProblem={handleConfirmVerify}
                onCancelVerify={() => setPanelState(solutionText ? 'result' : 'empty')}
                onEditRequest={() => setPanelState('verify')}
                onStopGeneration={abortCurrent}
                onChatToggle={() => setIsChatOpen(!isChatOpen)}
                isChatOpen={isChatOpen}
            />
            
            {/* Chat Window Overlay on Right Panel */}
            <ChatWindow 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                messages={chatHistory}
                isLoading={isChatLoading}
                onSend={handleChatSend}
            />
        </div>

      </main>

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal config={config} onSave={handleSettingsSave} onClose={() => setIsSettingsOpen(false)} />
      )}
      
      <HistoryDrawer 
        isOpen={isHistoryOpen} 
        history={historyItems} 
        onClose={() => setIsHistoryOpen(false)}
        onSelect={handleHistorySelect}
        onClear={handleHistoryClear}
      />
    </div>
  );
};

export default App;
