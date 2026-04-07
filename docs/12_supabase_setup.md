# Supabase Setup

## Project Reference
- Project ref: `pxqfnokmxqcilohnsseb`
- Hosted URL: `https://pxqfnokmxqcilohnsseb.supabase.co`

## What this integration does
- Stores each `/analyze` result in `public.analysis_runs`
- Exposes recent runs through `GET /history`
- Keeps the existing sample-based flow working when Supabase is not configured

## Required environment variables
This repository now loads `.env` automatically at server startup.

```powershell
$env:STORAGE_PROVIDER="supabase"
$env:SUPABASE_URL="https://pxqfnokmxqcilohnsseb.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

`.env.example` contains the same structure and local `.env` is gitignored.
If `STORAGE_PROVIDER` is omitted but `SUPABASE_URL` is set, the runtime still auto-detects `supabase` for backward compatibility.

## Database schema
This repository includes:
- `supabase/config.toml`
- `supabase/migrations/20260406132000_create_analysis_runs.sql`
- `supabase/seed.sql`

If you need to push the migration with direct DB credentials:

```powershell
npx.cmd supabase@latest db push --db-url "postgresql://postgres:<DB_PASSWORD>@db.pxqfnokmxqcilohnsseb.supabase.co:5432/postgres?sslmode=require"
```

## Runtime behavior
- `/health` reports whether Supabase storage is enabled
- `/analyze` stores each run when the table exists
- `/history` returns recent saved runs for the dashboard
