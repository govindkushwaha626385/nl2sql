import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getRelevantContext } from './services/schema.service.js';
import { generateMatrimonialSQL, generateCorrectedSQL, extractIntentFromQuestion } from './services/planner.service.js';
import { executeMatrimonialQuery } from './services/executor.service.js';
import { getC1ResponseForData } from './services/thesys.service.js';
import { validateAndFixSql } from './services/sql-validator.service.js';
import { sqlToSupabaseQuery } from './services/supabase-query.service.js';

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
    // 1. Semantic retrieval + intent extraction in parallel
    const [context, intentResult] = await Promise.all([
      getRelevantContext(question),
      extractIntentFromQuestion(question),
    ]);
    const extracted_intent = intentResult.intents;
    const schemaContext = JSON.stringify(context);

    type Usage = { input: number; output: number; total: number };
    const tokenUsage: { input: number; output: number; total: number; steps?: Record<string, Usage> } = { input: 0, output: 0, total: 0, steps: {} };
    function addUsage(label: string, u?: Usage) {
      if (!u) return;
      tokenUsage.input += u.input;
      tokenUsage.output += u.output;
      tokenUsage.total += u.total;
      if (tokenUsage.steps) tokenUsage.steps[label] = u;
    }
    addUsage('intent_extraction', intentResult.usage);

    const MAX_CORRECTION_ATTEMPTS = 3;
    const sqlResult = await generateMatrimonialSQL(question, schemaContext, extracted_intent);
    let sql = sqlResult.sql;
    addUsage('sql_generation', sqlResult.usage);

    // Validation layer: auto-fix common issues and validate before execution
    const validation = validateAndFixSql(sql, extracted_intent);
    sql = validation.sql;
    let results: Record<string, unknown>[] | { error: string };
    if (!validation.valid && validation.error) {
      results = { error: validation.error };
    } else if (extracted_intent.length > 0 && !/\bWHERE\b/i.test(sql)) {
      results = { error: "Missing WHERE clause. Add a WHERE clause with one condition per extracted intent (e.g. profession → c.profession, city → pl.city, income → c.annual_income, religion → sb.religion, caste → sb.caste, mother_tongue → p.mother_tongue). Use only JOINs needed for those filters." };
    } else {
      results = await executeMatrimonialQuery(sql);
    }
    let attempts = 1;

    // 2. Query correction loop: if execution failed (or missing WHERE), fix SQL using extracted intent and re-run
    while ('error' in results && results.error && attempts < MAX_CORRECTION_ATTEMPTS) {
      const correctedResult = await generateCorrectedSQL(question, schemaContext, sql, results.error, extracted_intent);
      sql = correctedResult.sql;
      addUsage('sql_correction', correctedResult.usage);
      const revalidate = validateAndFixSql(sql, extracted_intent);
      sql = revalidate.sql;
      if (!revalidate.valid && revalidate.error) {
        results = { error: revalidate.error };
      } else {
        results = await executeMatrimonialQuery(sql);
      }
      attempts++;
    }

    if ('error' in results && results.error) {
      return res.status(422).json({
        success: false,
        generated_sql: sql,
        supabase_query: sqlToSupabaseQuery(sql),
        error: results.error,
        extracted_intent,
        token_usage: tokenUsage.input + tokenUsage.output > 0 ? tokenUsage : undefined,
      });
    }

    const rows = Array.isArray(results) ? results : [];
    let c1_response: string | null = null;
    if (process.env.THESYS_API_KEY) {
      const c1Result = await getC1ResponseForData(question, sql, rows);
      c1_response = c1Result?.c1Response ?? null;
      addUsage('c1_response', c1Result?.usage);
    }
    res.json({
      success: true,
      generated_sql: sql,
      supabase_query: sqlToSupabaseQuery(sql),
      data: rows,
      results: rows,
      row_count: rows.length,
      extracted_intent: extracted_intent,
      ...(tokenUsage.input + tokenUsage.output > 0 && { token_usage: tokenUsage }),
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