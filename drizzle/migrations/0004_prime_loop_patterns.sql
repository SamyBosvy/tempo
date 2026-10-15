ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_breath_pattern_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_breath_pattern_check CHECK (breath_pattern IN ('sigh','box','478','coherent','extended'));
ALTER TABLE public.energy_ratings ADD COLUMN IF NOT EXISTS intent_outcome text;
ALTER TABLE public.energy_ratings ADD CONSTRAINT energy_ratings_intent_outcome_check CHECK (intent_outcome IS NULL OR intent_outcome IN ('yes','partly','no'));

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
    'intent_outcomes', (select jsonb_build_object(
        'yes', count(*) filter (where intent_outcome = 'yes'),
        'partly', count(*) filter (where intent_outcome = 'partly'),
        'no', count(*) filter (where intent_outcome = 'no'))
      from er where kind = 'after_meeting' and primed and intent_outcome is not null),
    'interruptions', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'reason', reason, 'label', label, 'count', c)) from (
        select coalesce(source, 'unknown') source, reason, case when reason = 'custom' then custom_label end label, count(*) c
        from public.interruptions where user_id = auth.uid()
        group by 1, 2, 3) i), '[]'::jsonb)
  )
$function$;
GRANT EXECUTE ON FUNCTION public.get_insights(text) TO authenticated;