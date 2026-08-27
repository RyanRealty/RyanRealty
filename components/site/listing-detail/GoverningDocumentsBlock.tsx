import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  documentKindLabel,
  recordingLabel,
  type PlaceDocument,
} from '@/lib/data/places/getPlaceDocuments'

/**
 * GoverningDocumentsBlock — the CC&Rs that bind THIS house, on the listing page.
 *
 * The plat is resolved through place_membership (boundary polygons), never by
 * matching the MLS SubdivisionName text — see getPlaceDocumentsForListing. This
 * is the page where a buyer is deciding about one specific property, so the
 * wrong subdivision's covenants here is worse than none at all.
 *
 * PLACE_CONTENT_RULES R7: every row carries the recording reference or the
 * publisher that identifies it, and the closing note says plainly that later
 * amendments may exist. Oregon records carry no cross-reference from an
 * amendment to what it amends, so nothing here can claim to be the full chain.
 */

type Props = {
  platName: string
  platHref: string
  documents: PlaceDocument[]
  className?: string
}

function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const mb = bytes / 1_048_576
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function GoverningDocumentsBlock({ platName, platHref, documents, className }: Props) {
  if (documents.length === 0) return null

  const county = documents[0].county
  const hasRecorded = documents.some((d) => d.recordingType !== 'association-published')
  const hasAssociation = documents.some((d) => d.recordingType === 'association-published')
  const publisher = documents.find((d) => d.publisher)?.publisher ?? null

  return (
    <section className={cn('section', className)} id="governing-documents">
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">{platName}</div>
          <h2 className="sec-title display">CC&amp;Rs and governing documents</h2>
        </div>
      </div>

      <p style={{ margin: '0 0 1rem', maxWidth: '44rem' }}>
        This home sits in {platName}. {documents.length} recorded{' '}
        {documents.length === 1 ? 'document' : 'documents'} govern it.
      </p>

      <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '.5rem' }}>
        {documents.map((d) => {
          const size = fileSize(d.fileBytes)
          return (
            <li key={d.id}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '.5rem 1rem',
                  padding: '.85rem 1rem',
                  border: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
                  borderRadius: '10px',
                  color: 'var(--navy)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontWeight: 600 }}>{documentKindLabel(d.kind)}</span>
                <span
                  style={{
                    fontSize: '.78rem',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--navy-70)',
                  }}
                >
                  {recordingLabel(d)}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '.8rem', color: 'var(--navy-70)' }}>
                  PDF
                  {d.pageCount ? ` · ${d.pageCount} ${d.pageCount === 1 ? 'page' : 'pages'}` : ''}
                  {size ? ` · ${size}` : ''}
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: 0, maxWidth: '44rem' }}>
        {hasRecorded ? (
          <>
            Documents marked with a book, page or instrument number are copies of instruments
            recorded in {county} County, Oregon. Nothing in those records marks a declaration as
            current or superseded.{' '}
          </>
        ) : null}
        {hasAssociation ? (
          <>
            Documents marked as published by {publisher ?? 'the association'} are the
            association&apos;s own copies, not stamped by the county recorder.{' '}
          </>
        ) : null}
        Later amendments may exist that are not shown here. Confirm the governing chain through
        title before relying on it.{' '}
        <Link
          href={platHref}
          style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          See {platName}
        </Link>
        .
      </p>
    </section>
  )
}
