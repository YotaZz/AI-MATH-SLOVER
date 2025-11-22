
import React from 'react';
import { Calculator, History, Settings } from 'lucide-react';

interface Props {
  onHistoryClick: () => void;
  onSettingsClick: () => void;
}

const Header: React.FC<Props> = ({ onHistoryClick, onSettingsClick }) => {
  return (
    <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center z-50 relative shrink-0">
      <div className="flex items-center gap-2">
        <div className="bg-[#615ced] text-white p-1.5 rounded-lg">
          <Calculator size={20} />
        </div>
        <h1 className="text-lg font-bold text-gray-800 hidden sm:block">
          AI 数学手写解答 <span className="text-xs text-gray-400 font-normal px-1 border border-gray-200 rounded ml-2">Qwen & Gemini</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onHistoryClick} className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-gray-100" title="历史记录">
          <History size={20} />
        </button>
        <button onClick={onSettingsClick} className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-gray-100" title="设置">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
