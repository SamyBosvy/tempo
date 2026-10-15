ALTER TABLE public.user_settings DROP CONSTRAINT user_settings_theme_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_theme_check CHECK (theme IN ('dark','light','system'));
ALTER TABLE public.user_settings ALTER COLUMN theme SET DEFAULT 'system';
CREATE OR REPLACE FUNCTION public.search_history(_type text DEFAULT 'all',_search text DEFAULT '',_offset int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $fn$
WITH entries AS (
SELECT 'session' AS type,id,started_at AS at,to_jsonb(f)-'user_id' AS row FROM public.focus_sessions f WHERE user_id=auth.uid() AND _type IN ('all','session') AND (_search='' OR intention ILIKE '%'||_search||'%' ESCAPE '\' OR done_note ILIKE '%'||_search||'%' ESCAPE '\')
UNION ALL SELECT 'prime',id,at,to_jsonb(p)-'user_id' FROM public.prime_sessions p WHERE user_id=auth.uid() AND _type IN ('all','prime') AND (_search='' OR intention ILIKE '%'||_search||'%' ESCAPE '\')
UNION ALL SELECT 'rating',id,at,to_jsonb(r)-'user_id' FROM public.energy_ratings r WHERE user_id=auth.uid() AND _type IN ('all','rating') AND (_search='' OR note ILIKE '%'||_search||'%' ESCAPE '\')
), page AS (SELECT * FROM entries ORDER BY at DESC,id LIMIT 51 OFFSET greatest(_offset,0)), shown AS (SELECT * FROM page ORDER BY at DESC,id LIMIT 50)
SELECT jsonb_build_object('entries',coalesce((SELECT jsonb_agg(row||jsonb_build_object('type',type,'at',at,'interruptions',CASE WHEN type='session' THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'source',i.source,'reason',i.reason,'custom_label',i.custom_label,'at',i.at) ORDER BY i.at) FROM public.interruptions i WHERE i.user_id=auth.uid() AND i.session_id=shown.id),'[]'::jsonb) ELSE '[]'::jsonb END) ORDER BY at DESC,id) FROM shown),'[]'::jsonb),'more',(SELECT count(*) FROM page)>50)
$fn$;
REVOKE EXECUTE ON FUNCTION public.search_history(text,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_history(text,text,int) TO authenticated;
CREATE INDEX IF NOT EXISTS focus_history_order ON public.focus_sessions(user_id,started_at DESC,id);
CREATE INDEX IF NOT EXISTS prime_history_order ON public.prime_sessions(user_id,at DESC,id);
CREATE INDEX IF NOT EXISTS rating_history_order ON public.energy_ratings(user_id,at DESC,id);