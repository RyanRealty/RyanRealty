'use client'

/**
 * Who this batch is actually going to — and the controls to change it.
 *
 * The Batch Email dialog used to print "6 contacts." and nothing more. You
 * could not see a single name or address, drop the one person who should not
 * get it, or add the client who was not in the filter. This panel closes all
 * three, using the same resolver the count and the worker use so what is listed
 * IS the cohort.
 *
 * EDIT SEMANTICS. Removing or adding anyone converts the send to an explicit id
 * set (mode 'ids') built from what is on screen. Untouched, the original
 * selection is passed through unchanged, so a saved-view or "all matching" send
 * still resolves at run time and picks up anyone who joined the filter since the
 * dialog opened. A cohort past the preview cap cannot be edited by hand — the
 * panel says so instead of letting a 200-row sample silently become the send.
 */

import { useEffect, useState, useTransition } from 'react'
import { Loader2, X } from 'lucide-react'
import { previewBulkRecipientsAction, searchBulkRecipientsAction } from '@/app/actions/crm-bulk'
import type { BulkRecipient } from '@/lib/crm/bulk-recipients'
import type { BulkActionSelection } from '@/lib/crm/bulk-helpers'
import { Button, IconButton, SearchField } from '@/components/admin/v2'

export type BatchRecipientsState = {
  /** Null until the preview resolves. */
  people: BulkRecipient[] | null
  total: number
  /** True when the cohort is bigger than the preview cap. */
  capped: boolean
  /** True once the operator removed or added anyone. */
  edited: boolean
}

export const EMPTY_RECIPIENTS: BatchRecipientsState = {
  people: null,
  total: 0,
  capped: false,
  edited: false,
}

export function BatchRecipients({
  selection,
  state,
  onChange,
}: {
  selection: BulkActionSelection
  state: BatchRecipientsState
  onChange: (next: BatchRecipientsState) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<BulkRecipient[]>([])
  const [searching, startSearch] = useTransition()

  // Resolve once per dialog open. The selection is frozen for the life of the
  // dialog, so this deliberately does not re-run on every keystroke elsewhere.
  const selectionKey = JSON.stringify(selection)
  useEffect(() => {
    let live = true
    setLoading(true)
    previewBulkRecipientsAction(JSON.parse(selectionKey) as BulkActionSelection).then((res) => {
      if (!live) return
      setLoading(false)
      if (!res.ok) { setError(res.error); return }
      setError(null)
      onChange({ people: res.people, total: res.total, capped: res.capped, edited: false })
    })
    return () => { live = false }
    // onChange is recreated each render by the parent; keying on the selection
    // is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey])

  useEffect(() => {
    if (!term.trim() || term.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await searchBulkRecipientsAction(term)
        setHits(res.ok ? res.results : [])
      })
    }, 200)
    return () => clearTimeout(t)
  }, [term])

  const people = state.people ?? []

  function remove(id: number) {
    onChange({ ...state, people: people.filter((p) => p.id !== id), total: state.total - 1, edited: true })
  }
  function add(hit: BulkRecipient) {
    if (people.some((p) => p.id === hit.id)) return
    onChange({ ...state, people: [...people, hit], total: state.total + 1, edited: true })
    setTerm('')
    setHits([])
    setOpen(false)
  }

  const label = `${state.total.toLocaleString('en-US')} ${state.total === 1 ? 'recipient' : 'recipients'}`

  return (
    <div style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)', padding: 10 }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500 }}>
          {loading ? 'Resolving recipients…' : label}
        </span>
        {!loading && !state.capped ? (
          <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
            {open ? 'Done' : 'Add someone'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)', marginTop: 6 }} role="alert">
          Could not read the recipients: {error}
        </p>
      ) : null}

      {state.capped ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 6 }}>
          Too many to list one by one. Showing the first {people.length}; the send goes to all{' '}
          {state.total.toLocaleString('en-US')}. Narrow the list first to edit it by hand.
        </p>
      ) : null}

      {open ? (
        <div style={{ marginTop: 8 }}>
          <SearchField
            aria-label="Find a contact to add"
            placeholder="Find a contact by name, email or phone"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{ width: '100%', maxWidth: 'none' }}
          />
          {searching ? (
            <Loader2 className="mt-2 h-4 w-4 animate-spin" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          ) : null}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => add(h)}
              className="mt-1 block w-full text-left"
              style={{
                fontSize: 'var(--a-text-sm)', padding: '6px 8px',
                borderRadius: 'var(--a-r-sm)', background: 'var(--a-inset)',
                border: 0, cursor: 'pointer', color: 'var(--a-text)',
              }}
            >
              {h.name} <span style={{ color: 'var(--a-text-2)' }}>{h.email}</span>
            </button>
          ))}
          {term.trim().length >= 2 && !searching && hits.length === 0 ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 6 }}>
              No contact with an email address matches “{term.trim()}”.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && people.length > 0 ? (
        <ul style={{ marginTop: 8, maxHeight: 168, overflowY: 'auto', listStyle: 'none', padding: 0 }}>
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2" style={{ padding: '3px 0' }}>
              <span style={{ fontSize: 'var(--a-text-xs)', minWidth: 0 }} className="truncate">
                {p.name} <span style={{ color: 'var(--a-text-2)' }}>{p.email || 'no email'}</span>
                {/* Channel-aware, not a red wall: this contact is email-blocked, and
                    the worker will skip them. Saying it here stops the "why did 3
                    of 40 not arrive" question after the fact. */}
                {p.suppressed ? <span style={{ color: 'var(--a-warn)' }}> · will be skipped</span> : null}
              </span>
              {!state.capped ? (
                <IconButton label={`Remove ${p.name}`} onClick={() => remove(p.id)} style={{ width: 18, height: 18 }}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default BatchRecipients
