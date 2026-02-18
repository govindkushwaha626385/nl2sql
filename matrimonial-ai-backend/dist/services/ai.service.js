import dotenv from "dotenv";
dotenv.config();
const useOllama = Boolean(process.env.OLLAMA_BASE_URL);
// Re-export the provider-agnostic API; implementation is Ollama or Gemini below.
export async function getEmbedding(text) {
    if (useOllama) {
        const { getEmbedding: ollamaEmbed } = await import("./ollama.service.js");
        return ollamaEmbed(text);
    }
    return getEmbeddingGemini(text);
}
export async function generateText(prompt) {
    if (useOllama) {
        const { generateText: ollamaGenerate } = await import("./ollama.service.js");
        return ollamaGenerate(prompt);
    }
    return generateTextGemini(prompt);
}
// ----- Gemini (used when OLLAMA_BASE_URL is not set) -----
let _geminiPromise = null;
async function initGemini() {
    const key = process.env.GEMINI_KEY;
    if (!key)
        throw new Error("GEMINI_KEY is required in .env when not using Ollama (OLLAMA_BASE_URL)");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);
    const modelId = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelId });
    const embeddingModelId = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    const embeddingModel = genAI.getGenerativeModel({ model: embeddingModelId });
    return { model, embeddingModel };
}
async function getGeminiModel() {
    if (!_geminiPromise)
        _geminiPromise = initGemini();
    return _geminiPromise;
}
async function getEmbeddingGemini(text) {
    const { embeddingModel } = await getGeminiModel();
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}
async function generateTextGemini(prompt) {
    const { model } = await getGeminiModel();
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}
//# sourceMappingURL=ai.service.js.map