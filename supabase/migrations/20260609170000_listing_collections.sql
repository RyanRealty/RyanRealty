-- listing_collections: user-curated, named groups of saved listings ("boards").
--
-- The collections server actions (app/actions/collections.ts) and the dashboard
-- Collections page expected this table, but it was never created — so every
-- collection read/write hit "relation does not exist" and the actions silently
-- returned empty. The dashboard /collections page therefore fell back to showing
-- the flat saved_listings set mislabeled as "My Collections." This creates the
-- table so collections actually work end to end (create, list, add/remove, delete).
--
-- Schema matches app/actions/collections.ts exactly (the app generates share_token
-- + manages listing_keys as a text[]).

CREATE TABLE IF NOT EXISTS public.listing_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  share_token text NOT NULL UNIQUE,
  listing_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_collections_user_id_idx
  ON public.listing_collections (user_id, updated_at DESC);

ALTER TABLE public.listing_collections ENABLE ROW LEVEL SECURITY;

-- Owner-only access. The collections actions run as the signed-in user (the
-- RLS-bound server client), so each user manages exactly their own collections.
-- (No public-share read policy: there is no share-view route yet, and these are
-- lists of already-public MLS listings — sharing can layer on later via a
-- SECURITY DEFINER lookup keyed by share_token if/when the share page ships.)
DROP POLICY IF EXISTS listing_collections_owner_select ON public.listing_collections;
CREATE POLICY listing_collections_owner_select ON public.listing_collections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS listing_collections_owner_insert ON public.listing_collections;
CREATE POLICY listing_collections_owner_insert ON public.listing_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS listing_collections_owner_update ON public.listing_collections;
CREATE POLICY listing_collections_owner_update ON public.listing_collections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS listing_collections_owner_delete ON public.listing_collections;
CREATE POLICY listing_collections_owner_delete ON public.listing_collections
  FOR DELETE USING (auth.uid() = user_id);
