/**
 * PLACE SECTION — the recorded governing documents, as PATTERN 3: LEDGER.
 *
 * WHY LEDGER (design_system/public/PUBLIC_UI.md section 3, locked 2026-08-11):
 * "a scannable list of real rows (homes, places, sales, reports) with tabular
 * numbers and one action per row. Every row is a door." That is this section
 * exactly. Each row is one recorded instrument, identified by the reference it
 * was recorded under, and the one action on it is to open the document. The
 * reader's whole job here is to scan down a column of instruments and leave
 * through one, which is the pattern's definition and not a resemblance to it.
 * The rows carry no market figure, so they are V3LedgerPlainRow and the section
 * ships no "Source" line: provenance here is per row (the recording reference
 * and the county) plus the footnote, not one trace under a value column.
 *
 * Shared by every place grain: subdivision, community and neighborhood. One
 * component because the honesty requirements are identical at every grain, and
 * a second copy is a second place for the R7 caveat to drift out of date.
 *
 * WHY IT MOVED HERE. It used to live at components/site/PlaceDocuments.tsx and
 * render `className="section"`, `wrap`, `sec-head`, `sec-title` — four class
 * names with NO unscoped definition anywhere in the repo. `.sec-title` is
 * declared twice, once under `.kb-root` (components/site/kb/kb.css) and once
 * under `.listing-detail` (components/site/listing-detail/listing-detail.css),
 * and `.section`, `.wrap`, `.sec-head` and `.sec-index` only under `.kb-root`.
 * A component documented as shared by three grains therefore rendered styled
 * only while every one of its callers happened to sit inside `main.kb-root`,
 * and would have rendered unstyled the first time one did not. V3Ledger puts
 * V3_ROOT_CLASS on its own outermost element, so this section now carries its
 * own token scope and depends on no ancestor at all.
 *
 * PLACE_CONTENT_RULES R7 shapes what this may say. Every row carries its
 * instrument number or book-and-page and its county, because a hosted document
 * with no provenance looks authoritative and cannot be checked. And the closing
 * footnote states plainly that later amendments may exist — Oregon records carry
 * no cross-reference chaining an amendment to what it amends, so nothing here
 * can claim to be the complete chain.
 *
 * Renders null when nothing is published for the place. That is not the Ledger's
 * empty variant: the empty variant states why a query came back with no rows,
 * and here there was no query for this place to come back empty.
 */
import { formatFileSize } from '@/lib/format/bytes'
import {
  documentKindLabel,
  recordingLabel,
  type PlaceDocument,
} from '@/lib/data/places/getPlaceDocuments'
import { v3Text } from './atoms'
import { V3Ledger, type V3LedgerPlainRow } from './V3Ledger'

interface Props {
  displayName: string
  documents: PlaceDocument[]
}

export function V3PlaceDocuments({ displayName, documents }: Props) {
  if (documents.length === 0) return null

  const county = documents[0].county
  const attribution = documents.find((d) => d.sourceIndexUrl)
  const declarations = documents.filter((d) => d.kind === 'ccr').length
  const amendments = documents.filter((d) => d.kind === 'amendment').length
  // Two provenance stories can appear on one page: recorded county instruments,
  // and copies the association publishes itself. The caveat has to describe
  // whichever are actually here — telling a reader that an unstamped
  // association PDF was "recorded in Deschutes County" would be false.
  const hasRecorded = documents.some((d) => d.recordingType !== 'association-published')
  const hasAssociation = documents.some((d) => d.recordingType === 'association-published')
  const publisher = documents.find((d) => d.publisher)?.publisher ?? null

  const rows: V3LedgerPlainRow[] = documents.map((d) => {
    const size = formatFileSize(d.fileBytes)
    return {
      id: d.id,
      href: d.url,
      // The document opens in its own tab: it is a hosted PDF, and a visitor
      // reading a declaration has not finished with the place page.
      newTab: true,
      when: v3Text(`${recordingLabel(d)} · ${d.county} County`),
      what: v3Text(documentKindLabel(d.kind)),
      detail: v3Text(
        `PDF${d.pageCount ? ` · ${d.pageCount} ${d.pageCount === 1 ? 'page' : 'pages'}` : ''}${
          size ? ` · ${size}` : ''
        }`,
      ),
    }
  })

  const [first, ...rest] = rows
  if (!first) return null

  return (
    <V3Ledger
      id="documents"
      eyebrow={v3Text(`${displayName} · Recorded documents`)}
      heading={v3Text('CC&Rs and governing documents')}
      note={v3Text(
        `${documents.length} recorded ${documents.length === 1 ? 'document' : 'documents'} for ${displayName}` +
          (declarations > 0 && amendments > 0
            ? ` — ${declarations === 1 ? 'the declaration' : `${declarations} declarations`} and ${amendments} recorded ${amendments === 1 ? 'amendment' : 'amendments'}`
            : '') +
          '. Read them here.',
      )}
      rows={[first, ...rest]}
      footnote={
        <>
          {hasRecorded ? (
            <>
              Documents marked with a book, page or instrument number are copies of instruments
              recorded in {county} County, Oregon. Oregon records are indexed by party, document
              type and instrument number, not by subdivision, and nothing in them marks a
              declaration as current or superseded.{' '}
            </>
          ) : null}
          {hasAssociation ? (
            <>
              Documents marked as published by {publisher ?? 'the association'} are the
              association&apos;s own copies. They are not stamped by the county recorder, so they
              carry no instrument number, and an association can replace a published file at any
              time.{' '}
            </>
          ) : null}
          Later amendments may exist that are not shown here. Confirm the governing chain through
          title before relying on it.
          {attribution ? (
            <>
              {' '}
              Recorded copies via{' '}
              <a href={attribution.sourceIndexUrl} target="_blank" rel="noopener noreferrer">
                {attribution.sourceLabel}
              </a>
              .
            </>
          ) : null}
        </>
      }
    />
  )
}
