'use client'

/**
 * Mail queue — the interactive half of app/admin/(protected)/closings/mail.
 * One `<details className="av2-fold">` card per group (loop/page.tsx's Fold
 * pattern, same CSS class, hand-written here since it is a page-local shape
 * and not part of the components/admin/v2 barrel). Every write goes through
 * the existing app/actions/tc-mail.ts server actions — this file owns no
 * Supabase access.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format/date'
import {
  Button,
  Combobox,
  QueueRow,
  SelectField,
  TextField,
  ToolbarCheck,
  type AdminState,
  type ComboboxOption,
} from '@/components/admin/v2'
import { dismissQueuedMail, fileQueuedMail, openFileFromQueuedMail } from '@/app/actions/tc-mail'
import type { MailQueueGroup, MailQueueRow } from '@/lib/tc/mail-view'

export interface DealOption {
  dealId: string
  address: string
  brokerName: string | null
  stage: string
}

const CATEGORY_TONE: Record<string, AdminState> = {
  offer: 'accent',
  counter: 'accent',
  executed_agreement: 'ok',
  addendum: 'waiting',
  disclosure: 'waiting',
  escrow_title: 'waiting',
  lender: 'waiting',
  inspection: 'waiting',
  closing: 'slow',
  post_close: 'ok',
  signing_notice: 'slow',
  general: 'waiting',
}
function categoryTone(category: string): AdminState {
  return CATEGORY_TONE[category] ?? 'waiting'
}

/**
 * Same clock math as lib/data/crm/getInboundTriage.ts formatTriageAge —
 * duplicated, not imported: that module is `server-only` and this file ships
 * to the browser. Keep the two in sync by eye if the shape ever changes.
 */
