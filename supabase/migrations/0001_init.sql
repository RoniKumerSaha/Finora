-- Finora V1 — cloud-sync schema.
--
-- One row per user. The row holds the entire State blob as JSONB so
-- cross-device sync can use a single write per mutation instead of
-- fanning out to multiple entity tables. RLS scopes every read/write/
-- delete to auth.uid() so users can only see their own data.
--
-- The updated_at column is maintained by a server-side trigger so
-- last-write-wins reconciliation can trust the server's clock
-- instead of the client's.

create table if not exists public.finora_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  version    int          not null default 1,
  payload    jsonb        not null,
  updated_at timestamptz  not null default now()
);

-- RLS — each user can only read/write/delete their own row.
alter table public.finora_state enable row level security;

drop policy if exists "own read"   on public.finora_state;
drop policy if exists "own write"  on public.finora_state;
drop policy if exists "own delete" on public.finora_state;

create policy "own read"
  on public.finora_state
  for select
  using (auth.uid() = user_id);

create policy "own write"
  on public.finora_state
  for insert
  with check (auth.uid() = user_id);

create policy "own update"
  on public.finora_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own delete"
  on public.finora_state
  for delete
  using (auth.uid() = user_id);

-- Server-trusted updated_at. Client can write the row but never the
-- clock — reconciliation uses this value when the client's
-- stateUpdatedAt is equal across both sides.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch on public.finora_state;

create trigger trg_touch
  before update on public.finora_state
  for each row execute function public.touch_updated_at();
