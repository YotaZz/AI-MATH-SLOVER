# 🧮 AI Math Solver (AI 数学计算器)

**AI Math Solver** 是一个基于 React 和 AI 模型的智能数学解题助手。它提供了一个交互式画板，允许用户手写数学题目，通过视觉模型识别后，利用深度思考模型（如 Gemini 2.5 Pro, Qwen, GLM）进行求解，并包含自动校验机制以确保答案准确性。

在线演示: [点击查看 (GitHub Pages)](https://yotazz.github.io/AI-MATH-SLOVER/) *(如果已部署)*

## ✨ 核心功能

* **✍️ 交互式手写画板**：
* 支持画笔和橡皮擦工具，模拟真实书写体验。
* 支持撤销（Undo）、清空和恢复功能。
* 自动调整画板大小以适应屏幕。


* **👁️ 视觉识别 (Vision)**：
* 将手写的数学公式截图转换为 LaTeX 格式。
* 支持手动补充文字信息，修正识别误差。


* **🤖 多模型智能求解**：
* 支持 **Google Gemini**、**阿里通义千问 (DashScope/Qwen)**、**智谱 GLM** 等模型。
* **深度思考模式 (Deep Thinking)**：支持模型的思维链（CoT）输出，展示完整的推理过程。


* **✅ 双重校验机制 (Verification)**：
* 自动触发校验流程：模型 A 求解，模型 B 担任"审查员"进行核对。
* 示例：Qwen 求解 -> GLM 校验，或 GLM 求解 -> Qwen 校验。
* 提供红/绿状态指示，直观展示答案的可信度。


* **💬 上下文对话**：
* 针对解题结果进行追问，支持多轮对话。


* **📜 历史记录**：
* 本地存储解题历史（包含图片、题目、答案和校验结果）。
* 支持一键回溯历史记录。



## 🛠️ 技术栈

* **框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **构建工具**: [Vite](https://vitejs.dev/)
* **样式**: [Tailwind CSS](https://tailwindcss.com/)
* **数学渲染**: [KaTeX](https://katex.org/) / [React-Markdown](https://github.com/remarkjs/react-markdown)
* **图标库**: [Lucide React](https://lucide.dev/)
* **AI 集成**: Fetch API (支持 SSE 流式传输)

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yotazz/AI-MATH-SLOVER.git
cd AI-MATH-SLOVER

```

### 2. 安装依赖

```bash
npm install
# 或者
yarn install

```

### 3. 启动开发服务器

```bash
npm run dev

```

打开浏览器访问 `http://localhost:5173` 即可看到应用。

### 4. 构建生产版本

```bash
npm run build

```

## ⚙️ 配置指南 (API Key)

为了使用 AI 功能，你需要配置相应的 API Key。点击应用右上角的 **设置 (Settings)** 图标进行配置：

| 提供商 | 参数名 | 用途 | 获取方式 |
| --- | --- | --- | --- |
| **DashScope (阿里云)** | `apiKeyDashScope` | 用于调用 Qwen (通义千问) 系列模型 | [阿里云百炼控制台](https://bailian.console.aliyun.com/) |
| **Google** | `apiKeyGoogle` | 用于调用 Gemini 系列模型 | [Google AI Studio](https://aistudio.google.com/) |
| **DMXAPI** | `apiKeyDMX` | 用于聚合接口 (GLM/Qwen 等) | DMXAPI 平台 |

> **注意**：API Key 仅存储在浏览器的 LocalStorage 中，不会上传至任何服务器。

## 📖 使用说明

1. **绘图**：在左侧白色画板区域手写数学题目。
2. **设置**：点击底部齿轮图标，选择使用的视觉模型（识别用）和求解模型（解题用）。
3. **识别求解**：点击底部的 "✨ 识别求解" 按钮。
* 系统会先识别图片内容。
* 然后调用 AI 进行逐步推理。
* 最后自动调用校验模型检查答案。


4. **查看结果**：右侧面板会实时流式显示推理过程、最终答案和校验摘要。
5. **追问**：点击右侧面板的聊天图标，可以针对当前题目与 AI 进行对话。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request

## 📄 许可证

[MIT License](https://www.google.com/search?q=LICENSE)
