ALTER TABLE public.user_settings
  ADD COLUMN daily_focus_target_min integer NOT NULL DEFAULT 120 CHECK (daily_focus_target_min BETWEEN 30 AND 480),
  ADD COLUMN meeting_buffer_min integer NOT NULL DEFAULT 5 CHECK (meeting_buffer_min IN (0, 5, 10));

ALTER TABLE public.event_flags
  ADD COLUMN reason text CHECK (reason IS NULL OR reason IN ('high_stakes', 'conflict', 'presenting', 'other'));

ALTER TABLE public.manual_blocks
  ADD COLUMN label text CHECK (label IS NULL OR char_length(label) <= 40);

CREATE TABLE public.recurring_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('meeting', 'focus')),
  label text CHECK (label IS NULL OR char_length(label) <= 40),
  start_time time NOT NULL,
  end_time time NOT NULL,
  days integer[] NOT NULL CHECK (cardinality(days) BETWEEN 1 AND 7 AND days <@ ARRAY[0,1,2,3,4,5,6]),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_blocks TO authenticated;
GRANT ALL ON public.recurring_blocks TO service_role;
ALTER TABLE public.recurring_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.recurring_blocks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.recurring_blocks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.recurring_blocks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.recurring_blocks FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX recurring_blocks_user_idx ON public.recurring_blocks (user_id);

CREATE TABLE public.recurring_skips (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  block_id uuid NOT NULL REFERENCES public.recurring_blocks(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  PRIMARY KEY (user_id, block_id, local_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_skips TO authenticated;
GRANT ALL ON public.recurring_skips TO service_role;
ALTER TABLE public.recurring_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.recurring_skips FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.recurring_skips FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.recurring_skips FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.recurring_skips FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.checkin_dismissals (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_id text NOT NULL,
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id, local_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_dismissals TO authenticated;
GRANT ALL ON public.checkin_dismissals TO service_role;
ALTER TABLE public.checkin_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.checkin_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.checkin_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.checkin_dismissals FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.checkin_dismissals FOR DELETE TO authenticated USING (user_id = auth.uid());