
import React from 'react';
import type { HistoryItem } from '../types';
import { Clock, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  history: HistoryItem[];
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const HistoryDrawer: React.FC<Props> = ({ isOpen, history, onClose, onSelect, onClear }) => {
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 z-[110] backdrop-blur-sm" onClick={onClose}></div>}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-[120] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="bg-[#615ced] px-6 py-4 text-white flex justify-between items-center shadow-md shrink-0">
            <h3 className="font-bold text-lg flex items-center"><Clock className="mr-2" size={20}/> 历史记录</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white transition"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {history.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">暂无记录</div>
            ) : (
                history.map(item => (
                    <div key={item.id} onClick={() => onSelect(item)} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer flex gap-3 group">
                         <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden shrink-0 border border-gray-100">
                             <img src={`data:image/png;base64,${item.img}`} className="w-full h-full object-contain" alt="Problem" />
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col justify-between">
                             <div>
                                 <div className="text-xs text-gray-400 mb-1">{item.time}</div>
                                 <div className="mb-1">
                                     <span className="text-[10px] text-blue-500 font-mono bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                         {item.model}
                                     </span>
                                 </div>
                                 <div className="text-sm font-medium text-gray-800 truncate">{item.prob}</div>
                             </div>
                             <div className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition mt-1">点击恢复</div>
                         </div>
                    </div>
                ))
            )}
        </div>
        
        {history.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-white shrink-0">
                <button onClick={onClear} className="w-full py-2 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm flex items-center justify-center gap-2">
                    <Trash2 size={16} /> 清空历史记录
                </button>
            </div>
        )}
      </div>
    </>
  );
};

export default HistoryDrawer;
