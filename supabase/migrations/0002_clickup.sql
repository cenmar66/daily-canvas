-- The Daily Canvas: ClickUp connection. Safe to run more than once; never deletes data.
-- Run after 0001_daily_canvas.sql (Supabase → SQL Editor → paste → Run).

-- The ClickUp personal API token is AES-GCM encrypted by the server before it is stored.
-- The browser never sees it (this table is not part of device sync).
create table if not exists public.canvas_clickup_accounts (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token_enc text not null,
  clickup_user_id bigint,
  clickup_username text,
  clickup_email text,
  teams jsonb not null default '[]'::jsonb,   -- [{id, name}] workspaces the token can see
  team_id text,                               -- the workspace in use
  settings jsonb not null default '{}'::jsonb,
  last_sync timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canvas_clickup_accounts enable row level security;
drop policy if exists "owner only" on public.canvas_clickup_accounts;
create policy "owner only" on public.canvas_clickup_accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- "Delete my data" now also forgets the ClickUp connection.
create or replace function public.canvas_delete_my_data()
returns void language plpgsql security invoker set search_path = '' as $$
declare t text;
begin
  foreach t in array array['canvas_task_links', 'canvas_task_events', 'canvas_task_placements', 'canvas_ink',
                           'canvas_tasks', 'canvas_recurrences', 'canvas_appointments', 'canvas_journal',
                           'canvas_ideas', 'canvas_notes', 'canvas_exercise', 'canvas_meals', 'canvas_water',
                           'canvas_day_meta', 'canvas_preferences', 'canvas_google_accounts',
                           'canvas_clickup_accounts', 'canvas_sync_audit'] loop
    execute format('delete from public.%I where user_id = auth.uid()', t);
  end loop;
end;
$$;
revoke all on function public.canvas_delete_my_data() from public, anon;
grant execute on function public.canvas_delete_my_data() to authenticated;

-- Make the API see the new table straight away.
notify pgrst, 'reload schema';
