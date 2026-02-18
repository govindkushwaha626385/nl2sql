/**
 * Thesys C1 API: turn SQL + data into a C1 response string for dynamic UI rendering.
 * Set THESYS_API_KEY in .env to enable. See https://docs.thesys.dev
 */

const THESYS_API_URL = "https://api.thesys.dev/v1/chat/completions";
const C1_MODEL = process.env.THESYS_C1_MODEL || "c1/anthropic/claude-sonnet-4/v-20250930";

export async function getC1ResponseForData(
  question: string,
  sql: string,
  data: Record<string, unknown>[]
): Promise<string | null> {
  const key = process.env.THESYS_API_KEY;
  if (!key) return null;

  const dataPreview =
    data.length > 0
      ? JSON.stringify(data.slice(0, 50), null, 2)
      : "No rows returned.";
  const prompt = `User question: "${question}"

Executed SQL:
\`\`\`sql
${sql}
\`\`\`

Result set (up to 50 rows; use only these values):
\`\`\`json
${dataPreview}
\`\`\`

Produce a C1 dynamic UI that presents this information accurately and usefully.

Requirements (in order):
1. Narrative first: 2–4 sentences summarizing what the data shows—cite actual numbers and values from the result set (e.g. "Found 12 profiles; 8 in Pune, 4 in Mumbai. Top profession: Engineer (5)."). Tie directly to the user's question. No generic filler; no invented statistics.
2. Visualization (if applicable): If the result has categorical or countable data (e.g. profession, city, gender), add one chart. Bar chart for rankings/comparisons; pie for composition when ≤6 categories. Chart data must be derived from the JSON above: compute counts or sums from the result set and use those exact values in the chart's labels and values. Do not make up numbers.
3. SQL: Include the executed SQL in a code block.
4. Data: Show the result set in a compact table or card list so key columns are readable. Column names and values must match the JSON.
5. Empty results: If the result set is empty or "No rows returned", output only a clear message (e.g. "No profiles match your criteria") and suggest refining the question; do not add a chart or table with fake data.

Efficiency: One narrative + one chart (when useful) + SQL + table is enough. Do not duplicate the same data in multiple formats. Use only valid C1 DSL renderable by C1Component.`;

  try {
    const res = await fetch(THESYS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: C1_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You output only valid C1 (Generative UI) markup, renderable by C1Component. Be accurate and efficient. (1) Narrative: summarize the result set with real numbers and values; no hallucinated stats. (2) Charts: when you add a chart, use type 'chart', variant 'bar'|'pie'|'line', and derive labels and values from the provided result data only. (3) Include the SQL in a code block and the result in a table or list; names and values must match the input. (4) Empty result set: output only a short 'no data' message, no chart or table. (5) One coherent response; no duplicate data across sections. Do not invent columns, rows, or numbers.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Thesys C1 API error:", res.status, err);
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    return content ?? null;
  } catch (e) {
    console.error("Thesys C1 request failed:", e);
    return null;
  }
}
