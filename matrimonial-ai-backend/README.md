# Matrimonial AI Backend

NL2SQL backend for the matrimonial database: natural language → SQL → results.

## Do I need to run table creation in pgAdmin?

**No.** All tables are created by Knex migrations. You only need to:

1. **Create the database** in pgAdmin (or psql) if it doesn’t exist:
   - Database name: e.g. `matrimony_db` (or whatever you set in `.env`).

2. **Run migrations** (this creates the `vector` extension and all 38+ tables):

   ```bash
   npm run migrate
   ```

That’s it. No need to run any `CREATE TABLE` or schema SQL by hand in pgAdmin.

---

## Setup

1. **Prerequisites**
   - Node 18+
   - PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) (for vector search).

2. **Create the database** (if needed)
   - In pgAdmin: create a database, e.g. `matrimony_db`.
   - Or: `psql -U postgres -c "CREATE DATABASE matrimony_db;"`

3. **Environment**
   - Copy `.env` and set at least:
     - `DATABASE_URL` – e.g. `postgres://user:password@localhost:5432/matrimony_db`
   - **Option A – Ollama (local, no API key):**
     - `OLLAMA_BASE_URL=http://localhost:11434` (default)
     - `OLLAMA_MODEL=llama3.2` (or `llama3`, `mistral`, etc.)
     - `OLLAMA_EMBEDDING_MODEL=nomic-embed-text` (for schema embeddings)
     - Run: `ollama run llama3.2` and `ollama run nomic-embed-text` once to pull models.
   - **Option B – Google Gemini (cloud):**
     - `GEMINI_KEY` – your API key
     - Optional: `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`
   - **Option C – Thesys C1 (dynamic UI):** Optional. If set, the `/api/ask` response includes a `c1_response` string that the frontend can render with Thesys C1Component (tables, cards, etc.).
     - `THESYS_API_KEY` – your Thesys API key from [console.thesys.dev/keys](https://console.thesys.dev/keys)
     - Optional: `THESYS_C1_MODEL` (default: `c1/anthropic/claude-sonnet-4/v-20250930`)
   - If both are set, **Ollama is used** (OLLAMA_BASE_URL wins).

4. **Install and migrate**
   ```bash
   npm install
   npm run migrate
   npm run seed
   ```

5. **Schema embeddings (for NL2SQL context)**  
   The app uses **vector search** on `schema_registry` to pick relevant tables. Populate it from the hardcoded metadata (one-time; uses Ollama or Gemini depending on env):
   ```bash
   npm run seed-embeddings
   ```
   With Ollama: ensure `nomic-embed-text` is pulled (`ollama run nomic-embed-text`). If you skip this step, the app falls back to the first 5 tables.

6. **Run the app**
   ```bash
   npm run dev
   ```
   API: `POST /api/ask` with body `{ "question": "your natural language question" }`.

## Scripts

| Script         | Description                          |
|----------------|--------------------------------------|
| `npm run dev`  | Start dev server (tsx + nodemon)     |
| `npm run build`| Compile TypeScript to `dist/`        |
| `npm start`    | Run production build                 |
| `npm run migrate` | Run migrations (creates all tables) |
| `npm run seed` | Seed sample profiles                  |
| `npm run seed-embeddings` | Create and save metadata embeddings in Postgres (run once) |
| `npm run sync` | (Optional) Legacy: populate schema_registry from DB introspection |
| `npm run test-query` | One-off NL2SQL test (no server)  |

## Quick test

```bash
npm run migrate
npm run seed
npm run sync
npm run test-query
```

Then start the server and call:

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How many male profiles are there?"}'
```
