export interface QueryResult {
  success: boolean;
  rowCount: number;
  rows: Record<string, unknown>[];
  executionTimeMs: number;
  truncated: boolean;
  error?: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface TableDescription {
  schema: string;
  name: string;
  columns: ColumnInfo[];
}
