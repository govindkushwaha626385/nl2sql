import { readonlyDb } from '../config/database.js';
export async function executeMatrimonialQuery(sql) {
    try {
        const result = await readonlyDb.raw(sql);
        const rows = result.rows;
        return Array.isArray(rows) ? rows : [];
    }
    catch (error) {
        if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: 'Unknown error occurred' };
    }
}
//# sourceMappingURL=executor.service.js.map