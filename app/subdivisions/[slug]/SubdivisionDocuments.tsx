/**
 * SubdivisionDocuments — the recorded governing documents on
 * /subdivisions/[slug]. Hosted copies of the CC&R declaration and its recorded
 * amendments, each shown with the recording reference that identifies it.
 *
 * PLACE_CONTENT_RULES R7 shapes what this may say. Every row carries its
 * instrument number or book-and-page and its county, because a hosted document
 * with no provenance looks authoritative and cannot be checked. And the closing
 * note states plainly that later amendments may exist — Oregon records carry no
 * cross-reference chaining an amendment to what it amends, so nothing here can
 * claim to be the complete chain.
 *
 * Renders null when nothing is published for the place.
 */

import {
  documentKindLabel,
  recordingLabel,
  type PlaceDocument,
} from '@/lib/data/places/getPlaceDocuments'

interface Props {
  displayName: string
  documents: PlaceDocument[]
}

function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const mb = bytes / 1_048_576
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function SubdivisionDocuments({ displayName, documents }: Props) {
  if (documents.length === 0) return null

  const county = documents[0].county
  const attribution = documents.find((d) => d.sourceIndexUrl)
  const declarations = documents.filter((d) => d.kind === 'ccr').length
  const amendments = documents.filter((d) => d.kind === 'amendment').length

  return (
    <section className="section" id="documents" aria-label="Recorded documents">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">
            {displayName} {'·'} Recorded documents
          </span>
          <h2 className="sec-title display">CC&amp;Rs and governing documents</h2>
        </div>

        <p style={{ margin: '0 0 1.25rem', fontSize: '1rem', maxWidth: '44rem' }}>
          {documents.length} recorded {documents.length === 1 ? 'document' : 'documents'} for{' '}
          {displayName}
          {declarations > 0 && amendments > 0
            ? ` — ${declarations === 1 ? 'the declaration' : `${declarations} declarations`} and ${amendments} recorded ${amendments === 1 ? 'amendment' : 'amendments'}`
            : ''}
          . Read them here.
        </p>

        <ul
          style={{ listStyle: 'none', margin: '0 0 1.25rem', padding: 0, display: 'grid', gap: '.5rem' }}
        >
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
                    border: '1px solid rgba(16,39,66,0.12)',
                    borderRadius: '10px',
                    color: 'var(--navy)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '1.02rem' }}>
                    {documentKindLabel(d.kind)}
                  </span>
                  <span
                    style={{
                      fontSize: '.78rem',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--navy-70)',
                    }}
                  >
                    {recordingLabel(d)} {'·'} {d.county} County
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
          These are copies of instruments recorded in {county} County, Oregon. Oregon records are
          indexed by party, document type and instrument number, not by subdivision, and nothing in
          them marks a declaration as current or superseded. Later amendments may exist that are not
          shown here. Confirm the governing chain through title before relying on it.
          {attribution ? (
            <>
              {' '}
              Recorded copies via{' '}
              <a
                href={attribution.sourceIndexUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--navy)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                {attribution.sourceLabel}
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    </section>
  )
}
