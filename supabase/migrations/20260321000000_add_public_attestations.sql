-- Public attestation records — stores EAS attestation metadata for the public explorer.
-- No PII: only agent names, categories, field counts, and on-chain references.
create table if not exists public_attestations (
  id              uuid primary key default gen_random_uuid(),
  eas_uid         text,
  tx_hash         text not null,
  agent_name      text not null,
  category        text not null,
  approved_count  integer not null default 0,
  denied_count    integer not null default 0,
  purpose         text,
  basescan_url    text,
  created_at      timestamptz not null default now()
);

create index if not exists public_attestations_created_at_idx on public_attestations (created_at desc);

-- Anyone can read; only authenticated callers (via service key) can insert
alter table public_attestations enable row level security;

create policy "public_attestations_select"
  on public_attestations for select
  to anon
  using (true);

create policy "public_attestations_insert"
  on public_attestations for insert
  to anon
  with check (true);
