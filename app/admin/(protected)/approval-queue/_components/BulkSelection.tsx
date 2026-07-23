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
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
    <Checkbox
      checked={isSelected(actionId)}
      onCheckedChange={() => toggle(actionId)}
      aria-label="Select for bulk action"
      className="mt-1"
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
          <Alert variant={toastError ? 'destructive' : 'default'} className="max-w-md shadow-lg">
            <AlertDescription>{toast}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <Card className="flex flex-row flex-wrap items-center gap-3 px-4 py-3 shadow-lg">
          <span className="text-sm font-semibold text-foreground">
            {count} selected
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={allSelected ? clear : selectAll}
            disabled={busy}
            className="text-xs"
          >
            {allSelected ? 'Deselect all' : `Select all ${allIds.length}`}
          </Button>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button
            size="sm"
            onClick={approveAll}
            disabled={busy}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {busy ? 'Working...' : `Approve ${count}`}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRejectOpen(true)}
            disabled={busy}
          >
            Reject {count}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={busy}>
            Clear
          </Button>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reject {count} selected action{count === 1 ? '' : 's'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="bulk-reject-reason">Reason (required, applied to all)</Label>
            <Textarea
              id="bulk-reject-reason"
              placeholder="e.g. Batch superseded by a fresh brain cycle."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
            <p className="text-xs text-destructive">
              This is permanent. All {count} selected actions move to killed status.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={rejectAll}
              disabled={busy || !rejectReason.trim()}
            >
              {busy ? 'Rejecting...' : `Confirm reject ${count}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
