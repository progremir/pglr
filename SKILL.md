# pglayer - PostgreSQL CLI for AI Agents

You have access to `pglayer`, a secure PostgreSQL CLI. Use it to query databases without needing connection credentials.

## Prerequisites

A human must first configure a connection:
```bash
pglayer connect postgres://user:pass@host/database
```

If you get "No connection configured", ask the user to run the connect command.

## Commands

### Query the database
```bash
pglayer query "SELECT * FROM users WHERE active = true"
```

With parameters (prevents SQL injection):
```bash
pglayer query "SELECT * FROM users WHERE id = $1" --params '[123]'
```

### List all tables
```bash
pglayer tables
```

### Describe a table's structure
```bash
pglayer describe users
pglayer describe myschema.orders
```

### Get full schema overview
```bash
pglayer schema
```

## Output Format

All commands return JSON:
```json
{
  "success": true,
  "rowCount": 5,
  "rows": [{"id": 1, "name": "Alice"}, ...],
  "executionTimeMs": 12,
  "truncated": false
}
```

On error:
```json
{
  "success": false,
  "error": "Table does not exist"
}
```

## Constraints

- **Read-only by default**: INSERT, UPDATE, DELETE, DROP are blocked
- **Row limit**: Max 1000 rows returned (use LIMIT for smaller results)
- **No credentials access**: You cannot see or modify connection details

## Write Operations

If the user explicitly requests data modification:
```bash
pglayer query "INSERT INTO logs (message) VALUES ($1)" --params '["test"]' --allow-writes
```

Only use `--allow-writes` when the user explicitly asks to modify data.

## Best Practices

1. **Always check table structure first**:
   ```bash
   pglayer describe users
   ```

2. **Use parameters for user input**:
   ```bash
   # Good - parameterized
   pglayer query "SELECT * FROM users WHERE email = $1" --params '["user@example.com"]'

   # Bad - string interpolation (SQL injection risk)
   pglayer query "SELECT * FROM users WHERE email = 'user@example.com'"
   ```

3. **Limit results when exploring**:
   ```bash
   pglayer query "SELECT * FROM large_table LIMIT 10"
   ```

4. **Use schema command to understand the database**:
   ```bash
   pglayer schema
   ```

## Multiple Connections

If multiple databases are configured:
```bash
# List available connections
pglayer connections

# Query specific connection
pglayer query "SELECT 1" --connection prod
pglayer tables --connection staging
```

## Example Workflow

```bash
# 1. Understand the database structure
pglayer schema

# 2. Explore a specific table
pglayer describe orders

# 3. Query data
pglayer query "SELECT id, status, created_at FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT 20" --params '["pending"]'
```
