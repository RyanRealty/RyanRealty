-- W10.2 — ONE implementation of "whose library does this deliverable belong to".
--
-- Round 3 of adversarial review found two: lib/marketing-brain/deliverable-library.ts
-- resolved marketing_inbox_events.sender_email first and fell back to
-- assigned_approver, while scripts/render-worker.mjs read ONLY assigned_approver.
-- Since assigned_approver is 'matt' on all 543 live rows and nothing writes it,
-- and the worker is the only runner that finishes VISUAL producers, every
-- flyer / video / PDF Paul or Rebecca requested would land in Matt's library
-- while their own page read "Nothing here yet."
--
-- The two callers live in different runtimes (Next.js TypeScript and a plain
-- .mjs worker), so "share a module" is not available without bundling the
-- Supabase client into the worker. The resolution is pure SQL over three
-- tables, so the single source of truth belongs here.
--
-- Returns the canonical brokers.slug namespace ('matthew-ryan'), never the
-- crm_slug namespace ('matt') — the library surface reads brokers.slug, and a
-- mismatch is what made deliverables unreadable in the first place.
CREATE OR REPLACE FUNCTION public.resolve_deliverable_broker_slug(p_action_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. The request came in through an intake: the sender IS the broker.
    (SELECT b.slug
       FROM marketing_inbox_events e
       JOIN brokers b
         ON lower(btrim(b.email)) = lower(btrim(e.sender_email))
      WHERE e.action_row_id = p_action_id
        AND b.is_active
      ORDER BY e.received_at DESC
      LIMIT 1),
    -- 2. Brain-generated work: the approver, in EITHER slug namespace.
    (SELECT b.slug
       FROM marketing_brain_actions a
       JOIN brokers b
         ON lower(btrim(b.slug)) = lower(btrim(a.assigned_approver))
         OR lower(btrim(b.crm_slug)) = lower(btrim(a.assigned_approver))
      WHERE a.id = p_action_id
        AND b.is_active
      LIMIT 1),
    -- 3. Unattributed work is visible to the principal broker rather than
    --    orphaned in a prefix no surface reads.
    'matthew-ryan'
  );
$$;

-- SECURITY DEFINER lockdown: only the service role calls this. Revoking from
-- PUBLIC alone is not enough — anon and authenticated hold their own grants.
REVOKE ALL ON FUNCTION public.resolve_deliverable_broker_slug(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_deliverable_broker_slug(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_deliverable_broker_slug(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_deliverable_broker_slug(uuid) TO service_role;
