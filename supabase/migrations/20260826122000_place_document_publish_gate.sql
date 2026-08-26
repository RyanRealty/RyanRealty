-- The publication gate.
--
-- The index that supplied this corpus (Deschutes County Title's public CC&R
-- library) is a TITLE-PLANT RESEARCH BUCKET, not a curated set of governing
-- documents. It files everything recorded that touches a plat. Measured over
-- 2,189 ingested documents:
--
--   * the "Larch Meadows" bucket holds a warranty deed
--   * "Indian Ford Meadows" holds Crooked Horseshoe Homeowner's Association
--     declarations, a water-system sale agreement, an easement and an
--     assignment of a real estate contract
--   * "Awbrey Court" holds declarations titled VALHALLA HEIGHTS PHASE IV
--   * corpus-wide: 118 easements, 41 deeds, 40 liens, 16 trust deeds,
--     12 assignments
--
-- Publishing the bucket verbatim under the heading "CC&Rs and governing
-- documents" would put another subdivision's declaration, and a warranty deed,
-- in front of a buyer as this plat's governing documents.
--
-- So doc_kind gains the non-governing instrument types, and publication is
-- gated in the database rather than in the ingest script — a rule that lives
-- only in a script is not a rule (CLAUDE.md §6).

ALTER TABLE public.place_document DROP CONSTRAINT IF EXISTS place_document_doc_kind_check;
ALTER TABLE public.place_document ADD CONSTRAINT place_document_doc_kind_check
  CHECK (doc_kind IN (
    -- governing instruments: publishable
    'ccr','amendment','bylaws','articles','design_guidelines','rules',
    -- association business: real, but not what "governing documents" means
    'budget','reserve_study',
    -- NOT governing instruments: never publishable on a place page
    'deed','easement','lien','trust_deed','assignment','contract',
    'other'
  ));

CREATE OR REPLACE FUNCTION public.place_document_publishable_kind(kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT kind IN ('ccr','amendment','bylaws','articles','design_guidelines','rules')
$$;

-- Two conditions, deliberately asymmetric:
--
--   doc_kind must be a governing instrument — ALWAYS, with no human override.
--   A warranty deed is not this subdivision's CC&Rs no matter who says so, and
--   there is no reviewer judgement that makes it one.
--
--   the document must name its own subdivision (name_confirmed) — UNLESS a
--   human has reviewed the link. OCR reads the first pages only; a one-page
--   amendment may legitimately never restate the plat name, and a reviewer who
--   has opened the PDF knows more than the OCR does.
CREATE OR REPLACE FUNCTION public.place_document_link_publish_gate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  SELECT doc_kind, name_confirmed, published_name
    INTO d
    FROM public.place_document
   WHERE id = NEW.document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'place_document_link: document % not found', NEW.document_id;
  END IF;

  IF NOT public.place_document_publishable_kind(d.doc_kind) THEN
    RAISE EXCEPTION
      'place_document_link: cannot publish % for %/% — doc_kind "%" is not a governing instrument',
      NEW.document_id, NEW.geo_type, NEW.geo_slug, d.doc_kind;
  END IF;

  IF d.name_confirmed IS DISTINCT FROM true AND NEW.reviewed_by IS NULL THEN
    RAISE EXCEPTION
      'place_document_link: cannot auto-publish % for %/% — the document text does not name "%" and no human has reviewed it',
      NEW.document_id, NEW.geo_type, NEW.geo_slug, d.published_name;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS place_document_link_publish_gate_trg ON public.place_document_link;
CREATE TRIGGER place_document_link_publish_gate_trg
  BEFORE INSERT OR UPDATE ON public.place_document_link
  FOR EACH ROW EXECUTE FUNCTION public.place_document_link_publish_gate();

COMMENT ON FUNCTION public.place_document_link_publish_gate() IS
  'Publication gate for place documents. doc_kind must be a governing instrument (no override — a deed is never CC&Rs). name_confirmed may be overridden by a human reviewer, since OCR reads only the first pages.';
