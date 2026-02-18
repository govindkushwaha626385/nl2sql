# Matrimonial NL2SQL Frontend

React + Vite + TypeScript frontend for the Matrimonial AI backend. Enter a question in plain English; the app shows the generated SQL and the data returned from the database.

## Stack

- **React 19** + **Vite 7** + **TypeScript**
- **Tailwind CSS** for styling
- **Thesys C1** (`@thesysai/genui-sdk`, `@crayonai/react-ui`) for dynamic UI when the backend returns a C1 response
- Fallback table: columns and rows from the API when no C1 response

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend (from `matrimonial-ai-backend`):
   ```bash
   npm run dev
   ```

3. Start the frontend (from `frontend`):
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173). In development, Vite proxies `/api` to `http://localhost:3000`, so no extra env is needed.

## Usage

- Type a question (e.g. *List doctors in Mumbai*, *How many male profiles?*) and click **Ask**.
- The UI shows:
  - **Dynamic UI (Thesys C1)** – when the backend has `THESYS_API_KEY` set, the API returns a `c1_response` that is rendered here (tables, cards, etc.).
  - **Generated SQL** – the query that was run
  - **Results** – table of rows (fallback when no C1 or in addition to C1).

## Env

- `VITE_API_URL` – optional; set if the backend is not on the same origin (e.g. production). Leave unset in dev to use the Vite proxy.
