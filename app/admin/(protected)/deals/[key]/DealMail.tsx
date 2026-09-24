'use client'

// Filed email on this deal (the Vault mail index, tc_mail_messages). The rules
// file most of it on their own — this section only shows what landed and why,
// plus a resweep for the rare case a mailbox needs checking again.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, StateWord } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import { resweepDealMail } from '@/app/actions/tc-mail'
import { MAIL_METHOD_LABEL, type DealMailRow } from '@/lib/tc/mail-view'
import { DownloadButton } from './DocumentRowActions'

const DIRECTION_LABEL: Record<DealMailRow['direction'], string> = {
  inbound: 'Received',
  outbound: 'Sent',
  internal: 'Internal',
}

const SHOWN = 25

/** "Filed by property address" / "Filed by hand" — why this email is on this file. */
function whyHereLabel(row: DealMailRow): string {
  if (!row.method) return 'Filed automatically'
  if (row.method === 'manual') return 'Filed by hand'
  return `Filed by ${MAIL_METHOD_LABEL[row.method] ?? row.method}`
}

export function DealMail({ dealId, rows }: { dealId: string; rows: DealMailRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, SHOWN)

  const resweep = () => {
    startTransition(async () => {
      const res = await resweepDealMail(dealId)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(res.message ?? 'Checked mailboxes.')
        router.refresh()
      }
    })
  }

  return (
    <section aria-label="Email" className="av2-pane" style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between gap-3">
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
          Email {rows.length ? `(${rows.length})` : ''}
        </p>
        <Button variant="quiet" disabled={pending} onClick={resweep}>
          {pending ? 'Searching…' : 'Search mailboxes again'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
          No email filed yet. The system files email about this property automatically.
        </p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((row, i) => (
              <li
                key={row.id}
                style={{ padding: '10px 2px', borderTop: i ? '1px solid var(--a-border)' : undefined }}
              >
                <p
                  style={{
                    margin: 0,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: 8,
                    fontSize: 'var(--a-text-sm)',
                  }}
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--a-text-2)' }}>
                    {formatDate(row.sentAt, { year: undefined })}
                  </span>
                  <StateWord state="accent">{DIRECTION_LABEL[row.direction]}</StateWord>
                  <span className="av2-chip">{row.categoryLabel}</span>
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                  {row.fromName || row.fromEmail || 'Unknown sender'}
                  {' → '}
                  {row.to.length ? row.to.join(', ') : '—'}
                </p>
                {row.subject ? (
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--a-text-sm)' }}>{row.subject}</p>
                ) : null}
                <p style={{ margin: '2px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {whyHereLabel(row)}
                </p>
                {row.attachments.length ? (
                  <p
                    style={{
                      margin: '4px 0 0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 'var(--a-text-xs)',
                      color: 'var(--a-text-2)',
                    }}
                  >
                    {row.attachments.map((a, ai) => (
                      <span key={ai} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {a.name}
                        {a.documentId ? <DownloadButton documentId={a.documentId} /> : null}
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {rows.length > SHOWN && !showAll ? (
            <Button variant="quiet" onClick={() => setShowAll(true)}>
              Show all {rows.length}
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}
