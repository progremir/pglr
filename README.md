# pglr

Secure PostgreSQL CLI for AI tools. Connect once, query forever.

## Problem

AI tools (Claude, GPT, etc.) need database access but shouldn't have credentials. Connection strings in prompts or tool configs are a security risk.

## Solution

`pglr` stores credentials locally. AI tools run queries without seeing connection details.

```bash
# You (human) connect once
pglr connect postgres://user:pass@host/db

# AI tool queries - no credentials anywhere
pglr query "SELECT * FROM users LIMIT 10"
```

## Install

```bash
npm install -g pglr
```

## Usage

### Connect to a database

```bash
pglr connect postgres://user:pass@localhost/mydb
pglr connect "postgres://user:pass@host/db?sslmode=require"
pglr connect --name prod postgres://...
pglr connect --name staging postgres://...
```

### Run queries

```bash
pglr query "SELECT * FROM users"
pglr query "SELECT * FROM users WHERE id = $1" --params '[123]'
pglr query "INSERT INTO logs (msg) VALUES ($1)" --params '["test"]' --allow-writes
```

### Explore schema

```bash
pglr tables
pglr describe users
pglr schema
```

### Manage connections

```bash
pglr connections
pglr use prod
pglr disconnect staging
```

## Output

All commands return JSON:

```json
{
  "success": true,
  "rowCount": 2,
  "rows": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}],
  "executionTimeMs": 12,
  "truncated": false
}
```

## Security

- Credentials stored in `~/.pglr/connections.json` with 600 permissions
- Read-only by default (writes require `--allow-writes` flag)
- Errors are sanitized to prevent credential leakage
- Row limit of 1000 to prevent runaway queries

## License

MIT
