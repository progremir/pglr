const WRITE_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "COPY",
];

const DANGEROUS_PATTERNS = [
  /pg_sleep/i,
  /pg_read_file/i,
  /pg_write_file/i,
  /lo_import/i,
  /lo_export/i,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Remove comments and string literals from SQL to prevent bypass attacks.
 * This allows us to check for write keywords without false positives from
 * strings like 'DELETE' or comments containing write operations.
 */
function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/'[^']*'/g, "''")        // string literals (preserve placeholder)
    .replace(/"[^"]*"/g, '""');       // quoted identifiers (preserve placeholder)
}

export function validateReadOnly(sql: string): ValidationResult {
  // Strip comments and strings to prevent bypass via:
  // - "WITH cte AS (DELETE FROM x) SELECT..."
  // - "EXPLAIN DELETE FROM..."
  // - "-- comment\nDELETE FROM..."
  const cleaned = stripCommentsAndStrings(sql).toUpperCase();

  // Check for write keywords anywhere in the cleaned query
  for (const keyword of WRITE_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(cleaned)) {
      return {
        valid: false,
        error: `Write operation '${keyword}' not allowed in read-only mode`,
      };
    }
  }

  // Check for dangerous PostgreSQL functions
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        valid: false,
        error: "Query contains potentially dangerous pattern",
      };
    }
  }

  return { valid: true };
}
