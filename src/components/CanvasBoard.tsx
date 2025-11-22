
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Pen, Eraser, RotateCcw, Trash2, Trash } from 'lucide-react';

export interface CanvasHandle {
  getImageData: () => string;
  loadFromBase64: (b64: string) => void;
  clear: () => void;
  undo: () => void;
}

interface Props {
  onStateChange?: () => void;
  isPanelCollapsed?: boolean;
}

// Custom Cursors as SVG Data URIs (URL Encoded for safety)
const svgPen = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
const CURSOR_PEN = `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgPen)}') 0 24, auto`;

// Eraser: A circle representing the stroke width (40px)
const svgEraser = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="rgba(255,255,255,0.8)" stroke="black" stroke-width="1.5"/></svg>`;
const CURSOR_ERASER = `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgEraser)}') 20 20, auto`;

const CanvasBoard = forwardRef<CanvasHandle, Props>(({ onStateChange, isPanelCollapsed = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const historyRef = useRef<string[]>([]);
  const stepRef = useRef(-1);
  const [canRestore, setCanRestore] = useState(false);
  const [lastCleared, setLastCleared] = useState<string | null>(null);

  // Styles
  const setContextStyles = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'pen') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.lineWidth = 40; // Matches the SVG cursor size
      ctx.strokeStyle = '#ffffff';
      ctx.globalCompositeOperation = 'source-over'; 
    }
  };

  // Resize Handling
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Save current content
    let imgData: string | null = null;
    if (stepRef.current >= 0 && historyRef.current[stepRef.current]) {
        imgData = historyRef.current[stepRef.current];
    } else if (canvas.width > 0) {
        imgData = canvas.toDataURL();
    }

    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    // Determine new size (max of current and container)
    const newWidth = Math.max(canvas.width, rect.width);
    const newHeight = Math.max(canvas.height, rect.height);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (imgData) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    setContextStyles(ctx);
                };
                img.src = imgData;
            } else {
                setContextStyles(ctx);
            }
        }
    }
  };

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    setTimeout(resizeCanvas, 100);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
    };
  }, []);

  // Tool Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) setContextStyles(ctx);
    }
  }, [tool]);

  // History Logic
  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stepRef.current++;
    if (stepRef.current < historyRef.current.length) {
      historyRef.current.length = stepRef.current;
    }
    historyRef.current.push(canvas.toDataURL());
    if(onStateChange) onStateChange();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (stepRef.current > 0) {
      stepRef.current--;
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setContextStyles(ctx);
      };
      img.src = historyRef.current[stepRef.current];
    } else {
      stepRef.current = -1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      historyRef.current = [];
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas || stepRef.current === -1) return;
    
    setLastCleared(historyRef.current[stepRef.current]);
    setCanRestore(true);
    
    const ctx = canvas.getContext('2d');
    if(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    stepRef.current = -1;
    historyRef.current = [];
    
    setTimeout(() => setCanRestore(false), 5000);
  };

  const restore = () => {
    if (!lastCleared) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
        stepRef.current = 0;
        historyRef.current = [lastCleared];
        setContextStyles(ctx);
    };
    img.src = lastCleared;
    setCanRestore(false);
    setLastCleared(null);
  };

  // Drawing Events
  const getPos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ('touches' in e) e.preventDefault();
    
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.closePath();
      saveState();
    }
  };

  useImperativeHandle(ref, () => ({
    getImageData: () => canvasRef.current?.toDataURL("image/png").split(',')[1] || "",
    loadFromBase64: (b64: string) => {
       const imgUrl = "data:image/png;base64," + b64;
       const canvas = canvasRef.current;
       const ctx = canvas?.getContext('2d');
       if(canvas && ctx) {
           const img = new Image();
           img.onload = () => {
               if(img.width > canvas.width) canvas.width = img.width;
               if(img.height > canvas.height) canvas.height = img.height;
               
               ctx.fillStyle = '#ffffff';
               ctx.fillRect(0, 0, canvas.width, canvas.height);
               ctx.drawImage(img, 0, 0);
               setContextStyles(ctx);
               
               historyRef.current = [imgUrl];
               stepRef.current = 0;
           };
           img.src = imgUrl;
       }
    },
    clear,
    undo
  }));

  return (
    <div 
        ref={containerRef} 
        className="w-full h-full relative bg-white touch-none overflow-hidden"
        style={{ cursor: tool === 'pen' ? CURSOR_PEN : CURSOR_ERASER }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      
      {/* Floating Toolbar - Centered based on visible area */}
      <div 
        className="absolute top-4 z-20 flex items-center gap-3 bg-white/95 backdrop-blur shadow-lg rounded-full px-4 py-2 border border-gray-200 transition-all duration-300 ease-in-out"
        style={{ 
            left: isPanelCollapsed ? '50%' : '25%',
            transform: 'translateX(-50%)',
            cursor: 'default' // Reset cursor for the toolbar itself
        }}
      >
        <button 
          onClick={() => setTool('pen')} 
          className={`p-2 rounded-full transition-colors ${tool === 'pen' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="画笔"
        >
          <Pen size={18} />
        </button>
        <button 
          onClick={() => setTool('eraser')} 
          className={`p-2 rounded-full transition-colors ${tool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="橡皮擦"
        >
          <Eraser size={18} />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        <button onClick={undo} className="p-2 rounded-full text-gray-500 hover:bg-gray-100" title="撤销">
          <RotateCcw size={18} />
        </button>
        <button onClick={clear} className="p-2 rounded-full text-red-500 hover:bg-red-50" title="清空">
          <Trash2 size={18} />
        </button>
        {canRestore && (
          <button onClick={restore} className="p-2 rounded-full text-blue-600 bg-blue-50 animate-pulse" title="恢复">
            <Trash size={18} />
          </button>
        )}
      </div>
    </div>
  );
});

export default CanvasBoard;
