'use client'

/**
 * SuppressionAdmin — the compliance suppression-list island (Wave 2). The FUB
 * Block List folds in here. It renders who is suppressed and why, lets an owner
 * add a manual block, and lifts a single block with an audit trail. A
 * compliance/litigator row needs an explicit confirm to lift (per the TCPA
 * rule — lifting a hard-stop is a legal liability, never casual, never bulk).
 *
 * Filtering + search + paging are driven by the SERVER page via URL params (the
 * reader is paged); this island owns the add form + the per-row lift, both of
 * which dispatch FormData server actions:
 *   addSuppressionAction(FormData: target, channel, reason)
 *   liftSuppressionAction(FormData: id, confirm)
 * There is intentionally NO bulk-lift control.
 *
 * P11 admin-v2: migrated to the LOCKED admin language
 * (design_system/admin/ADMIN_UI.md). The shadcn Table/Dialog/Select/Input/
 * Label/Badge/Alert are gone, and so is every shadcn semantic color class —
 * those resolve to the PUBLIC brand palette, so converting only the imports
 * would have shipped a compliance screen still wearing the marketing site's
 * colors. Color and type now come from var(--a-*).
 *
 * The channel column still prints the row's OWN channel word (all / email /
 * sms / call). Acceptance bar #5: per-channel state is never collapsed into a
 * single "Blocked", so this migration moved the type and left the word alone.
 *
 * The table is a div/role grid (av2-rgrid*, the ConfigTableEditor shape) plus
 * an av2-cardlist phone fallback — never a raw <table>, and the card list
 * carries its layout in the CLASS, never `md:hidden` plus an inline display.
 *
 * ci:admin-ui rule C allows ONE primary v2 <Button> per file. The dialog's
 * "Add suppression" — the click that actually writes the record — keeps it;
 * the toolbar button that merely OPENS that dialog is quiet. Splitting the
 * dialog into its own file (the ConfigTableEditor pattern) would give both
 * their primary back.
 *
 * Behavior is untouched: same actions, same FormData fields, same URL params,
 * same confirm gate, same strings.
 */
import { useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  ConfirmDialog,
  Dialog,
  SearchField,
  SelectField,
  TextField,
  ToolbarSelect,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { formatDate } from '@/lib/format/date'

export type SuppressionRow = {
  id: number
  personId: number | null
  personName: string | null
  value: string | null
  channel: 'all' | 'email' | 'sms' | 'call'
  reason: string
  source: string
  createdAt: string
  isCompliance: boolean
}

type ActionResult = { ok: true } | { ok: false; error: string }

export type SuppressionAdminActions = {
  /** FormData: target (person id), channel, reason. */
  add: (formData: FormData) => Promise<ActionResult>
  /** FormData: id, confirm ('1' for compliance/litigator rows). */
  lift: (formData: FormData) => Promise<ActionResult>
}

const CHANNELS: Array<{ value: SuppressionRow['channel']; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'call', label: 'Call' },
]

/** Badge — a bordered word, not a pill (pills are reserved for FilterChip). */
const CHANNEL_BADGE: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

/** Same badge, danger ink — the row is a hard stop, not a preference. */
const COMPLIANCE_BADGE: CSSProperties = { ...CHANNEL_BADGE, color: 'var(--a-danger)' }

/** Desktop column template read by report-grid.css at >=720px. */
const GRID_STYLE = {
  '--rgrid-cols': 'minmax(150px,1.1fr) minmax(140px,1fr) 84px minmax(160px,1.2fr) 104px 76px',
  '--rgrid-min': '820px',
} as CSSProperties

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatDate(d)
}

