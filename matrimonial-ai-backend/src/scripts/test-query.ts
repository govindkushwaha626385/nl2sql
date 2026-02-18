// src/scripts/test-query.ts
import { getRelevantContext } from '../services/schema.service.js';
import { generateMatrimonialSQL } from '../services/planner.service.js';
import { executeMatrimonialQuery } from '../services/executor.service.js';

async function runTest() {
  const userQuestion = "Find Brahmin doctors in Mumbai earning more than 15 LPA";
  
  console.log(`\n🔎 User Question: ${userQuestion}`);

  try {
    // 1. Retrieve only the relevant tables (Semantic Search)
    const context = await getRelevantContext(userQuestion);
    console.log(`\n📚 Pruned Schema (Tables picked):`, context.map(c => c.table_name));

    // 2. Generate the SQL using Reasoning
    const sql = await generateMatrimonialSQL(userQuestion, JSON.stringify(context));
    console.log(`\n🤖 Generated SQL:\n${sql}`);

    // 3. Execute securely
    const results = await executeMatrimonialQuery(sql);

    if ('error' in results && results.error) {
      console.error(`\n❌ Execution Error: ${results.error}`);
    } else {
      const rows = results as Record<string, unknown>[];
      console.log(`\n✅ Found ${rows.length} matches!`);
      console.table(rows.slice(0, 5));
    }

  } catch (error) {
    console.error("Pipeline Failed:", error);
  } finally {
    process.exit(0);
  }
}

runTest();