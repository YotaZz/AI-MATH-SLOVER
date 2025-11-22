
import { MODEL_MAPPINGS } from '../types';
import type { AppConfig, StreamResponse, ChatMessage } from '../types';

const DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DMXAPI_ENDPOINT = "https://www.dmxapi.cn/v1/chat/completions";

export const getActiveKey = (config: AppConfig, modelName: string): string => {
  if (modelName.startsWith('gemini')) return config.apiKeyGoogle;
  if (modelName.toLowerCase().includes('deepseek')) return config.apiKeyDMX;
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

export async function apiVisionParse(base64: string, config: AppConfig): Promise<string> {
  const apiKey = getActiveKey(config, config.modelVision);
  
  if (config.modelVision.startsWith('gemini')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelVision}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "You are a math assistant. Transcribe the handwritten mathematics in this image into LaTeX/Text. Output ONLY the math expression/problem text. Do not solve it." },
            { inlineData: { mimeType: "image/png", data: base64 } }
          ]
        }]
      })
    });
    if (!response.ok) throw new Error("Vision API Failed");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Recognition failed";
  
  } else if (config.modelVision === 'DeepSeek-OCR-Free') {
      // DMXAPI for DeepSeek-OCR-Free
      const payload = {
        model: "DeepSeek-OCR-Free",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "You are a math assistant. Transcribe the handwritten mathematics in this image into LaTeX/Text. Output ONLY the math expression/problem text." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } }
          ]
        }]
      };
      
      const response = await fetch(DMXAPI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
         const err = await response.json().catch(() => ({}));
         throw new Error(err.error?.message || "DeepSeek-OCR API Failed");
      }
      
      const data = await response.json();
      
      // DeepSeek OCR via DMX returns content which might be a JSON string containing text_result
      let content = data.choices?.[0]?.message?.content || "";
      
      try {
          const jsonContent = JSON.parse(content);
          if (jsonContent && typeof jsonContent === 'object' && 'text_result' in jsonContent) {
              content = jsonContent.text_result;
          }
      } catch(e) {
          // Content is likely plain text if parse fails
      }

      // Cleanup special tags like <|ref|>...</ref> and <|det|>...</det>
      content = content.replace(/<\|ref\|>.*?<\|\/ref\|>/g, '')
                       .replace(/<\|det\|>.*?<\|\/det\|>/g, '');

      return content.trim() || "Recognition failed";

  } else {
    // Qwen / DashScope
    const payload = {
      model: config.modelVision,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } },
          { type: "text", text: "You are a math assistant. Transcribe the handwritten mathematics in this image into LaTeX/Text. Output ONLY the math expression/problem text. Do not solve it." }
        ]
      }]
    };
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Vision API Failed");
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Recognition failed";
  }
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
    const payload: any = {
      model: model,
      messages: [
        { role: "system", content: "You are a helpful Math Tutor. Solve the user's problem step by step. Use LaTeX for math formulas ($...$, $$...$$). Reply in Chinese. 简洁回答，风格为考研标准答案。" },
        { role: "user", content: `Please solve this problem: ${text}` }
      ],
      stream: true
    };
    if(isThinking) payload.enable_thinking = true;

    return await fetchStream(DASHSCOPE_ENDPOINT, payload, apiKey, onUpdate, 'sse', signal);
  }
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
    const messages: any[] = [
      { role: "system", content: "You are a helpful Math Tutor. Context provided below. Reply in Chinese. Use LaTeX. 简洁回答，风格为考研标准答案。" },
      { role: "user", content: `Problem: ${contextProblem}` },
      { role: "assistant", content: contextSolution }
    ];
    history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    messages.push({ role: "user", content: userQuery });

    const payload: any = { model: model, messages: messages, stream: true };
    if(isThinking) payload.enable_thinking = true;

    return await fetchStream(DASHSCOPE_ENDPOINT, payload, apiKey, onUpdate, 'sse', signal);
  }
}
