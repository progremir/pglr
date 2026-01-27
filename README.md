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

### As a CLI tool

```bash
npm install -g pglr
```

### As a Claude Code skill

```bash
# Install skill from GitHub
npx skills add progremir/pglr

# Or install with a specific version
npx skills add progremir/pglr@1.0.0
```

After installing as a skill, Claude Code can use `pglr` commands directly when working with PostgreSQL databases.

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

## AI Agent Examples

Once installed as a skill, AI agents can query your database naturally. Here are example interactions:

### Data exploration

**User:** "What tables are in the database?"

**Agent runs:**
```bash
pglr tables
```

**User:** "Show me the structure of the orders table"

**Agent runs:**
```bash
pglr describe orders
```

### Querying data

**User:** "Find all pending orders from the last week"

**Agent runs:**
```bash
pglr query "SELECT id, customer_id, total, created_at FROM orders WHERE status = $1 AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC" --params '["pending"]'
```

### Data analysis

**User:** "What's the average order value by customer segment?"

**Agent runs:**
```bash
pglr query "SELECT c.segment, AVG(o.total) as avg_order_value, COUNT(*) as order_count FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.segment ORDER BY avg_order_value DESC"
```

### Write operations (when explicitly requested)

**User:** "Mark order #1234 as shipped"

**Agent runs:**
```bash
pglr query "UPDATE orders SET status = $1, shipped_at = NOW() WHERE id = $2" --params '["shipped", 1234]' --allow-writes
```

### Multi-step workflows

**User:** "Analyze why we had low sales yesterday"

**Agent workflow:**
```bash
# 1. Check overall sales volume
pglr query "SELECT COUNT(*), SUM(total) FROM orders WHERE created_at::date = CURRENT_DATE - 1"

# 2. Compare to previous days
pglr query "SELECT created_at::date as day, COUNT(*) as orders, SUM(total) as revenue FROM orders WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day"

# 3. Check for any errors or issues
pglr query "SELECT status, COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE - 1 GROUP BY status"
```

## Security

- Credentials stored in `~/.pglr/connections.json` with 600 permissions
- Read-only by default (writes require `--allow-writes` flag)
- Errors are sanitized to prevent credential leakage
- Row limit of 1000 to prevent runaway queries

## License

MIT
