// src/services/schema.service.ts
// Uses embeddings stored in schema_registry (populate via: npx tsx src/scripts/seed-metadata-embeddings.ts)
import { db } from '../config/database.js';
import { getEmbedding } from './ai.service.js';
import { SCHEMA_METADATA } from '../db/metadata/schema-metadata.js';
const TOP_K = 5;
const metadataByTable = new Map(SCHEMA_METADATA.map((t) => [t.table_name, t]));
export async function getRelevantContext(userQuestion) {
    const queryEmbedding = await getEmbedding(userQuestion);
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const results = await db.raw(`SELECT table_name, description, module_name
     FROM schema_registry
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> ?::vector
     LIMIT ?`, [vectorStr, TOP_K]);
    const rows = results
        .rows;
    if (rows.length === 0) {
        return SCHEMA_METADATA.slice(0, TOP_K).map((t) => ({
            table_name: t.table_name,
            description: t.description,
            module_name: t.module_name,
            columns: t.columns,
        }));
    }
    return rows.map((row) => {
        const meta = metadataByTable.get(row.table_name);
        return {
            table_name: row.table_name,
            description: row.description,
            module_name: row.module_name,
            columns: meta?.columns ?? [],
        };
    });
}
//# sourceMappingURL=schema.service.js.map