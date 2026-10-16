ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS work_hours jsonb NOT NULL DEFAULT '{"0":{"on":false,"start":"08:00","end":"18:00"},"1":{"on":true,"start":"08:00","end":"18:00"},"2":{"on":true,"start":"08:00","end":"18:00"},"3":{"on":true,"start":"08:00","end":"18:00"},"4":{"on":true,"start":"08:00","end":"18:00"},"5":{"on":true,"start":"08:00","end":"18:00"},"6":{"on":false,"start":"08:00","end":"18:00"}}'::jsonb;
UPDATE public.user_settings SET work_hours = (
  SELECT jsonb_object_agg(d::text, jsonb_build_object('on', d BETWEEN 1 AND 5, 'start', to_char(work_start,'HH24:MI'), 'end', to_char(work_end,'HH24:MI')))
  FROM generate_series(0,6) d);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_work_hours_object CHECK (jsonb_typeof(work_hours) = 'object');
COMMENT ON COLUMN public.user_settings.work_start IS 'Fallback only: per-day hours live in work_hours';
COMMENT ON COLUMN public.user_settings.work_end IS 'Fallback only: per-day hours live in work_hours';