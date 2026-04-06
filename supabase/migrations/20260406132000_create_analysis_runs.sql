create extension if not exists pgcrypto with schema extensions;

create table if not exists public.analysis_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  source text not null check (source in ('sample', 'custom')),
  total_changes integer not null check (total_changes >= 0),
  high_risk_change_count integer not null check (high_risk_change_count >= 0),
  change_type_breakdown jsonb not null default '{}'::jsonb,
  input_payload jsonb not null,
  response_payload jsonb not null
);

create index if not exists analysis_runs_created_at_idx on public.analysis_runs (created_at desc);
create index if not exists analysis_runs_source_idx on public.analysis_runs (source);

alter table public.analysis_runs enable row level security;
