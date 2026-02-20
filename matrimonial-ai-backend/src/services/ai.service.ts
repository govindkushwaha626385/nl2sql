import dotenv from "dotenv";
dotenv.config();

const useOllama = Boolean(process.env.OLLAMA_BASE_URL);

/** Token usage for a single LLM call (input = prompt, output = completion). */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

// Re-export the provider-agnostic API; implementation is Ollama or Gemini below.
export async function getEmbedding(text: string): Promise<number[]> {
  if (useOllama) {
    const { getEmbedding: ollamaEmbed } = await import("./ollama.service.js");
    return ollamaEmbed(text);
  }
  return getEmbeddingGemini(text);
}

export async function generateText(prompt: string): Promise<{ text: string; usage?: TokenUsage }> {
  if (useOllama) {
    const { generateText: ollamaGenerate } = await import("./ollama.service.js");
    return ollamaGenerate(prompt);
  }
  return generateTextGemini(prompt);
}

// ----- Gemini (used when OLLAMA_BASE_URL is not set) -----
let _geminiPromise: Promise<{ model: Awaited<ReturnType<typeof initGemini>>["model"]; embeddingModel: Awaited<ReturnType<typeof initGemini>>["embeddingModel"] }> | null = null;

async function initGemini() {
  const key = process.env.GEMINI_KEY;
  if (!key) throw new Error("GEMINI_KEY is required in .env when not using Ollama (OLLAMA_BASE_URL)");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const modelId = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelId });
  const embeddingModelId = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelId });
  return { model, embeddingModel };
}

async function getGeminiModel() {
  if (!_geminiPromise) _geminiPromise = initGemini();
  return _geminiPromise;
}

async function getEmbeddingGemini(text: string): Promise<number[]> {
  const { embeddingModel } = await getGeminiModel();
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

async function generateTextGemini(prompt: string): Promise<{ text: string; usage?: TokenUsage }> {
  const { model } = await getGeminiModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const meta = result.response.usageMetadata;
  const usage: TokenUsage | undefined =
    meta &&
    (meta.promptTokenCount != null || meta.candidatesTokenCount != null)
      ? {
          input: meta.promptTokenCount ?? 0,
          output: meta.candidatesTokenCount ?? 0,
          total: meta.totalTokenCount ?? (meta.promptTokenCount ?? 0) + (meta.candidatesTokenCount ?? 0),
        }
      : undefined;
  return usage ? { text, usage } : { text };
}

