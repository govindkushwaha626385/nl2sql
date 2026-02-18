import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getRelevantContext } from './services/schema.service.js';
import { generateMatrimonialSQL } from './services/planner.service.js';
import { executeMatrimonialQuery } from './services/executor.service.js';
import { getC1ResponseForData } from './services/thesys.service.js';

dotenv.config();

const app = express();
app.use(express.json());

// Execute a raw SQL query and return fetched data (read-only: SELECT only)
app.post('/api/execute', async (req: Request, res: Response) => {
  const { sql: rawSql } = req.body;

  if (!rawSql || typeof rawSql !== 'string') {
    return res.status(400).json({ error: 'Please provide "sql" in the request body.' });
  }

  const sql = rawSql.trim();
  if (!/^\s*SELECT\s+/i.test(sql)) {
    return res.status(400).json({
      error: 'Only SELECT queries are allowed. Use /api/ask for natural language.',
    });
  }

  try {
    const results = await executeMatrimonialQuery(sql);

    if ('error' in results && results.error) {
      return res.status(422).json({
        success: false,
        executed_sql: sql,
        error: results.error,
      });
    }

    const rows = Array.isArray(results) ? results : [];
    res.json({
      success: true,
      executed_sql: sql,
      data: rows,
      results: rows,
      row_count: rows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Execute error:', message);
    res.status(500).json({
      success: false,
      error: 'Failed to execute query.',
      detail: message,
    });
  }
});

// Main endpoint for natural language queries
app.post('/api/ask', async (req: Request, res: Response) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Please provide a matrimonial search question." });
  }

  try {
    // 1. Semantic Retrieval: Find the most relevant tables (out of 38)
    const context = await getRelevantContext(question);
    const schemaContext = JSON.stringify(context);

    // 2. AI Reasoning: Generate the Postgres SQL based on the pruned schema
    const sql = await generateMatrimonialSQL(question, schemaContext);

    // 3. Execution: Run the query on the READ-ONLY database for safety
    const results = await executeMatrimonialQuery(sql);

    if ('error' in results && results.error) {
      return res.status(422).json({
        success: false,
        generated_sql: sql,
        error: results.error,
      });
    }

    const rows = Array.isArray(results) ? results : [];
    let c1_response: string | null = null;
    if (process.env.THESYS_API_KEY) {
      c1_response = await getC1ResponseForData(question, sql, rows);
    }
    res.json({
      success: true,
      generated_sql: sql,
      data: rows,
      results: rows,
      row_count: rows.length,
      ...(c1_response && { c1_response }),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Pipeline Error:", message);
    if (stack) console.error(stack);

    const isRateLimit = /429|quota|rate limit|Too Many Requests/i.test(message);
    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        error: "Gemini API rate limit or quota exceeded. Wait a minute and retry, or check your plan at https://ai.google.dev/gemini-api/docs/rate-limits",
        detail: message.slice(0, 500),
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to process your request. Our AI is learning!",
      detail: message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Matrimonial AI Backend running on port ${PORT}`);
});