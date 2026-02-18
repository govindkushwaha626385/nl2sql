/**
 * Hardcoded schema metadata for the matrimonial database.
 * Complete list of tables, columns, and descriptions for NL2SQL context.
 * Excludes schema_registry and semantic_cache from NL2SQL retrieval (system tables).
 */
export interface ColumnMeta {
    name: string;
    data_type: string;
}
export interface TableMeta {
    table_name: string;
    module_name: string;
    description: string;
    columns: ColumnMeta[];
}
export declare const SCHEMA_METADATA: TableMeta[];
/** Tables used for NL2SQL context (exclude system tables). */
export declare const NL2SQL_TABLE_NAMES: Set<string>;
//# sourceMappingURL=schema-metadata.d.ts.map