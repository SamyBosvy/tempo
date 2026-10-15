ALTER TABLE public.user_settings
  ADD COLUMN wake_lock boolean NOT NULL DEFAULT true,
  ADD COLUMN end_sound boolean NOT NULL DEFAULT true,
  ADD COLUMN end_notify boolean NOT NULL DEFAULT true,
  ADD COLUMN custom_interruption text CHECK (custom_interruption IS NULL OR char_length(custom_interruption) BETWEEN 1 AND 30);

ALTER TABLE public.interruptions
  ADD COLUMN source text CHECK (source IS NULL OR source IN ('self','external')),
  ADD COLUMN custom_label text CHECK (custom_label IS NULL OR char_length(custom_label) <= 30);
ALTER TABLE public.interruptions DROP CONSTRAINT IF EXISTS interruptions_reason_check;
ALTER TABLE public.interruptions ADD CONSTRAINT interruptions_reason_check
  CHECK (reason IN ('meeting','message','distracted','other','custom'));
ALTER TABLE public.interruptions ADD CONSTRAINT interruptions_custom_reason_label
  CHECK ((reason = 'custom') = (custom_label IS NOT NULL));

ALTER TABLE public.focus_sessions
  ADD COLUMN parked_thoughts text[] CHECK (parked_thoughts IS NULL OR cardinality(parked_thoughts) <= 10);

CREATE OR REPLACE FUNCTION public.get_insights(_tz text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    'interruptions', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'reason', reason, 'label', label, 'count', c)) from (
        select coalesce(source, 'unknown') source, reason, case when reason = 'custom' then custom_label end label, count(*) c
        from public.interruptions where user_id = auth.uid()
        group by 1, 2, 3) i), '[]'::jsonb)
  )
$function$;
GRANT EXECUTE ON FUNCTION public.get_insights(text) TO authenticated;