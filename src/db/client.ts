import pgPromise from "pg-promise";
import { Connection } from "../config/schema.js";

const pgp = pgPromise();

export function createClient(connection: Connection) {
  return pgp({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl
      ? { rejectUnauthorized: connection.sslVerify ?? false }
      : undefined,
  });
}

export async function testConnection(
  connection: Connection
): Promise<{ success: true } | { success: false; error: string }> {
  const db = createClient(connection);
  try {
    await db.one("SELECT 1");
    await db.$pool.end();
    return { success: true };
  } catch (err) {
    await db.$pool.end();
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
