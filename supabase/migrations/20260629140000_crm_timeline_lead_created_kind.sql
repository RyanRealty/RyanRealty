-- Expand crm_timeline.kind to allow the new-lead activity event ('lead_created')
-- plus the milestone/intent kinds the app's activity classifier already maps
-- (home_valuation, subscribe_report, parsed_intent) but the CHECK previously
-- rejected. This makes "New lead" a first-class timeline event so the global
-- Activity feed (FUB Activity-tab parity) is one uniform, indexed query rather
-- than a UNION across tables.
--
-- Safe + reversible: only widens the allowed set; no existing row is affected.

ALTER TABLE public.crm_timeline DROP CONSTRAINT IF EXISTS crm_timeline_kind_check;

ALTER TABLE public.crm_timeline ADD CONSTRAINT crm_timeline_kind_check CHECK (
  kind = ANY (ARRAY[
    'note', 'email_in', 'email_out', 'email_open', 'email_click',
    'sms_in', 'sms_out', 'call', 'voicemail', 'web_event', 'task',
    'stage_change', 'system',
    'lead_created', 'home_valuation', 'subscribe_report', 'parsed_intent'
  ]::text[])
);

-- Index to keep the global Activity feed fast: newest-first scans filtered by a
-- small set of kinds. A (kind, ts desc) index serves the per-tab filter + order
-- + cursor pagination directly.
CREATE INDEX IF NOT EXISTS crm_timeline_kind_ts_idx
  ON public.crm_timeline (kind, ts DESC);

-- Guarantee a "New lead" activity event for EVERY contact going forward, on any
-- creation path (native lead capture, LP forms, imports, manual add), not just
-- one code path. Idempotent via dedupe_key, so re-imports never double-write.
CREATE OR REPLACE FUNCTION public.crm_people_lead_created_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted IS NOT TRUE THEN
    INSERT INTO public.crm_timeline (person_id, ts, kind, title, payload, broker, source, dedupe_key)
    VALUES (
      NEW.id,
      COALESCE(NEW.fub_created_at, NEW.created_at, now()),
      'lead_created',
      COALESCE(NULLIF(NEW.name, ''), NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''), 'New lead'),
      jsonb_build_object('source', NEW.source, 'stage', NEW.stage, 'origin', 'trigger'),
      NEW.assigned_broker,
      'lead-create',
      'lead:' || NEW.id
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_people_lead_created ON public.crm_people;
CREATE TRIGGER crm_people_lead_created
  AFTER INSERT ON public.crm_people
  FOR EACH ROW EXECUTE FUNCTION public.crm_people_lead_created_trigger();
