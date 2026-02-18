import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();
const connection = process.env.DATABASE_URL;
if (!connection)
    throw new Error('DATABASE_URL is required in .env');
// Single connection for all DB access (migrations, seeds, sync, and AI query execution)
export const db = knex({
    client: 'pg',
    connection,
});
// AI-generated queries use the same connection (alias for executor.service)
export const readonlyDb = db;
//# sourceMappingURL=database.js.map