const SENSITIVE_PATTERNS = [
  /\bpassword\s*[=:]\s*["']?[^"'\s]+["']?/gi, // word boundary prevents matching "user_password"
  /postgres:\/\/[^@]+@/gi,
  /\bhost\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
];

const ERROR_CODES: Record<string, string> = {
  ECONNREFUSED: "Database connection failed",
  ETIMEDOUT: "Database query timed out",
  "42P01": "Table does not exist",
  "42703": "Column does not exist",
  "42601": "SQL syntax error",
  "28P01": "Authentication failed",
  "3D000": "Database does not exist",
  "28000": "Invalid authorization specification",
};

export function sanitizeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unknown error occurred";
  }

  let message = error.message;

  for (const [code, safeMessage] of Object.entries(ERROR_CODES)) {
    if (message.includes(code)) {
      return safeMessage;
    }
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, "[REDACTED]");
  }

  return message;
}