export function SuppressionAdmin({
  rows,
  count,
  unreadable,
  channelFilter,
  query,
  actions,
}: {
  rows: SuppressionRow[]
  count: number
  unreadable: boolean
  channelFilter: SuppressionRow['channel'] | 'any'
  query: string
  actions: SuppressionAdminActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  // Add-form state
  const [addOpen, setAddOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [addChannel, setAddChannel] = useState<SuppressionRow['channel']>('all')
  const [reason, setReason] = useState('')

  // Lift dialog state
  const [liftRow, setLiftRow] = useState<SuppressionRow | null>(null)

  // Filter / search state (drives a URL param navigation on apply)
  const [searchTerm, setSearchTerm] = useState(query)

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: () => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.()
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function buildHref(next: { channel?: string; q?: string }): string {
    const params = new URLSearchParams()
    const ch = next.channel ?? (channelFilter === 'any' ? '' : channelFilter)
    const q = next.q ?? query
    if (ch && ch !== 'any') params.set('channel', ch)
    if (q) params.set('q', q)
    const qs = params.toString()
    return qs ? `/admin/crm/settings/suppression?${qs}` : '/admin/crm/settings/suppression'
  }

  function submitAdd() {
    const pid = target.trim()
    if (!pid || !Number.isFinite(Number(pid))) {
      setNote({ tone: 'err', text: 'A contact id is required to suppress' })
      return
    }
    if (!reason.trim()) {
      setNote({ tone: 'err', text: 'A reason is required' })
      return
    }
    const fd = new FormData()
    fd.set('target', pid)
    fd.set('channel', addChannel)
    fd.set('reason', reason.trim())
    run(() => actions.add(fd), 'Suppression added', () => {
      setAddOpen(false)
      setTarget('')
      setReason('')
      setAddChannel('all')
    })
  }

  function submitLift(confirm: boolean) {
    if (!liftRow) return
    const fd = new FormData()
    fd.set('id', String(liftRow.id))
    if (confirm) fd.set('confirm', '1')
    run(() => actions.lift(fd), 'Suppression lifted', () => setLiftRow(null))
  }

  /** The row's one action, shared by the desktop grid and the phone cards. */
  function liftButton(row: SuppressionRow) {
    return (
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          setLiftRow(row)
          setNote(null)
        }}
      >
        Lift
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      {unreadable ? (
        <VerdictLine tone="attention">
          The suppression list could not be read. Check the table and try again.
        </VerdictLine>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="a-num"
          style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
        >
          {count.toLocaleString('en-US')} {count === 1 ? 'suppression' : 'suppressions'}
        </p>
        <Button
          variant="quiet"
          onClick={() => {
            setAddOpen(true)
            setNote(null)
          }}
          disabled={pending}
        >
          Add suppression
        </Button>
      </div>

      {/* Filter + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ToolbarSelect
          aria-label="Filter by channel"
          className="w-full sm:w-44"
          style={{ maxWidth: '100%' }}
          value={channelFilter === 'any' ? 'any' : channelFilter}
          onChange={(e) => router.push(buildHref({ channel: e.target.value === 'any' ? '' : e.target.value }))}
        >
          <option value="any">Any channel</option>
          {CHANNELS.filter((c) => c.value !== 'all').map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
          <option value="all">All-channel blocks</option>
        </ToolbarSelect>
        <div className="flex flex-1 items-center gap-2">
          <SearchField
            aria-label="Search name, email, or phone"
            className="flex-1"
            style={{ maxWidth: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, or phone"
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(buildHref({ q: searchTerm }))
            }}
          />
          <Button variant="quiet" onClick={() => router.push(buildHref({ q: searchTerm }))}>
            Search
          </Button>
        </div>
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{note.text}</span>
        </VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the phone card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Suppressions">
          <div className="av2-rgrid" role="table" aria-label="Suppressions" style={GRID_STYLE}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                Contact
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Value
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Channel
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Reason
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Added
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No suppressions match this filter.</span>
              </div>
            ) : (
              rows.map((row) => (
                <div key={row.id} role="row" className="av2-rgrid__row">
                  <span
                    role="cell"
                    data-label="Contact"
                    className="av2-rgrid__c"
                    style={{ fontWeight: 500, color: 'var(--a-text)' }}
                  >
                    {row.personName ?? '—'}
                  </span>

                  <span
                    role="cell"
                    data-label="Value"
                    className="av2-rgrid__c"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    {row.value ?? '—'}
                  </span>

                  <span role="cell" data-label="Channel" className="av2-rgrid__c">
                    <span style={CHANNEL_BADGE}>{row.channel}</span>
                  </span>

                  <span role="cell" data-label="Reason" className="av2-rgrid__c">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--a-text)' }}>{row.reason}</span>
                      {row.isCompliance ? <span style={COMPLIANCE_BADGE}>Compliance</span> : null}
                    </span>
                  </span>

                  <span
                    role="cell"
                    data-label="Added"
                    className="av2-rgrid__c a-num"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    {fmtDate(row.createdAt)}
                  </span>

                  <span
                    role="cell"
                    data-label="Actions"
                    className="av2-rgrid__c"
                    style={{ textAlign: 'right' }}
                  >
                    {liftButton(row)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Phone card list — visible below md */}
      <div className="av2-cardlist">
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: '12px 2px',
              fontSize: 'var(--a-text-sm)',
              color: 'var(--a-text-2)',
            }}
          >
            No suppressions match this filter.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="av2-pane"
              style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
                  {row.personName ?? '—'}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {row.value ?? '—'}
                </p>
                <p style={{ margin: '6px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <span style={CHANNEL_BADGE}>{row.channel}</span>
                  <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>{row.reason}</span>
                  {row.isCompliance ? <span style={COMPLIANCE_BADGE}>Compliance</span> : null}
                </p>
                <p
                  className="a-num"
                  style={{ margin: '2px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                >
                  {fmtDate(row.createdAt)}
                </p>
              </div>
              <div style={{ flexShrink: 0 }}>{liftButton(row)}</div>
            </div>
          ))
        )}
      </div>

      {/* Add dialog */}
      <Dialog
        open={addOpen}
        onClose={() => {
          if (!pending) setAddOpen(false)
        }}
        title="Add suppression"
        description="Block a contact from a channel. This writes an audit trail."
        footer={
          <>
            <Button variant="quiet" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={pending}>
              Add suppression
            </Button>
          </>
        }
      >
        <TextField
          label="Contact id"
          hint="The CRM person id of the contact to block."
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Person id"
          inputMode="numeric"
          autoFocus
        />
        <SelectField
          label="Channel"
          value={addChannel}
          onChange={(e) => setAddChannel(e.target.value as SuppressionRow['channel'])}
        >
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this contact is blocked"
        />
      </Dialog>

      {/* Lift dialog — compliance rows require explicit confirm */}
      <ConfirmDialog
        open={!!liftRow}
        onClose={() => {
          if (!pending) setLiftRow(null)
        }}
        title="Lift suppression"
        description={
          liftRow?.isCompliance
            ? 'This is a compliance or litigator suppression. Lifting it is a legal liability and re-opens this channel. Confirm only if you are certain.'
            : 'This removes the block and re-opens the channel for this contact. It is logged with an audit trail.'
        }
        confirmLabel={liftRow?.isCompliance ? 'Confirm and lift' : 'Lift suppression'}
        onConfirm={() => submitLift(!!liftRow?.isCompliance)}
        busy={pending}
      >
        {liftRow ? (
          <div
            style={{
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-md)',
              padding: 'var(--a-s3)',
              fontSize: 'var(--a-text-sm)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--a-text)' }}>
              {liftRow.personName ?? liftRow.value ?? `Suppression ${liftRow.id}`}
            </p>
            <p style={{ margin: 0, color: 'var(--a-text-2)' }}>
              {liftRow.channel} · {liftRow.reason}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
