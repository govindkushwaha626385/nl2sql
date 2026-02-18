/**
 * Creates or updates embeddings for schema metadata and writes them to
 * schema_registry in PostgreSQL. Run after changing src/db/metadata/schema-metadata.ts:
 *   npx tsx src/scripts/seed-metadata-embeddings.ts
 * Requires DATABASE_URL and either GEMINI_KEY or OLLAMA_BASE_URL in .env.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../config/database.js";
import { getEmbedding } from "../services/ai.service.js";
import { SCHEMA_METADATA } from "../db/metadata/schema-metadata.js";

const __filename = fileURLToPath(import.meta.url);

/** Build a single text per table so embeddings capture table purpose and columns for semantic search. */
function textToEmbed(table: (typeof SCHEMA_METADATA)[0]): string {
  const columnParts = table.columns.map((c) => {
    const base = `${c.name} (${c.data_type})`;
    return c.description ? `${base} — ${c.description}` : base;
  });
  const columnList = columnParts.join("; ");
  return `${table.table_name} ${table.module_name}: ${table.description} Columns: ${columnList}`.trim();
}

async function seedMetadataEmbeddings() {
  console.log("Seeding schema_registry with embeddings from metadata...\n");

  const firstTable = SCHEMA_METADATA[0];
  if (!firstTable) throw new Error("SCHEMA_METADATA is empty");
  const firstText = textToEmbed(firstTable);
  const firstEmbedding = await getEmbedding(firstText);
  const dim = firstEmbedding.length;
  console.log(`  Embedding dimension: ${dim}`);

  await db("schema_registry").del();
  try {
    await db.raw(
      `ALTER TABLE schema_registry ALTER COLUMN embedding TYPE vector(${dim})`
    );
  } catch {
    // Column may already be correct dimension (e.g. after first run)
  }

  for (let i = 0; i < SCHEMA_METADATA.length; i++) {
    const table = SCHEMA_METADATA[i];
    if (!table) continue;
    const text = textToEmbed(table);
    const embedding =
      i === 0 ? firstEmbedding : await getEmbedding(text);
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

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  seedMetadataEmbeddings()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seedMetadataEmbeddings };
