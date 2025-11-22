import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

interface Props {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content, className }) => {
  // 预处理内容
  const processedContent = content
    // 1. 先处理标准 LaTeX 块级/行内公式转换 \[ \] -> $$
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    
    // 2. ✨关键修复：去除被反引号包裹的数学公式✨
    // 很多 LLM 会输出 `$\int...$`，这会导致渲染成代码块而不是公式
    // 这里的正则会将 `$...$` 替换为 $...$
    .replace(/`(\$[^`]+?\$)`/g, '$1') 
    .replace(/`(\$\$[^`]+?\$\$)`/g, '$1');

  return (
    <div className={`markdown-body text-sm md:text-base leading-relaxed ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex as any, { 
            strict: false, 
            trust: true, 
            output: 'htmlAndMathml',
            throwOnError: false
          }]
        ]}
        components={{
          // 链接在新标签页打开
          a: ({ node, ...props }) => (
             <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />
          ),
          // (可选) 如果你想强制让所有未渲染的 LaTeX 代码块也尝试渲染，可以自定义 code 组件，
          // 但通常上面的 replace 已经足够解决问题，且更安全。
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);