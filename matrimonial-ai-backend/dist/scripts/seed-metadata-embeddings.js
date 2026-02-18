/**
 * Creates embeddings for the hardcoded schema metadata and saves them to
 * schema_registry in PostgreSQL. Run once (or when metadata changes):
 *   npx tsx src/scripts/seed-metadata-embeddings.ts
 * Requires GEMINI_KEY in .env (uses text-embedding-004).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../config/database.js";
import { getEmbedding } from "../services/ai.service.js";
import { SCHEMA_METADATA } from "../db/metadata/schema-metadata.js";
const __filename = fileURLToPath(import.meta.url);
function textToEmbed(table) {
    const columnList = table.columns
        .map((c) => `${c.name} (${c.data_type})`)
        .join(", ");
    return `${table.table_name} [${table.module_name}]: ${table.description} Columns: ${columnList}`;
}
async function seedMetadataEmbeddings() {
    console.log("Seeding schema_registry with embeddings from metadata...\n");
    const firstTable = SCHEMA_METADATA[0];
    if (!firstTable)
        throw new Error("SCHEMA_METADATA is empty");
    const firstText = textToEmbed(firstTable);
    const firstEmbedding = await getEmbedding(firstText);
    const dim = firstEmbedding.length;
    console.log(`  Embedding dimension: ${dim}`);
    await db("schema_registry").del();
    try {
        await db.raw(`ALTER TABLE schema_registry ALTER COLUMN embedding TYPE vector(${dim})`);
    }
    catch {
        // Column may already be correct dimension (e.g. after first run)
    }
    for (let i = 0; i < SCHEMA_METADATA.length; i++) {
        const table = SCHEMA_METADATA[i];
        if (!table)
            continue;
        const text = textToEmbed(table);
        const embedding = i === 0 ? firstEmbedding : await getEmbedding(text);
        const embeddingStr = `[${embedding.join(",")}]`;
        await db("schema_registry")
            .insert({
            table_name: table.table_name,
            module_name: table.module_name,
            description: table.description,
            embedding: db.raw("?::vector", [embeddingStr]),
        })
            .onConflict("table_name")
            .merge(["module_name", "description", "embedding"]);
        console.log(`  ✓ ${table.table_name}`);
    }
    console.log("\n✅ Done. schema_registry now has embeddings for", SCHEMA_METADATA.length, "tables.");
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
    seedMetadataEmbeddings()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
export { seedMetadataEmbeddings };
//# sourceMappingURL=seed-metadata-embeddings.js.map