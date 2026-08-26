-- A second class of governing document: the one the association publishes itself.
--
-- Caldera Springs, Broken Top, Awbrey Glen and Eagle Crest post their complete
-- current governing sets publicly. Those copies beat the title plant on two
-- axes that matter:
--
--   CURRENT. The association publishes the operative version. A title plant
--   holds whatever was recorded, with nothing marking a document superseded.
--   Caldera's master declaration there is dated 2026-02-04.
--
--   MACHINE-READABLE. They are digital PDFs with a real text layer. Every
--   county scan is a photograph — invisible to search and to answer engines
--   until we OCR it, and even then the OCR is too unreliable to quote.
--
-- But they are EXECUTION copies: page 1 reads "After Recording Return to:" and
-- "to be effective upon its recording in Deschutes County". There is no clerk's
-- stamp, so there is no instrument number, and R7's provenance line cannot be
-- an instrument number for these.
--
-- The provenance is real, just different: who published it, when the document
-- is dated, and when we retrieved it. That is what these columns carry, and
-- `recording_type = 'association-published'` is what tells the read path to
-- render that line instead of a recording reference. Matt approved the split
-- 2026-08-26 rather than either hiding these or dressing them as recorded.

ALTER TABLE public.place_document DROP CONSTRAINT IF EXISTS place_document_recording_type_check;
ALTER TABLE public.place_document ADD CONSTRAINT place_document_recording_type_check
  CHECK (recording_type IN ('book-page', 'year-instrument', 'unparsed', 'association-published'));

ALTER TABLE public.place_document
  ADD COLUMN IF NOT EXISTS publisher     text,
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS retrieved_at  timestamptz;

-- An association-published document must say who published it. Without that
-- the row has no provenance at all, which is the one thing R7 forbids.
ALTER TABLE public.place_document DROP CONSTRAINT IF EXISTS place_document_association_provenance;
ALTER TABLE public.place_document ADD CONSTRAINT place_document_association_provenance
  CHECK (
    recording_type <> 'association-published'
    OR (publisher IS NOT NULL AND length(btrim(publisher)) > 0)
  );

COMMENT ON COLUMN public.place_document.publisher IS
  'For association-published documents: the association that published it. Required for recording_type=association-published — it IS the provenance, standing in for the instrument number a recorded copy would carry.';
COMMENT ON COLUMN public.place_document.document_date IS
  'The date on the face of an association-published document. Not a recording date — these copies are not stamped.';
COMMENT ON COLUMN public.place_document.retrieved_at IS
  'When we fetched the association''s copy. An association can replace its published file silently, so the retrieval date is part of the provenance.';
