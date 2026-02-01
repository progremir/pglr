import { IDatabase } from "pg-promise";
import { validateReadOnly } from "../security/read-only.js";
import { sanitizeError } from "../security/sanitizer.js";
import { QueryResult, TableInfo, TableDescription, ColumnInfo } from "./types.js";

export class QueryEngine {
  private db: IDatabase<unknown>;
  private maxRows: number;
  private readOnly: boolean;

  constructor(
    db: IDatabase<unknown>,
    options: { maxRows?: number; readOnly?: boolean } = {}
  ) {
    this.db = db;
    this.maxRows = options.maxRows ?? 1000;
    this.readOnly = options.readOnly ?? true;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();

    if (this.readOnly) {
      const validation = validateReadOnly(sql);
      if (!validation.valid) {
        return {
          success: false,
          rowCount: 0,
          rows: [],
          executionTimeMs: Date.now() - startTime,
          truncated: false,
          error: validation.error,
        };
      }
    }

    try {
      // Check if this is a write operation (INSERT, UPDATE, DELETE)
      const isWriteOp = /^\s*(INSERT|UPDATE|DELETE|WITH\s+.*\s+(INSERT|UPDATE|DELETE))/i.test(sql);

      if (isWriteOp) {
        // Use db.result() for write operations to get affected row count
        const result = await this.db.result(sql, params);
        return {
          success: true,
          rowCount: 0,
          rows: [],
          executionTimeMs: Date.now() - startTime,
          truncated: false,
          affectedRows: result.rowCount,
        };
      } else {
        // Use db.any() for SELECT queries
        // Fetch one extra row to detect truncation accurately
        const limitedSql = this.enforceLimit(sql, this.maxRows + 1);
        const rows = await this.db.any(limitedSql, params);

        // If we got more than maxRows, there are more results
        const truncated = rows.length > this.maxRows;
        const limitedRows = rows.slice(0, this.maxRows);

        return {
          success: true,
          rowCount: limitedRows.length,
          rows: limitedRows,
          executionTimeMs: Date.now() - startTime,
          truncated,
        };
      }
    } catch (error) {
      return {
        success: false,
        rowCount: 0,
        rows: [],
        executionTimeMs: Date.now() - startTime,
        truncated: false,
        error: sanitizeError(error),
      };
    }
  }

  async listTables(schema = "public"): Promise<TableInfo[]> {
    const sql = `
      SELECT
        schemaname as schema,
        tablename as name,
        'table' as type
      FROM pg_tables
      WHERE schemaname = $1
      UNION ALL
      SELECT
        schemaname as schema,
        viewname as name,
        'view' as type
      FROM pg_views
      WHERE schemaname = $1
      ORDER BY name
    `;

    const rows = await this.db.any(sql, [schema]);
    return rows as TableInfo[];
  }

  async describeTable(table: string, schema = "public"): Promise<TableDescription> {
    const columnsQuery = `
      SELECT
        c.column_name as name,
        c.data_type as type,
        c.is_nullable = 'YES' as nullable,
        c.column_default as "defaultValue",
        COALESCE(pk.is_pk, false) as "isPrimaryKey"
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name, true as is_pk
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1 AND tc.table_name = $2
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `;

    const columns = await this.db.any(columnsQuery, [schema, table]);

    return {
      schema,
      name: table,
      columns: columns as ColumnInfo[],
    };
  }

  async getSchema(schema = "public"): Promise<{ tables: { name: string; columns: string[] }[] }> {
    const sql = `
      SELECT
        t.table_name as name,
        array_agg(c.column_name ORDER BY c.ordinal_position) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `;

    const rows = await this.db.any(sql, [schema]);
    return { tables: rows };
  }

  async close(): Promise<void> {
    await this.db.$pool.end();
  }

  private enforceLimit(sql: string, limit: number): string {
    // Match LIMIT with number, ALL, or parameter placeholder
    const limitMatch = sql.match(/\bLIMIT\s+(\d+|ALL|\$\d+)/i);

    if (limitMatch) {
      const value = limitMatch[1].toUpperCase();

      if (value === "ALL") {
        // Replace LIMIT ALL with our enforced limit
        return sql.replace(/\bLIMIT\s+ALL/i, `LIMIT ${limit}`);
      }

      // Check if it's a numeric value that exceeds our limit
      const parsed = parseInt(value);
      if (!isNaN(parsed) && parsed > limit) {
        // Replace excessive LIMIT with our enforced limit
        return sql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${limit}`);
      }

      // Existing limit is acceptable
      return sql;
    }

    // No LIMIT clause - add one for SELECT queries
    if (/^\s*SELECT/i.test(sql)) {
      return `${sql.replace(/;\s*$/, "")} LIMIT ${limit}`;
    }

    return sql;
  }
}

export * from "./types.js";
