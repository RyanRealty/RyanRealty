-- W10.2 — broker content library: durable storage for finished deliverables.
--
-- Producers currently return their output inline in
-- marketing_brain_actions.executor_response (or as a local out/ path that dies
-- with the runner). Nothing survives for a broker to come back to. This bucket
-- is where a finished deliverable is persisted so the library surface can list
-- and download it.
--
-- PRIVATE (public = false). Deliverables are broker work product, not public
-- assets: reads go through a short-lived signed URL minted server-side after
-- the app has scoped the row to the requesting broker. Object paths are
-- deliberately broker-prefixed (<broker-slug>/<action-id>/<filename>) so a
-- listing can never be built without naming a broker.
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-deliverables', 'marketing-deliverables', false)
ON CONFLICT (id) DO NOTHING;
