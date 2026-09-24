'use client'

// Filed email on this deal (the Vault mail index, tc_mail_messages). The rules
// file most of it on their own — this section shows what landed and why, lets
// a broker correct a misfile (move it to another file, or mark it never was
// a deal — docs/TC_MAIL_FILING_RULES.md "Every message reviewed" / the
// 2026-09-24 correction-controls audit), plus a resweep for the rare case a
// mailbox needs checking again.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { Button, Combobox, ConfirmDialog, Dialog, Menu, StateWord, type ComboboxOption } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import { moveFiledMailToDeal, resweepDealMail, unfileDealMail } from '@/app/actions/tc-mail'
import { MAIL_METHOD_LABEL, type DealMailRow } from '@/lib/tc/mail-view'
import { DownloadButton } from './DocumentRowActions'

const DIRECTION_LABEL: Record<DealMailRow['direction'], string> = {
  inbound: 'Received',
  outbound: 'Sent',
  internal: 'Internal',
}

const SHOWN = 25

/** Another file a broker can pick as a correction's destination. */
export interface MailDealOption {
  dealId: string
  address: string
  brokerName: string | null
  stage: string
}

/** "Filed by property address" / "Filed by hand" — why this email is on this file. */
function whyHereLabel(row: DealMailRow): string {
  if (!row.method) return 'Filed automatically'
  if (row.method === 'manual') return 'Filed by hand'
  return `Filed by ${MAIL_METHOD_LABEL[row.method] ?? row.method}`
}

/** A person corrected this row (decided_by is their email) — never 'system', 'model', or the sweep's 'system:*' actor. */
function correctedByLabel(row: DealMailRow): string | null {
  const by = row.decidedBy
  if (!by || by === 'system' || by === 'model' || by.startsWith('system:')) return null
  return `Corrected by ${by}`
}

type Target = { row: DealMailRow; mode: 'move' | 'unfile' }

export function DealMail({ dealId, rows, dealOptions }: { dealId: string; rows: DealMailRow[]; dealOptions: MailDealOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const visible = showAll ? rows : rows.slice(0, SHOWN)

  const fileOptions: ComboboxOption[] = dealOptions
    .filter((d) => d.dealId !== dealId)
    .map((d) => ({ value: d.dealId, label: d.address, hint: [d.brokerName, d.stage].filter(Boolean).join(' · ') || undefined }))

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

  function runMove(row: DealMailRow, toDealId: string, toLabel: string) {
    startTransition(async () => {
      const res = await moveFiledMailToDeal({ messageId: row.id, toDealId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? `Moved to ${toLabel}.`)
      setTarget(null)
      router.refresh()
    })
  }

  function runUnfile(row: DealMailRow) {
    startTransition(async () => {
      const res = await unfileDealMail({ messageId: row.id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'Marked not a deal.')
      setTarget(null)
      router.refresh()
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
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
                  <Menu
                    label={`Correct filing: ${row.subject || 'this email'}`}
                    tooltip
                    trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                    items={[
                      { label: 'Move to another file', disabled: pending, onSelect: () => setTarget({ row, mode: 'move' }) },
                      { label: 'Not a deal', danger: true, disabled: pending, onSelect: () => setTarget({ row, mode: 'unfile' }) },
                    ]}
                  />
                </div>
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
                  {correctedByLabel(row) ? ` · ${correctedByLabel(row)}` : ''}
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

      <Dialog
        open={target?.mode === 'move'}
        onClose={() => setTarget(null)}
        title="Move to another file"
        description={target ? target.row.subject || 'This email' : undefined}
      >
        {target?.mode === 'move' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {target.row.candidates.length ? (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  The filer also weighed:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {target.row.candidates.map((c) => (
                    <Button
                      key={c.dealId}
                      variant="quiet"
                      disabled={pending}
                      onClick={() => runMove(target.row, c.dealId, c.address)}
                    >
                      {c.address.split(',')[0]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <Combobox
              label="Search files"
              options={fileOptions}
              onSelect={(toDealId) => {
                const label = fileOptions.find((o) => o.value === toDealId)?.label ?? 'that file'
                runMove(target.row, toDealId, label)
              }}
              placeholder="Address, or broker…"
              emptyText="No files match."
              disabled={pending}
            />
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={target?.mode === 'unfile'}
        onClose={() => setTarget(null)}
        title="Mark not a deal"
        description={
          target
            ? `Removes "${target.row.subject || 'this email'}" from this file. It stays in the mail index as not a deal — never deleted.`
            : undefined
        }
        confirmLabel={pending ? 'Marking…' : 'Not a deal'}
        onConfirm={() => target && runUnfile(target.row)}
        busy={pending}
      />
    </section>
  )
}