function ageLabel(iso: string, nowMs: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const mins = Math.max(0, Math.round((nowMs - t) / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
}

function rowContext(row: MailQueueRow): ReactNode {
  const who = row.fromName?.trim() || row.fromEmail || 'Unknown sender'
  const attachments = row.attachments.length ? `Attachments: ${row.attachments.map((a) => a.name).join(', ')}` : null
  return (
    <>
      <div>{who}</div>
      {attachments ? <div>{attachments}</div> : null}
    </>
  )
}

export function MailQueueClient({
  groups,
  dealOptions,
  nowMs,
}: {
  groups: MailQueueGroup[]
  dealOptions: DealOption[]
  nowMs: number
}) {
  const options: ComboboxOption[] = dealOptions.map((d) => ({
    value: d.dealId,
    label: d.address,
    hint: [d.brokerName, d.stage].filter(Boolean).join(' · ') || undefined,
  }))
  return (
    <div>
      {groups.map((g) => (
        // Keyed on row count too: a successful file/dismiss shrinks the group
        // (router.refresh() hands this component a new `groups` prop), and the
        // remount clears stale per-row selection instead of pointing it at
        // message ids that no longer belong to the group.
        <MailGroupCard key={`${g.key}:${g.rows.length}`} group={g} dealOptions={options} nowMs={nowMs} />
      ))}
    </div>
  )
}

function MailGroupCard({
  group,
  dealOptions,
  nowMs,
}: {
  group: MailQueueGroup
  dealOptions: ComboboxOption[]
  nowMs: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(group.rows.map((r) => r.id)))
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pending, start] = useTransition()

  const allIds = group.rows.map((r) => r.id)
  const hasPropertyHint = group.kind === 'property' && group.rows.some((r) => r.propertyHint)
  const candidates = group.rows[0]?.candidates ?? []
  // group.label is already the right display header for a property group
  // (groupMailQueue title-cases the property hint, or falls back to the
  // subject / a generic line when there is none) — only the ambiguous case
  // needs a prefix here, to say WHY several files are named.
  const headerLabel = group.kind === 'ambiguous' ? `Could belong to: ${group.label}` : group.label

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runFile(ids: string[], dealId: string, dealLabel: string) {
    if (!ids.length) {
      toast.error('Select at least one email.')
      return
    }
    start(async () => {
      const res = await fileQueuedMail({ messageIds: ids, dealId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? `Filed to ${dealLabel}.`)
      setShowPicker(false)
      router.refresh()
    })
  }

  function runDismiss(ids: string[]) {
    if (!ids.length) {
      toast.error('Select at least one email.')
      return
    }
    start(async () => {
      const res = await dismissQueuedMail({ messageIds: ids })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'Marked as not a deal.')
      router.refresh()
    })
  }

  function submitOpenFile(fd: FormData) {
    const address = String(fd.get('address') ?? '').trim()
    const representation = fd.get('representation') === 'buyer' ? 'buyer' : 'seller'
    start(async () => {
      const res = await openFileFromQueuedMail({ messageIds: allIds, address, representation })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'File opened.')
      if (res.dealKey) router.push(`/admin/deals/${encodeURIComponent(res.dealKey)}`)
      else router.refresh()
    })
  }

  return (
    <details className="av2-fold" open style={{ marginBottom: 12 }}>
      <summary>
        <span>{headerLabel}</span>
        <span className="av2-fold__hint">
          {group.rows.length} email{group.rows.length === 1 ? '' : 's'} · {formatDate(group.latestAt)}
        </span>
      </summary>
      <div className="av2-fold__body">
        <ul className="av2-queue" style={{ marginTop: 0 }}>
          {group.rows.map((row) => {
            const subjectLabel = row.subject?.trim() || '(no subject)'
            return (
              <QueueRow
                key={row.id}
                kind={row.categoryLabel}
                kindTone={categoryTone(row.category)}
                title={subjectLabel}
                context={rowContext(row)}
                age={ageLabel(row.sentAt, nowMs)}
                action={
                  <ToolbarCheck
                    label={<span style={visuallyHidden}>{`Select email: ${subjectLabel}`}</span>}
                    checked={selected.has(row.id)}
                    disabled={pending}
                    onChange={() => toggle(row.id)}
                  />
                }
              />
            )
          })}
        </ul>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {group.kind === 'property' ? (
            <Button variant="quiet" touch disabled={pending} onClick={() => setShowOpenForm((v) => !v)}>
              Open a file for this property
            </Button>
          ) : null}
          {candidates.map((c) => (
            <Button
              key={c.dealId}
              variant="quiet"
              touch
              disabled={pending}
              onClick={() => runFile(allIds, c.dealId, c.address)}
            >
              File to {c.address.split(',')[0]}
            </Button>
          ))}
          <Button variant="quiet" touch disabled={pending} onClick={() => setShowPicker((v) => !v)}>
            File to an existing deal
          </Button>
          <Button variant="quiet" touch disabled={pending} onClick={() => runDismiss([...selected])}>
            Not a deal
          </Button>
        </div>

        {showOpenForm ? (
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, maxWidth: 420 }}
            onSubmit={(e) => {
              e.preventDefault()
              submitOpenFile(new FormData(e.currentTarget))
            }}
          >
            <TextField
              label="Property address"
              name="address"
              required
              defaultValue={hasPropertyHint ? `${group.label}, ` : ''}
              hint="Complete the city and state, e.g. “…, Bend, OR”."
              placeholder="909 NW Delaware Ave, Bend, OR"
              disabled={pending}
            />
            <SelectField label="Representation" name="representation" defaultValue="seller" disabled={pending}>
              <option value="seller">Seller (listing)</option>
              <option value="buyer">Buyer (sale)</option>
            </SelectField>
            <Button type="submit" touch disabled={pending}>
              {pending ? 'Opening…' : `Open file and attach ${allIds.length} email${allIds.length === 1 ? '' : 's'}`}
            </Button>
          </form>
        ) : null}

        {showPicker ? (
          <div style={{ marginTop: 12, maxWidth: 420 }}>
            <Combobox
              label="Search deals"
              options={dealOptions}
              onSelect={(dealId) => {
                const ids = [...selected]
                const label = dealOptions.find((o) => o.value === dealId)?.label ?? 'the deal'
                runFile(ids, dealId, label)
              }}
              placeholder="Address, or broker…"
              emptyText="No deals match."
              disabled={pending}
            />
          </div>
        ) : null}
      </div>
    </details>
  )
}
