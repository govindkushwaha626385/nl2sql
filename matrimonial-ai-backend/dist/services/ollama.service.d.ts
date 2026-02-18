/**
 * Ollama local API client for text generation and embeddings.
 * Requires Ollama running (e.g. ollama serve) and models pulled (e.g. ollama run llama3.2, ollama run nomic-embed-text).
 */
export declare function generateText(prompt: string): Promise<string>;
export declare function getEmbedding(text: string): Promise<number[]>;
//# sourceMappingURL=ollama.service.d.ts.map