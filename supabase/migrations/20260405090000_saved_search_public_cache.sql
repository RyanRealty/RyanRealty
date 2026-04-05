-- Public + cached saved search metadata for fast, shareable search discovery.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'is_public'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN is_public boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'public_title'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN public_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'filters_hash'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN filters_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'result_count'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN result_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'cache_listing_keys'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN cache_listing_keys text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'cache_refreshed_at'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN cache_refreshed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_searches'
      AND column_name = 'public_click_count'
  ) THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN public_click_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_searches_is_public
  ON public.saved_searches (is_public, public_click_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_searches_filters_hash
  ON public.saved_searches (filters_hash);

DROP POLICY IF EXISTS "Users can update own saved_searches" ON public.saved_searches;
CREATE POLICY "Users can update own saved_searches"
  ON public.saved_searches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
