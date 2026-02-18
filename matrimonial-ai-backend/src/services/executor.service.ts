import { readonlyDb } from '../config/database.js';

export async function executeMatrimonialQuery(
  sql: string
): Promise<Record<string, unknown>[] | { error: string }> {
  try {
    const result = await readonlyDb.raw(sql);
    const rows = (result as { rows?: Record<string, unknown>[] }).rows;
    return Array.isArray(rows) ? rows : [];
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'Unknown error occurred' };
  }
}