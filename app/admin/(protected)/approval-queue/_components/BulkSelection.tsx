'use client'

/**
 * BulkSelection — multi-select + bulk approve/reject for the approval queue (W10.4).
 *
 * Three exports compose the feature:
 *   - <BulkSelectionProvider allIds={...}> wraps the card list in page.tsx and owns
 *     the selected-id Set. Server-rendered ActionCards passed as children read the
 *     context through the client boundary.
 *   - <BulkSelectCheckbox actionId={...}> sits in each ActionCard header.
 *   - <BulkActionBar /> is the sticky bar that appears once ≥1 row is selected; it
 *     posts to /api/admin/approval-queue/bulk-action then router.refresh()es (the
 *     approved/killed rows drop out of the ready/needs_changes fetch and vanish).
 *
 * The bar never mutates a card's local status — a refresh re-derives the queue from
 * the server, so the truth stays server-side.
 *
 * 11F: off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the same context, the
 * same fetch body, the same router.refresh(), the same toast timings and the
 * same visible strings. ci:bulk-approval-wired still reads all three exports.
 *
 * Mapping: Checkbox -> ToolbarCheck (native input, so onCheckedChange becomes
 * onChange with the same toggle); Card -> a var(--a-bg) panel with the overlay
 * shadow the other v2 overlays use (bg, not surface, so the quiet buttons
 * sitting on it keep a visible fill); Textarea + Label -> TextAreaField;
 * Dialog -> the v2 Dialog, whose footer keeps the exact
 * `busy || !rejectReason.trim()` disable that ConfirmDialog cannot express;
 * Alert -> a token-styled role="alert" box.
 *
 * Exactly one primary Button in the file (Approve) — ci:admin-ui rule C.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, TextAreaField, ToolbarCheck } from '@/components/admin/v2'

interface BulkSelectionValue {
  selected: ReadonlySet<string>
  allIds: readonly string[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  selectAll: () => void
  clear: () => void
}

// Default is an inert no-op so a <BulkSelectCheckbox> rendered outside a provider
// (e.g. an ActionCard used standalone in a test) never throws.
const NOOP_VALUE: BulkSelectionValue = {
  selected: new Set(),
  allIds: [],
  isSelected: () => false,
  toggle: () => {},
  selectAll: () => {},
  clear: () => {},
}

const BulkSelectionContext = createContext<BulkSelectionValue>(NOOP_VALUE)

export function useBulkSelection(): BulkSelectionValue {
  return useContext(BulkSelectionContext)
}

export function BulkSelectionProvider({
  allIds,
  children,
}: {
  allIds: string[]
  children: React.ReactNode
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(allIds))
  }, [allIds])

  const clear = useCallback(() => setSelected(new Set()), [])

  const value = useMemo<BulkSelectionValue>(
    () => ({
      selected,
      allIds,
      isSelected: (id: string) => selected.has(id),
      toggle,
      selectAll,
      clear,
    }),
    [selected, allIds, toggle, selectAll, clear],
  )

  return <BulkSelectionContext.Provider value={value}>{children}</BulkSelectionContext.Provider>
}

/** Per-card selection checkbox. Lives in the ActionCard header. */
export function BulkSelectCheckbox({ actionId }: { actionId: string }) {
  const { isSelected, toggle } = useBulkSelection()
  return (
    <ToolbarCheck
      label={null}
      checked={isSelected(actionId)}
      onChange={() => toggle(actionId)}
      aria-label="Select for bulk action"
      labelStyle={{ marginTop: 4 }}
    />
  )
}

/** Sticky bulk-action bar, rendered once per page under the provider. */
export function BulkActionBar() {
  const { selected, allIds, selectAll, clear } = useBulkSelection()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  const count = selected.size
  if (count === 0) return null

  function showToast(msg: string, isError = false) {
    setToast(msg)
    setToastError(isError)
    setTimeout(() => setToast(''), 5000)
  }

  async function callBulk(body: Record<string, unknown>): Promise<number> {
    const res = await fetch('/api/admin/approval-queue/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ids: [...selected] }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
    return typeof j?.affected === 'number' ? j.affected : selected.size
  }

  async function approveAll() {
    setBusy(true)
    try {
      const n = await callBulk({ action: 'approve_now' })
      clear()
      router.refresh()
      showToast(`Approved ${n} item${n === 1 ? '' : 's'}. Publisher picks them up on the next sweep.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk approve failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function rejectAll() {
    if (!rejectReason.trim()) return
    setBusy(true)
    try {
      const n = await callBulk({ action: 'reject', killed_reason: rejectReason.trim() })
      clear()
      setRejectOpen(false)
      setRejectReason('')
      router.refresh()
      showToast(`Killed ${n} item${n === 1 ? '' : 's'}.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk reject failed', true)
    } finally {
      setBusy(false)
    }
  }

  const allSelected = count === allIds.length && allIds.length > 0

  return (
    <>
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            role="alert"
            className="max-w-md px-2.5 py-2"
            style={{
              background: 'var(--a-bg)',
              border: `1px solid ${toastError ? 'var(--a-danger)' : 'var(--a-border)'}`,
              borderRadius: 'var(--a-r-lg)',
              boxShadow: 'var(--a-shadow-overlay)',
              fontSize: 'var(--a-text-sm)',
              color: toastError ? 'var(--a-danger)' : 'var(--a-text)',
            }}
          >
            {toast}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div
          className="flex flex-row flex-wrap items-center gap-3 px-4 py-3"
          style={{
            background: 'var(--a-bg)',
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            boxShadow: 'var(--a-shadow-overlay)',
          }}
        >
          <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
            {count} selected
          </span>
          <Button
            variant="quiet"
            onClick={allSelected ? clear : selectAll}
            disabled={busy}
            style={{ fontSize: 'var(--a-text-xs)' }}
          >
            {allSelected ? 'Deselect all' : `Select all ${allIds.length}`}
          </Button>
          <div
            aria-hidden
            className="mx-1 h-5 w-px"
            style={{ background: 'var(--a-border)' }}
          />
          <Button onClick={approveAll} disabled={busy}>
            {busy ? 'Working...' : `Approve ${count}`}
          </Button>
          <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={busy}>
            Reject {count}
          </Button>
          <Button variant="quiet" onClick={clear} disabled={busy}>
            Clear
          </Button>
        </div>
      </div>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Reject ${count} selected action${count === 1 ? '' : 's'}`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={rejectAll}
              disabled={busy || !rejectReason.trim()}
            >
              {busy ? 'Rejecting...' : `Confirm reject ${count}`}
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Reason (required, applied to all)"
          placeholder="e.g. Batch superseded by a fresh brain cycle."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          required
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          This is permanent. All {count} selected actions move to killed status.
        </p>
      </Dialog>
    </>
  )
}
