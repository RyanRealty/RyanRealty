-- Recorded governing documents for a place — CC&Rs, declarations, amendments,
-- bylaws, design guidelines.
--
-- WHY TWO TABLES. One recorded instrument serves many plats: the Tetherow
-- declaration governs tetherow-phase-1 through tetherow-phase-7, and the county
-- records it once. Folding the plat into the document row would duplicate the
-- instrument seven times and make "is this the current chain?" a question with
-- seven answers. So `place_document` is the instrument, and
-- `place_document_link` is its association to a place.
--
-- WHY THE LINK CARRIES A STATUS. PLACE_CONTENT_RULES R7: matching a recorded
-- declaration to a subdivision is heuristic, because ORS 205.160 indexes only
-- party name, document type, date and instrument number — there is no
-- subdivision field and no cross-reference chaining an amendment to what it
-- amends. An exact published-name match whose own text confirms the subdivision
-- is safe to publish. Everything else waits for a human. Nothing renders unless
-- status='published'.

CREATE TABLE IF NOT EXISTS public.place_document (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance. R7 requires all of this on the face of the rendered document.
  source            text NOT NULL,            -- 'deschutes_county_title'
  source_url        text NOT NULL,
  county            text NOT NULL,
  published_name    text NOT NULL,            -- the subdivision name AS PUBLISHED by the source

  -- The recording reference, in whichever of the two forms the county used:
  -- book/page for older volume recordings, year+instrument after the cutover.
  recording_type    text NOT NULL CHECK (recording_type IN ('book-page', 'year-instrument', 'unparsed')),
  recording_ref     text NOT NULL,            -- verbatim, e.g. '346-1105' or '2007-36361'
  book              integer,
  page              integer,
  instrument_number text,
  recording_year    integer,

  doc_kind          text NOT NULL DEFAULT 'ccr',

  -- The hosted copy.
  storage_path      text NOT NULL,
  file_bytes        bigint NOT NULL,
  sha256            text NOT NULL,
  page_count        integer,
  fetched_at        timestamptz NOT NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT place_document_source_url_key UNIQUE (source_url),
  CONSTRAINT place_document_sha_key UNIQUE (sha256)
);

CREATE INDEX IF NOT EXISTS place_document_published_name_idx
  ON public.place_document (lower(published_name));
CREATE INDEX IF NOT EXISTS place_document_recording_idx
  ON public.place_document (county, recording_ref);

CREATE TABLE IF NOT EXISTS public.place_document_link (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.place_document(id) ON DELETE CASCADE,

  geo_type      text NOT NULL,                -- 'subdivision' today; community/neighborhood later
  geo_slug      text NOT NULL,

  -- How the association was made, and therefore how much it can be trusted.
  --   exact  — the plat name equals the published name
  --   parent — a phase-level plat resolved to its declaration-level entry
  --   manual — a human associated it
  match_method  text NOT NULL CHECK (match_method IN ('exact', 'parent', 'manual')),

  status        text NOT NULL DEFAULT 'pending_review'
                CHECK (status IN ('published', 'pending_review', 'rejected')),

  reviewed_by   text,
  reviewed_at   timestamptz,
  review_note   text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT place_document_link_unique UNIQUE (document_id, geo_type, geo_slug)
);

-- The read path is always "documents for this place, published only".
CREATE INDEX IF NOT EXISTS place_document_link_place_idx
  ON public.place_document_link (geo_type, geo_slug)
  WHERE status = 'published';

-- The review path is "everything still waiting".
CREATE INDEX IF NOT EXISTS place_document_link_review_idx
  ON public.place_document_link (status, geo_slug)
  WHERE status = 'pending_review';

ALTER TABLE public.place_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_document_link ENABLE ROW LEVEL SECURITY;

-- Documents are recorded public instruments; the row is world-readable.
CREATE POLICY "place_document_public_read" ON public.place_document
  FOR SELECT USING (true);

-- A link is only public once it clears review. An unreviewed guess is not
-- merely hidden by application code — it is unreadable, so a heuristic match
-- can never reach a page by accident.
CREATE POLICY "place_document_link_public_read" ON public.place_document_link
  FOR SELECT USING (status = 'published');

COMMENT ON TABLE public.place_document IS
  'One row per recorded governing instrument (CC&R, amendment, bylaws). Hosted copy + full recording provenance. Source of truth for the documents section on place pages.';
COMMENT ON TABLE public.place_document_link IS
  'Associates a recorded instrument with a place. Heuristic matches land as pending_review; only status=published renders. PLACE_CONTENT_RULES R7.';
COMMENT ON COLUMN public.place_document_link.match_method IS
  'exact = plat name equals published name. parent = phase-level plat resolved to its declaration-level entry. manual = a human made the association.';

-- Hosted copies of the documents.
--
-- PUBLIC (public = true). Unlike every other bucket here, these are recorded
-- public instruments — a CC&R declaration is a county record any member of the
-- public may obtain. The whole point of hosting them is that a buyer reads the
-- CC&Rs on our subdivision page instead of being sent elsewhere, so the object
-- must be fetchable without a signed URL and must stay cacheable at the edge.
--
-- Object paths are <county>/<published-name-slug>/<recording-ref>.pdf, so the
-- path itself carries the provenance R7 requires.
INSERT INTO storage.buckets (id, name, public)
VALUES ('place-documents', 'place-documents', true)
ON CONFLICT (id) DO NOTHING;
