import { generateText } from './ai.service.js';
export async function generateMatrimonialSQL(question, schemaContext) {
    const prompt = `
You are an expert Matrimonial Data Analyst.

CONTEXT (Relevant Tables):
${schemaContext}

USER QUESTION: "${question}"

RULES:
1. Use ONLY the provided tables.
2. Use INNER JOINs for relationships.
3. Use table aliases (e.g., p for profiles).
4. Return ONLY the SQL query, no markdown, no explanation, no backticks.
5. Limit results to 50 for safety.
6. For text/string comparisons (e.g. gender, religion, marital_status), use case-insensitive matching: LOWER(column) = LOWER('value') or column ILIKE 'value', so that 'male' matches 'Male', etc.
`.trim();
    const text = await generateText(prompt);
    return text.replace(/^```\w*\n?|```\s*$/g, '').trim();
}
//# sourceMappingURL=planner.service.js.map