
import { MODEL_MAPPINGS } from '../types';
import type { AppConfig, StreamResponse, ChatMessage, VerificationResult } from '../types';

const DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DMXAPI_ENDPOINT = "https://www.dmxapi.cn/v1/chat/completions";

const isDMXModel = (model: string): boolean => {
    const m = model.toLowerCase();
    return m.includes('glm') || m.includes('qwen3-8b');
};

export const getActiveKey = (config: AppConfig, modelName: string): string => {
  if (modelName.startsWith('gemini')) return config.apiKeyGoogle;
  if (isDMXModel(modelName)) return config.apiKeyDMX;
  return config.apiKeyDashScope;
};

export const getSolverModel = (config: AppConfig, isThinking: boolean): string => {
  const mapping = MODEL_MAPPINGS[config.modelFamily];
  return isThinking ? mapping.thinking : mapping.fast;
};

// --- Stream Handling ---

async function fetchStream(
  url: string,
  payload: any,
  apiKey: string,
  onUpdate: (content: string, reasoning: string, isReasoning: boolean) => void,
  type: 'sse' | 'gemini',
  signal?: AbortSignal
): Promise<StreamResponse> {
  let fetchUrl = url;
  if (type === 'gemini') {
    fetchUrl = `${url}&alt=sse`;
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': type === 'sse' ? `Bearer ${apiKey}` : undefined
      } as any,
      body: JSON.stringify(payload),
      signal: signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error?.message || `HTTP ${response.status}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullContent = "";
    let fullReasoning = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.substring(6);
            const json = JSON.parse(jsonStr);

            let deltaContent = "";
            let deltaReasoning = "";

            if (type === 'sse') {
              if (json.choices && json.choices[0].delta) {
                const d = json.choices[0].delta;
                if (d.content) deltaContent = d.content;
                if (d.reasoning_content) deltaReasoning = d.reasoning_content;
              }
            } else if (type === 'gemini') {
              if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
                deltaContent = json.candidates[0].content.parts[0].text || "";
              }
            }

            if (deltaContent || deltaReasoning) {
              fullContent += deltaContent;
              fullReasoning += deltaReasoning;
              onUpdate(fullContent, fullReasoning, !!deltaReasoning);
            }
          } catch (e) { 
            console.warn("Stream parse error", e);
          }
        }
      }
    }
    return { content: fullContent, reasoning: fullReasoning };
  } catch (e) {
    throw e;
  }
}

// --- API Methods ---

export async function apiVisionParse(base64: string, config: AppConfig, signal?: AbortSignal): Promise<string> {
  const model = config.modelVision;
  const apiKey = getActiveKey(config, model);
  
  // Updated prompt to enforce $$ delimiters
  const VISION_PROMPT = "You are a math assistant. Transcribe the handwritten mathematics in this image into LaTeX. **IMPORTANT: You MUST wrap the entire mathematical expression in $$ delimiters (e.g. $$ x^2 $$).** Output ONLY the LaTeX code. Do not solve it.";

  let rawResult = "";

  if (model.startsWith('gemini')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: VISION_PROMPT },
            { inlineData: { mimeType: "image/png", data: base64 } }
          ]
        }]
      }),
      signal: signal
    });
    if (!response.ok) throw new Error("Vision API Failed");
    const data = await response.json();
    rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Recognition failed";
  
  } else if (isDMXModel(model)) {
      // DMXAPI (GLM, Qwen3-8B, etc.)
      const payload = {
        model: model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } }
          ]
        }]
      };
      
      const response = await fetch(DMXAPI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        signal: signal
      });
      
      if (!response.ok) {
         const err = await response.json().catch(() => ({}));
         throw new Error(err.error?.message || "DMXAPI Vision Failed");
      }
      
      const data = await response.json();
      rawResult = data.choices?.[0]?.message?.content?.trim() || "Recognition failed";

  } else {
    // Qwen / DashScope (Default)
    const payload = {
      model: model,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } },
          { type: "text", text: VISION_PROMPT }
        ]
      }]
    };
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: signal
    });
    if (!response.ok) throw new Error("Vision API Failed");
    const data = await response.json();
    rawResult = data.choices?.[0]?.message?.content || "Recognition failed";
  }

  // --- Post-Processing ---
  let clean = rawResult.trim();
  
  // 1. Remove Markdown code blocks
  const codeBlockMatch = clean.match(/```(?:latex|markdown|tex)?\n([\s\S]*?)\n```/i);
  if (codeBlockMatch) {
    clean = codeBlockMatch[1].trim();
  } else {
    // Remove inline code ticks if present wrapping the whole string
    const inlineCodeMatch = clean.match(/^`([^`]+)`$/);
    if (inlineCodeMatch) clean = inlineCodeMatch[1].trim();
  }

  // 2. FORCE WRAP: If it looks like LaTeX (contains \) but doesn't start with $, wrap it in $$
  // This specifically fixes models that ignore the prompt to add delimiters.
  if (!clean.startsWith('$') && clean.includes('\\')) {
      clean = `$$ ${clean} $$`;
  }

  return clean;
}

