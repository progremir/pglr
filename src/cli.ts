import { Command } from "commander";
import {
  parseConnectionString,
  saveConnection,
  getConnection,
  setDefaultConnection,
  listConnections,
  removeConnection,
  getDefaultConnectionName,
} from "./config/index.js";
import { createClient, testConnection } from "./db/index.js";
import { QueryEngine } from "./query/index.js";
import { sanitizeError } from "./security/index.js";

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function error(message: string): void {
  output({ success: false, error: message });
  process.exit(1);
}

async function withConnection<T>(
  connectionName: string | undefined,
  allowWrites: boolean,
  fn: (engine: QueryEngine) => Promise<T>
): Promise<T> {
  const connection = getConnection(connectionName);

  if (!connection) {
    const defaultName = getDefaultConnectionName();
    if (defaultName) {
      error(`Connection '${connectionName || defaultName}' not found`);
    } else {
      error("No connection configured. Run: pglayer connect <url>");
    }
    throw new Error("unreachable");
  }

  const db = createClient(connection);
  const engine = new QueryEngine(db, { readOnly: !allowWrites });

  try {
    return await fn(engine);
  } finally {
    await engine.close();
  }
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name("pglr")
    .description("Secure PostgreSQL CLI for AI tools")
    .version("1.0.0");

  program
    .command("connect")
    .description("Save a database connection")
    .argument("<url>", "PostgreSQL connection URL")
    .option("-n, --name <name>", "Connection name", "default")
    .action(async (url: string, options: { name: string }) => {
      try {
        const connection = parseConnectionString(url);
        const result = await testConnection(connection);

        if (!result.success) {
          error(sanitizeError(new Error(result.error)));
          return;
        }

        saveConnection(options.name, connection);
        output({
          success: true,
          message: `Connection saved as '${options.name}'`,
        });
      } catch (err) {
        error(sanitizeError(err));
      }
    });

  program
    .command("use")
    .description("Switch to a different connection")
    .argument("<name>", "Connection name")
    .action((name: string) => {
      if (setDefaultConnection(name)) {
        output({ success: true, message: `Now using '${name}'` });
      } else {
        error(`Connection '${name}' not found`);
      }
    });

  program
    .command("connections")
    .description("List saved connections")
    .action(() => {
      const connections = listConnections();
      output({
        success: true,
        connections: connections.map((c) => ({
          name: c.name,
          default: c.isDefault,
        })),
      });
    });

  program
    .command("disconnect")
    .description("Remove a saved connection")
    .argument("<name>", "Connection name")
    .action((name: string) => {
      if (removeConnection(name)) {
        output({ success: true, message: `Removed '${name}'` });
      } else {
        error(`Connection '${name}' not found`);
      }
    });

  program
    .command("query")
    .description("Execute a SQL query")
    .argument("<sql>", "SQL query to execute")
    .option("-c, --connection <name>", "Use specific connection")
    .option("-p, --params <json>", "Query parameters as JSON array")
    .option("--allow-writes", "Allow write operations", false)
    .action(
      async (
        sql: string,
        options: { connection?: string; params?: string; allowWrites: boolean }
      ) => {
        let params: unknown[] | undefined;
        if (options.params) {
          try {
            const parsed = JSON.parse(options.params);
            if (!Array.isArray(parsed)) {
              error("--params must be a JSON array");
              return;
            }
            params = parsed;
          } catch {
            error("Invalid JSON in --params");
            return;
          }
        }

        const result = await withConnection(
          options.connection,
          options.allowWrites,
          (engine) => engine.execute(sql, params)
        );

        output(result);

        if (!result.success) {
          process.exit(1);
        }
      }
    );

  program
    .command("tables")
    .description("List database tables")
    .option("-c, --connection <name>", "Use specific connection")
    .option("-s, --schema <schema>", "Schema name", "public")
    .action(async (options: { connection?: string; schema: string }) => {
      const tables = await withConnection(options.connection, false, (engine) =>
        engine.listTables(options.schema)
      );
      output({ success: true, tables });
    });

  program
    .command("describe")
    .description("Describe a table structure")
    .argument("<table>", "Table name (can include schema: schema.table)")
    .option("-c, --connection <name>", "Use specific connection")
    .action(async (table: string, options: { connection?: string }) => {
      let schema = "public";
      let tableName = table;

      if (table.includes(".")) {
        const parts = table.split(".");
        if (parts.length !== 2) {
          error("Invalid table format. Use: schema.table or just table");
          return;
        }
        [schema, tableName] = parts;
      }

      const description = await withConnection(
        options.connection,
        false,
        (engine) => engine.describeTable(tableName, schema)
      );
      output({ success: true, ...description });
    });

  program
    .command("schema")
    .description("Get database schema overview")
    .option("-c, --connection <name>", "Use specific connection")
    .option("-s, --schema <schema>", "Schema name", "public")
    .action(async (options: { connection?: string; schema: string }) => {
      const schemaInfo = await withConnection(
        options.connection,
        false,
        (engine) => engine.getSchema(options.schema)
      );
      output({ success: true, ...schemaInfo });
    });

  return program;
}
