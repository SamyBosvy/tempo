create type public.app_role as enum ('owner', 'member');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  added_by uuid,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.allowed_emails to authenticated;
grant all on public.allowed_emails to service_role;
alter table public.allowed_emails enable row level security;
create policy "owner manages allowlist" on public.allowed_emails for all to authenticated
  using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

create or replace function public.get_user_id_by_email(_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(_email) limit 1
$$;
revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

create or replace function public.list_members(_limit int, _offset int)
returns table(user_id uuid, email text, created_at timestamptz, role public.app_role, total bigint)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, r.created_at, r.role, count(*) over()
  from public.user_roles r join auth.users u on u.id = r.user_id
  order by r.created_at desc limit _limit offset _offset
$$;
revoke execute on function public.list_members(int, int) from public, anon, authenticated;
grant execute on function public.list_members(int, int) to service_role;

create table public.user_settings (
  user_id uuid primary key,
  work_start time not null default '08:00',
  work_end time not null default '18:00',
  min_focus_min int not null default 25,
  prime_lead_min int not null default 10,
  breath_pattern text not null default 'sigh' check (breath_pattern in ('sigh','box','478')),
  breath_minutes int not null default 2 check (breath_minutes between 1 and 5),
  keywords text[] not null default array['review','interview','1:1','performance'],
  calendar_ids text[] not null default array['primary'],
  notifications boolean not null default false,
  vibration boolean not null default true,
  theme text not null default 'dark' check (theme in ('dark','light')),
  safety_ack_at timestamptz,
  google_email text,
  google_connected_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
alter table public.user_settings enable row level security;
create policy "own settings select" on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy "own settings insert" on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy "own settings update" on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.google_tokens (
  user_id uuid primary key,
  refresh_token_ciphertext text not null,
  google_email text,
  updated_at timestamptz not null default now()
);
grant all on public.google_tokens to service_role;
alter table public.google_tokens enable row level security;

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  planned_min int not null,
  actual_min int not null,
  intention text check (char_length(intention) <= 200),
  done_note text check (char_length(done_note) <= 200),
  energy_before int check (energy_before between 1 and 5),
  energy_after int check (energy_after between 1 and 5),
  created_at timestamptz not null default now()
);
create index on public.focus_sessions (user_id, started_at desc);

create table public.interruptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  session_id uuid not null references public.focus_sessions(id) on delete cascade,
  reason text not null check (reason in ('meeting','message','distracted','other')),
  at timestamptz not null
);
create index on public.interruptions (user_id, at desc);

create table public.energy_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('morning','after_meeting')),
  rating int not null check (rating between 1 and 5),
  note text check (char_length(note) <= 200),
  event_id text,
  primed boolean,
  local_date date not null,
  at timestamptz not null
);
create index on public.energy_ratings (user_id, at desc);
create unique index energy_morning_once on public.energy_ratings (user_id, local_date) where kind = 'morning';
create unique index energy_after_once on public.energy_ratings (user_id, event_id) where kind = 'after_meeting';

create table public.prime_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  event_id text,
  pattern text not null,
  duration_s int not null,
  intention text check (char_length(intention) <= 200),
  at timestamptz not null
);
create index on public.prime_sessions (user_id, at desc);

create table public.event_flags (
  user_id uuid not null default auth.uid(),
  event_id text not null,
  stressful boolean not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  primary key (user_id, event_id)
);

create table public.manual_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('meeting','focus')),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at)
);
create index on public.manual_blocks (user_id, start_at);

do $$
declare t text;
begin
  foreach t in array array['focus_sessions','interruptions','energy_ratings','prime_sessions','event_flags','manual_blocks'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

create or replace function public.get_insights(_tz text)
returns jsonb language sql stable security invoker set search_path = public as $$
  with fs as (select * from public.focus_sessions where user_id = auth.uid()),
  er as (select * from public.energy_ratings where user_id = auth.uid())
  select jsonb_build_object(
    'session_count', (select count(*) from fs),
    'rating_count', (select count(*) from er) + (select count(*) from fs where energy_before is not null or energy_after is not null),
    'by_hour', coalesce((select jsonb_agg(x order by h) from (
        select h, jsonb_build_object('hour', h, 'minutes', sum(actual_min), 'avg_energy', round(avg(energy_after)::numeric, 2), 'count', count(*)) x
        from (select extract(hour from started_at at time zone _tz)::int h, actual_min, energy_after from fs) s group by h) q), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(x order by d) from (
        select d, jsonb_build_object('day', d, 'minutes', sum(actual_min)) x
        from (select (started_at at time zone _tz)::date d, actual_min from fs where started_at > now() - interval '28 days') s group by d) q), '[]'::jsonb),
    'by_week', coalesce((select jsonb_agg(x order by w) from (
        select w, jsonb_build_object('week', w, 'minutes', sum(actual_min)) x
        from (select date_trunc('week', started_at at time zone _tz)::date w, actual_min from fs where started_at > now() - interval '12 weeks') s group by w) q), '[]'::jsonb),
    'energy_by_hour', coalesce((select jsonb_agg(x order by h) from (
        select h, jsonb_build_object('hour', h, 'avg', round(avg(v)::numeric, 2)) x from (
          select extract(hour from at at time zone _tz)::int h, rating v from er
          union all select extract(hour from started_at at time zone _tz)::int, energy_before from fs where energy_before is not null
          union all select extract(hour from ended_at at time zone _tz)::int, energy_after from fs where energy_after is not null
        ) e group by h) q), '[]'::jsonb),
    'primed', (select jsonb_build_object(
        'primed_n', count(*) filter (where primed), 'primed_avg', round((avg(rating) filter (where primed))::numeric, 2),
        'unprimed_n', count(*) filter (where not primed), 'unprimed_avg', round((avg(rating) filter (where not primed))::numeric, 2))
      from er where kind = 'after_meeting'),
    'interruptions', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'count', c)) from (
        select reason, count(*) c from public.interruptions where user_id = auth.uid() group by reason) i), '[]'::jsonb)
  )
$$;
grant execute on function public.get_insights(text) to authenticated;