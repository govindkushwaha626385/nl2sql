# Matrimonial NL2SQL — Project Overview

This document explains **how the project works** and **where the code lives**, so you can understand and extend it.

---

## What the project does

Users ask questions in **plain English** (e.g. “List doctors in Mumbai”, “Show all divorced profiles”). The app:

1. **Finds relevant database tables** using semantic search (embeddings).
2. **Generates PostgreSQL SQL** from the question using an LLM (Gemini or Ollama).
3. **Runs the query** on a read-only database and returns rows.
4. **Shows results** in the UI: summary, charts, analysis, and a data table. Optionally, Thesys C1 can render a dynamic UI (charts, cards) from the same data.

So: **Natural language → SQL → execution → visualization.**

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, port 5173)                                          │
│  • Chat UI: user messages + assistant replies                                │
│  • Each reply: Analysis block, Charts (Recharts), Table, optional C1 UI      │
│  • Calls: POST /api/ask with { question }                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express, port 3000)                                                │
│  app.ts                                                                      │
│  • POST /api/ask   → full NL2SQL pipeline (schema → SQL → execute → C1)       │
│  • POST /api/execute → run raw SELECT only (for debugging)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│ schema.service  │          │ planner.service │          │ executor.service │
│ (embeddings +   │          │ (LLM → SQL)     │          │ (run SQL on DB)  │
│  vector search) │          │                 │          │                  │
└────────┬────────┘          └────────┬────────┘          └────────┬────────┘
         │                             │                            │
         ▼                             ▼                            ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│ ai.service      │          │ ai.service      │          │ PostgreSQL      │
│ (embedding)     │          │ (generateText)  │          │ (read-only)     │
└─────────────────┘          └─────────────────┘          └─────────────────┘
         │                             │
         │                    Optional: thesys.service
         │                    (C1 API → dynamic UI JSON)
         │
         ▼