export async function apiSolveProblem(
  text: string,
  config: AppConfig,
  isThinking: boolean,
  onUpdate: (c: string, r: string, isR: boolean) => void,
  signal?: AbortSignal
) {
  const model = getSolverModel(config, isThinking);
  const apiKey = getActiveKey(config, model);

  if (model.startsWith('gemini')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: `Role: Math Tutor. Solve this: ${text}. Use LaTeX ($...$). Language: Chinese. 简洁回答，风格为考研标准答案。` }] }]
    };
    return await fetchStream(url, payload, apiKey, onUpdate, 'gemini', signal);
  } else {
    // DashScope or DMXAPI
    const isDMX = isDMXModel(model);
    const endpoint = isDMX ? DMXAPI_ENDPOINT : DASHSCOPE_ENDPOINT;
    
    const payload: any = {
      model: model,
      messages: [
        { role: "system", content: "You are a helpful Math Tutor. Solve the user's problem step by step. Use LaTeX for math formulas ($...$, $$...$$). Reply in Chinese. 简洁回答，风格为考研标准答案。" },
        { role: "user", content: `Please solve this problem: ${text}` }
      ],
      stream: true
    };

    // Handle thinking parameter
    if (isThinking) {
        if (model.includes('qwen3')) {
            // Both Dashscope and DMXAPI Qwen3 support enable_thinking
            payload.enable_thinking = true;
        } else if (model.toLowerCase().includes('glm')) {
            // GLM-4.5-Flash uses specific thinking param structure
            // Set reasonable max_thinking_tokens for better math performance
            payload.thinking = { 
                type: "enabled",
                budget: 8192 // Set a generous budget for math reasoning
            };
        }
    } else {
        if (model.includes('qwen3') && isDMX) {
             payload.enable_thinking = false;
        } else if (model.toLowerCase().includes('glm')) {
             // Default for GLM is enabled, so we must explicitly disable it if switch is off
             payload.thinking = { type: "disabled" };
        }
    }

    return await fetchStream(endpoint, payload, apiKey, onUpdate, 'sse', signal);
  }
}

