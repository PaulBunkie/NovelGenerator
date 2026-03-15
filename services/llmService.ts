import { DEFAULT_MODEL } from '../constants';
import { withResilienceTracking } from '../utils/apiResilienceUtils';

declare const process: {
  env: {
    OPENROUTER_API_KEY?: string;
    OPENROUTER_MODEL?: string;
    SITE_URL?: string;
    SITE_NAME?: string;
    [key: string]: string | undefined;
  };
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const SITE_NAME = process.env.SITE_NAME || 'NovelGenerator';

let globalLanguage = 'English';

export function setGlobalLanguage(language: string) {
  globalLanguage = language;
  console.log(`🌐 Global language set to: ${language}`);
}

const handleApiError = (error: unknown): Error => {
  console.error("❌ Error calling OpenRouter API:", error);
  if (error instanceof Error) {
    let message = `OpenRouter API Error: ${error.message}`;
    if (error.message.includes("401") || error.message.includes("API key")) {
      message = "OpenRouter API Error: The provided API key is not valid. Please check your configuration.";
    } else if (error.message.includes("429")) {
      message = "OpenRouter API Error: Rate limit exceeded. Waiting before retry...";
    } else if (error.message.includes("503") || error.message.includes("overloaded")) {
      message = "OpenRouter API Error: Service is temporarily overloaded. Retrying...";
    }
    return new Error(message);
  }
  return new Error("Unknown OpenRouter API Error occurred.");
};

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes("401") || lastError.message.includes("quota exceeded")) {
        throw lastError;
      }

      if (attempt === maxRetries) {
        console.error(`Failed after ${maxRetries + 1} attempts:`, lastError);
        throw lastError;
      }

      let delay = baseDelay * Math.pow(2, attempt);
      if (lastError.message.includes("503") || lastError.message.includes("429")) {
        delay = Math.max(delay, 5000 + (attempt * 3000));
      }

      const jitter = Math.random() * 1000;
      delay += jitter;

      console.warn(`🔄 Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`);
      console.warn(`⏳ Waiting ${Math.round(delay/1000)}s before retry...`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Retry failed");
}

