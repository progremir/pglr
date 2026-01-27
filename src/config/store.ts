import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  Connection,
  ConnectionSchema,
  ConnectionStore,
  ConnectionStoreSchema,
} from "./schema.js";

const CONFIG_DIR = path.join(os.homedir(), ".pglr");
const CONNECTIONS_FILE = path.join(CONFIG_DIR, "connections.json");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o700 });
  }
}

function loadStore(): ConnectionStore {
  ensureConfigDir();

  if (!fs.existsSync(CONNECTIONS_FILE)) {
    return { default: null, connections: {} };
  }

  const content = fs.readFileSync(CONNECTIONS_FILE, "utf-8");
  return ConnectionStoreSchema.parse(JSON.parse(content));
}

function saveStore(store: ConnectionStore): void {
  ensureConfigDir();

  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

export function parseConnectionString(url: string): Connection {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "Invalid connection URL. Expected: postgres://user:pass@host:port/database"
    );
  }

  const sslMode = parsed.searchParams.get("sslmode");
  const ssl =
    parsed.searchParams.get("ssl") === "true" ||
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full";

  // Only verify certificates for verify-ca and verify-full modes
  // sslmode=require uses SSL but doesn't verify (common for cloud DBs)
  const sslVerify = sslMode === "verify-ca" || sslMode === "verify-full";

  return ConnectionSchema.parse({
    host: parsed.hostname,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl,
    sslVerify,
  });
}

export function saveConnection(name: string, connection: Connection): void {
  const store = loadStore();
  store.connections[name] = connection;

  if (!store.default) {
    store.default = name;
  }

  saveStore(store);
}

export function getConnection(name?: string): Connection | null {
  const store = loadStore();
  const connectionName = name || store.default;

  if (!connectionName) {
    return null;
  }

  return store.connections[connectionName] || null;
}

export function setDefaultConnection(name: string): boolean {
  const store = loadStore();

  if (!store.connections[name]) {
    return false;
  }

  store.default = name;
  saveStore(store);
  return true;
}

export function listConnections(): { name: string; isDefault: boolean }[] {
  const store = loadStore();

  return Object.keys(store.connections).map((name) => ({
    name,
    isDefault: name === store.default,
  }));
}

export function removeConnection(name: string): boolean {
  const store = loadStore();

  if (!store.connections[name]) {
    return false;
  }

  delete store.connections[name];

  if (store.default === name) {
    const remaining = Object.keys(store.connections);
    store.default = remaining.length > 0 ? remaining[0] : null;
  }

  saveStore(store);
  return true;
}

export function getDefaultConnectionName(): string | null {
  const store = loadStore();
  return store.default;
}
