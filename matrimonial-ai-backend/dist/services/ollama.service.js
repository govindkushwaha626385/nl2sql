/**
 * Ollama local API client for text generation and embeddings.
 * Requires Ollama running (e.g. ollama serve) and models pulled (e.g. ollama run llama3.2, ollama run nomic-embed-text).
 */
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
export async function generateText(prompt) {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama generate failed (${res.status}): ${err}`);
    }
    const data = (await res.json());
    const text = data.response?.trim();
    if (text == null)
        throw new Error("Ollama returned no response text");
    return text;
}
export async function getEmbedding(text) {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_EMBEDDING_MODEL,
            input: text,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        if (res.status === 404 && err.includes("not found"))
            throw new Error(`Ollama embedding model "${OLLAMA_EMBEDDING_MODEL}" not found. Run: ollama pull ${OLLAMA_EMBEDDING_MODEL}`);
        throw new Error(`Ollama embed failed (${res.status}): ${err}`);
    }
    const data = (await res.json());
    const vec = data.embeddings?.[0];
    if (!Array.isArray(vec))
        throw new Error("Ollama returned no embedding");
    return vec;
}
//# sourceMappingURL=ollama.service.js.map