-- OCR layer for the scanned recorded documents.
--
-- Every CC&R scan from the county is a photograph of paper with no text layer,
-- so before this the corpus was opaque to us and to every crawler. ocr_text is
-- the machine-read front matter (on-device Apple Vision, nothing leaves the
-- machine), kept for three internal uses:
--   1. doc_kind — the document, and the clerk's stamped type code, say what it is
--   2. name_confirmed — does the document's own text name the subdivision we
--      linked it to? An independent check on a heuristic match (R7)
--   3. search
--
-- It is deliberately NOT page copy. Vision misreads microfilm-era type
-- ("11 one Land tsa be dot one" in one sample), and a garbled covenant rendered
-- as fact would misstate a legal restriction to a buyer. Rendering quoted
-- covenant text requires human verification first.
ALTER TABLE public.place_document
  ADD COLUMN IF NOT EXISTS ocr_text       text,
  ADD COLUMN IF NOT EXISTS name_confirmed boolean,
  ADD COLUMN IF NOT EXISTS ocr_at         timestamptz;

COMMENT ON COLUMN public.place_document.ocr_text IS
  'On-device Vision OCR of the first pages. Internal use only — classification, match verification, search. Never rendered as page copy: OCR of microfilm scans is unreliable enough that a quoted covenant could misstate a restriction.';
COMMENT ON COLUMN public.place_document.name_confirmed IS
  'True when the document''s own OCR text names the subdivision it is indexed under, and no foreign association owns the document. Independent evidence that a heuristic match is right.';
