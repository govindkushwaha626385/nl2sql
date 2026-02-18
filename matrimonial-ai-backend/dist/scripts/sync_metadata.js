// src/scripts/sync_metadata.ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db } from '../config/database.js';
import { getEmbedding, generateText } from '../services/ai.service.js';
const __filename = fileURLToPath(import.meta.url);
export async function syncMetadata() {
    console.log("Starting Metadata Sync...");
    // 1. Fetch all table names from the public schema
    const tables = await db('tables')
        .withSchema('information_schema')
        .select('table_name')
        .where({ table_schema: 'public', table_type: 'BASE TABLE' })
        .whereNot('table_name', 'schema_registry')
        .whereNot('table_name', 'semantic_cache');
    for (const row of tables) {
        const table_name = row.table_name;
        // 2. Fetch columns for this table to give context to the AI
        const columns = await db('columns')
            .withSchema('information_schema')
            .where({ table_schema: 'public', table_name })
            .select('column_name', 'data_type');
        const columnList = columns.map((c) => `${c.column_name} (${c.data_type})`).join(', ');
        // 3. Generate a Semantic Description using Gemini
        // This helps the AI understand *why* to use this table
        const descriptionPrompt = `
      Briefly describe the purpose of the matrimonial database table '${table_name}' 
      which has these columns: ${columnList}. 
      Focus on business logic (e.g., 'stores physical traits for matching').
      Max 2 sentences.
    `;
        const description = await generateText(descriptionPrompt);
        // 4. Generate Vector Embedding for Semantic Search (pgvector format: '[x,y,z,...]')
        const embedding = await getEmbedding(description);
        const embeddingStr = `[${embedding.join(',')}]`;
        // 5. Upsert into the registry
        await db('schema_registry')
            .insert({
            table_name,
            description,
            embedding: db.raw('?::vector', [embeddingStr]),
            module_name: inferModule(table_name)
        })
            .onConflict('table_name')
            .merge(['description', 'embedding', 'module_name']);
        console.log(`Synced: ${table_name}`);
    }
    console.log("✅ Metadata Sync Complete.");
}
// Helper to categorize tables for the Planner
function inferModule(tableName) {
    if (tableName.includes('horoscope') || tableName.includes('astro'))
        return 'Astrology';
    if (tableName.includes('payment') || tableName.includes('sub'))
        return 'Finance';
    if (tableName.includes('profile') || tableName.includes('user'))
        return 'Core';
    return 'General';
}
// Run if called directly (ESM: no require.main)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
    syncMetadata().then(() => process.exit(0)).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=sync_metadata.js.map