┌─────────────────┐
│ Ollama or       │
│ Gemini API      │
└─────────────────┘
```

---

## Backend (matrimonial-ai-backend)

### Entry point: `src/app.ts`

- **POST /api/ask** (main flow):
  1. Reads `question` from body; returns 400 if missing.
  2. **getRelevantContext(question)** → list of relevant tables + columns (for the prompt).
  3. **generateMatrimonialSQL(question, schemaContext)** → one PostgreSQL `SELECT` string.
  4. **executeMatrimonialQuery(sql)** → runs the SQL; returns rows or `{ error }`.
  5. If execution failed → responds with `success: false`, `generated_sql`, `error`.
  6. If success → optionally **getC1ResponseForData(question, sql, rows)** when `THESYS_API_KEY` is set.
  7. Responds with `success: true`, `generated_sql`, `data`/`results`, `row_count`, and optionally `c1_response`.

- **POST /api/execute**: body `{ sql }`. Validates that it’s a `SELECT`; runs it and returns `data`/`results`/`row_count`. Used for running raw SQL (e.g. debugging).

- Errors (e.g. LLM or DB failure) are caught; rate-limit–style messages from Gemini get a 429; others get 500 with a generic message and optional `detail`.

### Config: `src/config/database.ts`

- Reads `DATABASE_URL` from env; exports **knex** `db` (and `readonlyDb` as same connection). All DB access (migrations, seeds, schema_registry, query execution) uses this.

### Services (all under `src/services/`)

| File | Role |
|------|------|
| **schema.service.ts** | **getRelevantContext(question)**. Gets an embedding of the question via **ai.service.getEmbedding**, then runs a vector search on `schema_registry` (`embedding <=> ?::vector LIMIT 5`). Returns the top 5 tables with their descriptions and columns (from **schema-metadata**). If no rows (e.g. embeddings not seeded), falls back to first 5 tables from metadata. |
| **planner.service.ts** | **generateMatrimonialSQL(question, schemaContext)**. Builds a prompt with the schema context + strict rules (aliases p, c, pl, ed, sb, fd, lh; FROM profiles p + JOINs; WHERE from question only; LIMIT 50). Calls **ai.service.generateText**, strips markdown/code fences, returns the SQL string. |
| **executor.service.ts** | **executeMatrimonialQuery(sql)**. Uses **readonlyDb.raw(sql)**. On success returns array of rows; on exception returns `{ error: message }`. |
| **ai.service.ts** | **getEmbedding(text)** and **generateText(prompt)**. If `OLLAMA_BASE_URL` is set, delegates to **ollama.service**; otherwise uses **Gemini** (env: `GEMINI_KEY`, optional `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL`). |
| **ollama.service.ts** | Implements embed and generate using local Ollama API (e.g. for local LLM + embeddings). |
| **thesys.service.ts** | **getC1ResponseForData(question, sql, data)**. Only runs if `THESYS_API_KEY` is set. Sends question + SQL + data preview to Thesys C1 API; returns the C1 response string (for charts, tables, analysis) or null on failure. |

### Schema and metadata

- **src/db/metadata/schema-metadata.ts**: Defines **SCHEMA_METADATA** (tables, columns, descriptions). Used by schema.service to resolve table/column info after vector search and to fallback when no embeddings exist.
- **schema_registry**: DB table that stores table_name, description, module_name, and an **embedding** vector. Populated by scripts (e.g. **seed-metadata-embeddings.ts**) so that **getRelevantContext** can do vector similarity search.

### Scripts (typical usage)

- **seed-metadata-embeddings.ts**: Generates embeddings for each table’s metadata and upserts into `schema_registry`. Run so that semantic retrieval works.
- Migrations and seeds live under **src/db/** and define the matrimonial schema (profiles, career_details, profile_locations, etc.) and sample data.

---

## Frontend (frontend)

### Entry and shell

- **src/main.tsx**: Renders `<ThemeProvider>` (Thesys) and `<App />`; imports C1 and app styles.
- **src/App.tsx**: Chat UI and the only page: header, message list, input at bottom.

### App.tsx — Chat and API

- **State**: `input`, `loading`, `messages[]`. Each message has `id`, `role` ('user' | 'assistant'), `content`, and optionally `response` (full **AskResponse**).
- **sendMessage()**: On submit, appends a user message, sets loading, then:
  - **POST** `VITE_API_URL/api/ask` with `{ question: text }`.
  - On success: appends assistant message with `content` (e.g. “Found N result(s)”) and `response` (full JSON).
  - On error: appends assistant message with error text and `response: { success: false, error }`.
  - Always clears loading and focuses input.
- **Layout**: Header; scrollable message list (user bubbles right, assistant left); fixed input at bottom (textarea + Send). Scrolls to bottom when messages/loading change.

### Rendering assistant replies: MessageContent

For each assistant message, **MessageContent** uses `msg.response`:

- If **!res.success**: shows error and optional detail.
- If **res.success**:
  - Short text: `msg.content` (e.g. “Found N result(s)”).
  - If **res.c1_response**: renders **&lt;C1Component c1Response={...} /&gt;** (Thesys dynamic UI).
  - If **res.generated_sql**: collapsible **&lt;details&gt;** with the SQL.
  - If there are rows: **&lt;DataCharts rows columns /&gt;** then a **results table**.

So: **Analysis + Charts (DataCharts) + Table** are always driven by the same `data`/`results`; C1 is an extra layer when the backend sends `c1_response`.

### DataCharts.tsx

- **Input**: `rows` (array of objects), `columns` (string[]).
- **Logic**: Infers numeric vs categorical columns; builds chart data (e.g. group by first categorical, sum or count; limit to 12). Computes a short **analysis** string (row count, top categories, optional average of first numeric).
- **Output**: An “Analysis” text block and one chart: **PieChart** when few categories and no numeric series, otherwise **BarChart** (Recharts). So data is visible as both **analysis + chart** and **table** in the message.

---

## Data flow (one question end-to-end)

1. User types a question and hits Send.
2. Frontend sends **POST /api/ask** with `{ question }`.
3. Backend:
   - **getRelevantContext(question)** → embedding of question → vector search in `schema_registry` → top 5 tables + columns as JSON string.
   - **generateMatrimonialSQL(question, schemaContext)** → LLM returns one SQL string (FROM profiles p + JOINs + WHERE + LIMIT 50).
   - **executeMatrimonialQuery(sql)** → knex runs SQL; returns rows or error.
   - If error: response `{ success: false, generated_sql, error }`. If success: optionally **getC1ResponseForData(...)**; response `{ success: true, generated_sql, data, results, row_count, c1_response? }`.
4. Frontend appends an assistant message with that response.
5. **MessageContent** renders: summary text, optional C1 UI, SQL (details), **DataCharts** (analysis + chart), and the results table.

---

## Environment (what you need)

**Backend (.env):**

- **DATABASE_URL**: PostgreSQL connection string (required).
- **GEMINI_KEY**: Required if not using Ollama (for embeddings + text generation).
- **OLLAMA_BASE_URL**: If set, use Ollama for embeddings and generation instead of Gemini.
- **THESYS_API_KEY**: Optional; when set, backend calls Thesys C1 and returns `c1_response`.
- **PORT**: Server port (default 3000).

**Frontend (.env):**

- **VITE_API_URL**: Backend base URL (e.g. `http://localhost:3000`) for `/api/ask` and `/api/execute`.

---

## Updating schema metadata and embeddings

- **Table metadata** (names, descriptions, columns) lives in **matrimonial-ai-backend/src/db/metadata/schema-metadata.ts**. Edit `description` and/or `columns` there to improve NL2SQL context (e.g. add keywords like "gender", "profession", "city" so semantic search and the planner use the right tables).
- After changing **schema-metadata.ts**, refresh the vector embeddings so `getRelevantContext()` stays in sync:
  - From the backend directory: **`npm run seed-embeddings`** or **`npx tsx src/scripts/seed-metadata-embeddings.ts`**.
  - This rewrites embeddings in the **schema_registry** table from the current metadata. No need to change the DB schema.

---

## Summary

- **Backend**: Express app with two routes; NL2SQL pipeline = schema (vector) → planner (LLM) → executor (DB) → optional C1. All AI goes through **ai.service** (Ollama or Gemini).
- **Frontend**: Single chat page; one API call per question; each reply shows analysis, charts (DataCharts), table, and optionally C1 UI.
- **Data and charts** appear when the SQL runs successfully and returns rows; if the SQL is invalid or execution fails, only the error (and optionally generated_sql) is shown.

Use this as a map: **app.ts** = request flow; **schema / planner / executor / ai / thesys** = pipeline steps; **App.tsx** + **MessageContent** + **DataCharts** = how results and visualizations are rendered.
