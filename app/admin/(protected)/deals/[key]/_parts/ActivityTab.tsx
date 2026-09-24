// @no-parity — internal admin tool (file workspace: Activity tab)
//
// The file's full audit trail, fifty entries a page, newest first: every
// upload, assignment, sign-off, stage change and filing, with who and when.
// This is the record a Real Estate Agency inspection reads (OAR 863-015-0250).
import Link from 'next/link'
import { Panel } from '@/components/admin/v2'
import type { DealEventRow } from '@/lib/data/tc/deal-events'
import { tcEventDetailPreview, tcEventLabel } from '@/lib/tc/events'

export function ActivityTab({
  rows,
  total,
  page,
  pageSize,
  pageHref,
}: {
  rows: DealEventRow[]
  total: number
  page: number
  pageSize: number
  pageHref: (page: number) => string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <Panel title="Activity" aside={`${total.toLocaleString('en-US')} entr${total === 1 ? 'y' : 'ies'}`}>
      {rows.length ? (
        <ul className="av2-feed">
          {rows.map((e) => {
            const preview = tcEventDetailPreview(e.detail)
            return (
              <li key={e.id} className="av2-feed__row">
                <span className="av2-feed__when">{String(e.created_at).slice(0, 16).replace('T', ' ')}</span>
                <span className="av2-feed__what">{tcEventLabel(e.action)}</span>
                <span className="av2-feed__more">
                  {e.actor}
                  {preview ? ` · ${preview}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="av2-panel__empty">No activity recorded on this file yet.</p>
      )}
      {pages > 1 ? (
        <p style={{ display: 'flex', gap: 16, margin: 'var(--a-s3) 0 0', fontSize: 'var(--a-text-sm)' }}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} style={{ color: 'var(--a-accent)' }} scroll={false}>
              Newer
            </Link>
          ) : null}
          <span style={{ color: 'var(--a-text-2)' }}>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} style={{ color: 'var(--a-accent)' }} scroll={false}>
              Older
            </Link>
          ) : null}
        </p>
      ) : null}
    </Panel>
  )
}