export async function generateLLMText(
  prompt: string,
  systemInstruction?: string,
  responseSchema?: object,
  temperature?: number,
  topP?: number,
  topK?: number,
  language?: string,
  model?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is not initialized. OPENROUTER_API_KEY is missing.");
  }

  const selectedModel = model || DEFAULT_MODEL;
  const selectedLanguage = language || globalLanguage;
  const maxRetries = responseSchema ? 7 : 5;
  const baseDelay = responseSchema ? 3000 : 2000;

  return withResilienceTracking(() => retryWithBackoff(async () => {
    try {
      const languageInstruction = `\n\nIMPORTANT: Respond in ${selectedLanguage.toUpperCase()}. All narrative, dialogue, and descriptions MUST be in ${selectedLanguage}. Do not use English unless specifically requested in the prompt.`;
      
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction + languageInstruction });
      } else {
        messages.push({ role: "system", content: "You are a professional novelist." + languageInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const body: any = {
        model: selectedModel,
        messages,
        temperature: temperature ?? 0.7,
        top_p: topP ?? 1,
        ...(topK !== undefined && { top_k: topK })
      };

      if (responseSchema) {
        body.response_format = { type: "json_object" };
        messages[messages.length - 1].content += `\n\nIMPORTANT: You must return valid JSON that matches this schema: ${JSON.stringify(responseSchema)}`;
      }

      console.log(`🔄 Sending request to OpenRouter API...
        Model: ${selectedModel}
        Language: ${selectedLanguage}
        Temperature: ${temperature ?? 0.7}
        Prompt length: ${prompt.length} chars
        System instruction: ${systemInstruction ? 'Yes' : 'No'}
        Response Schema: ${responseSchema ? 'Yes' : 'No'}`);
      
      console.log('📡 FULL REQUEST MESSAGES:', JSON.stringify(messages, null, 2));

      const startTime = Date.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API returned ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '';
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Received response from OpenRouter API:
        Duration: ${duration}s
        Response length: ${text.length} chars
        Model: ${data.model || selectedModel}
        Tokens: ${data.usage?.total_tokens || 'unknown'}`);
      return text;
    } catch (error) {
      throw handleApiError(error);
    }
  }, maxRetries, baseDelay));
}

export async function generateLLMTextStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  systemInstruction?: string,
  temperature?: number,
  topP?: number,
  topK?: number,
  language?: string,
  model?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is not initialized. OPENROUTER_API_KEY is missing.");
  }

  const selectedModel = model || DEFAULT_MODEL;
  const selectedLanguage = language || globalLanguage;

  return retryWithBackoff(async () => {
    try {
      const languageInstruction = `\n\nIMPORTANT: Respond in ${selectedLanguage.toUpperCase()}. All narrative, dialogue, and descriptions MUST be in ${selectedLanguage}. Do not use English unless specifically requested in the prompt.`;

      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction + languageInstruction });
      } else {
        messages.push({ role: "system", content: "You are a professional novelist." + languageInstruction });
      }
      messages.push({ role: "user", content: prompt });

      console.log(`🔄 Starting stream from OpenRouter API...
        Model: ${selectedModel}
        Language: ${selectedLanguage}
        Prompt length: ${prompt.length} chars`);
      
      console.log('📡 FULL STREAM REQUEST MESSAGES:', JSON.stringify(messages, null, 2));

      const startTime = Date.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: temperature ?? 0.7,
          top_p: topP ?? 1,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API returned ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              const chunkText = data.choices[0]?.delta?.content || '';
              if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
              }
            } catch (e) {
              console.warn("Error parsing stream chunk", e);
            }
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Stream complete:
        Duration: ${duration}s
        Total length: ${fullText.length} chars`);
      return fullText;
    } catch (error) {
      throw handleApiError(error);
    }
  });
}

interface QueuedRequest {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

class APIRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private rateLimitDelay = 1000;

  enqueue<T>(
    fn: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fn,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      };

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      let insertIndex = this.queue.length;

      for (let i = 0; i < this.queue.length; i++) {
        if (priorityOrder[request.priority] < priorityOrder[this.queue[i].priority]) {
          insertIndex = i;
          break;
        }
      }

      this.queue.splice(insertIndex, 0, request);
      console.log(`📋 Queued API request (${priority} priority). Queue size: ${this.queue.length}`);

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        console.log(`🔄 Processing queued request ${request.id} (${request.priority} priority)`);
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        console.error(`❌ Queued request ${request.id} failed:`, error);
        request.reject(error);
      }

      if (this.queue.length > 0) {
        console.log(`⏳ Rate limiting: waiting ${this.rateLimitDelay}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    this.processing = false;
    console.log(`✅ Queue processing complete`);
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  adjustRateLimit(increase: boolean) {
    if (increase) {
      this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 10000);
      console.log(`📈 Increased rate limit delay to ${this.rateLimitDelay}ms`);
    } else {
      this.rateLimitDelay = Math.max(this.rateLimitDelay * 0.8, 500);
      console.log(`📉 Decreased rate limit delay to ${this.rateLimitDelay}ms`);
    }
  }
}

const requestQueue = new APIRequestQueue();

export async function generateLLMTextQueued(
  prompt: string,
  systemInstruction?: string,
  responseSchema?: object,
  temperature?: number,
  topP?: number,
  topK?: number,
  priority: 'high' | 'medium' | 'low' = 'medium',
  language?: string,
  model?: string
): Promise<string> {
  return requestQueue.enqueue(
    () => generateLLMText(prompt, systemInstruction, responseSchema, temperature, topP, topK, language, model),
    priority
  );
}

export function getQueueStatus() {
  return {
    size: requestQueue.getQueueSize(),
    processing: requestQueue.isProcessing()
  };
}