export async function apiVerifySolution(
  problem: string,
  solution: string,
  solverModel: string,
  config: AppConfig,
  onUpdate: (content: string) => void,
  signal?: AbortSignal
) {
  // Model Selection Logic
  // If solver is NOT glm-4.5-flash -> Verifier: glm-4.5-flash
  // If solver IS glm-4.5-flash -> Verifier: qwen3-8b
  const isSolverGlm = solverModel.includes('glm-4.5-flash');
  const verifierModel = isSolverGlm ? 'qwen3-8b' : 'glm-4.5-flash';
  const apiKey = getActiveKey(config, verifierModel);

  const systemPrompt = `Role: Expert Math Verifier.
Task: Verify the provided solution to the math problem.
Verification Strategy:
1. Problem Understanding: Ensure the solution addresses the exact problem asked.
2. Condition Check: Verify that all theorems, formulas, and axioms are applied under valid conditions (e.g., ensure denominators are non-zero, domains match).
3. Logic & Calculation: Check for logical fallacies or calculation errors in key steps.
4. Efficiency: Do NOT re-derive obvious conclusions or standard theorems. Accept well-known results as given. Focus on the *application* of methods.
5. Reach a conclusion as quickly as possible; don’t get stuck in a loop of arguments.

Language:
The "summary" and your reasoning MUST be in CHINESE (简体中文).

Output Format:
output a JSON object strictly in this format at the end of your response:
\`\`\`json
{
  "is_correct": true/false,
  "summary": "Short explanation in Chinese"
}
\`\`\`
Ensure the JSON is valid and is the very last part of your output.`;

  const userContent = `Problem: ${problem}\n\nSolution to Verify:\n${solution}`;
  const isDMX = isDMXModel(verifierModel);
  const endpoint = isDMX ? DMXAPI_ENDPOINT : DASHSCOPE_ENDPOINT;

  const payload: any = {
    model: verifierModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    stream: true
  };

  // Enable thinking for verifier
  if (verifierModel.includes('qwen3')) {
    payload.enable_thinking = true;
  } else if (verifierModel.includes('glm')) {
    payload.thinking = { type: "enabled", budget: 4096 };
  }

  // We reuse fetchStream but we combine reasoning and content into one stream for the verifier panel
  let buffer = "";
  await fetchStream(endpoint, payload, apiKey, (content, reasoning) => {
    // Determine what to append. Some models put reasoning in reasoning_content, some in main content text.
    // For the UI, we just want a big text block that we can regex later.
    const textPart = reasoning ? `[Thinking] ${reasoning}\n${content}` : content;
    
    // Simplification for the verification display: 
    // If reasoning comes separate (Dashscope SSE), we might want to just show the stream.
    // Let's just accumulate everything passed to onUpdate.
    // Actually, fetchStream passes 'fullContent' and 'fullReasoning'.
    
    // We construct a viewable string
    let display = "";
    if (reasoning) {
        display += `> **Deep Thinking**\n\n${reasoning}\n\n---\n\n`;
    }
    display += content;
    
    onUpdate(display);
  }, 'sse', signal);

  return { modelUsed: verifierModel };
}

export async function apiChat(
  userQuery: string,
  contextProblem: string,
  contextSolution: string,
  history: ChatMessage[],
  config: AppConfig,
  isThinking: boolean,
  onUpdate: (c: string, r: string, isR: boolean) => void,
  signal?: AbortSignal
) {
  const model = getSolverModel(config, isThinking);
  const apiKey = getActiveKey(config, model);

  if (model.startsWith('gemini')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    const contents: any[] = [
        { role: 'user', parts: [{ text: `Context Problem: ${contextProblem}. Requirement: 简洁回答，风格为考研标准答案。` }] },
        { role: 'model', parts: [{ text: `Initial Solution: ${contextSolution}` }] }
    ];
    history.forEach(msg => {
        contents.push({ 
            role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user', 
            parts: [{ text: msg.content }] 
        });
    });
    contents.push({ role: 'user', parts: [{ text: userQuery }] });
    
    return await fetchStream(url, { contents }, apiKey, onUpdate, 'gemini', signal);
  } else {
    const isDMX = isDMXModel(model);
    const endpoint = isDMX ? DMXAPI_ENDPOINT : DASHSCOPE_ENDPOINT;

    const messages: any[] = [
      { role: "system", content: "You are a helpful Math Tutor. Context provided below. Reply in Chinese. Use LaTeX. 简洁回答，风格为考研标准答案。" },
      { role: "user", content: `Problem: ${contextProblem}` },
      { role: "assistant", content: contextSolution }
    ];
    history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    messages.push({ role: "user", content: userQuery });

    const payload: any = { model: model, messages: messages, stream: true };
    
    if (isThinking) {
        if (model.includes('qwen3')) {
            payload.enable_thinking = true;
        } else if (model.toLowerCase().includes('glm')) {
            payload.thinking = { type: "enabled", budget: 8192 };
        }
    } else {
        if (model.includes('qwen3') && isDMX) {
             payload.enable_thinking = false;
        } else if (model.toLowerCase().includes('glm')) {
             payload.thinking = { type: "disabled" };
        }
    }

    return await fetchStream(endpoint, payload, apiKey, onUpdate, 'sse', signal);
  }
}
