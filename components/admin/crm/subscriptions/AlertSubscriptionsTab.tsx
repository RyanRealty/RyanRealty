'use client'

/**
 * AlertSubscriptionsTab — one tab of the Subscriptions hub, parameterized by
 * alert kind: 'guest' (guest_search_alerts) or 'user' (signed-in
 * saved_searches). Search + status + frequency filters, a paginated table with
 * a checkbox column, and a selection toolbar that bulk pauses, resumes,
 * re-cadences, or deletes via the admin actions in
 * app/actions/subscriptions-admin.ts.
 *
 * The page passes the first page (default filters) so the tab renders with
 * data immediately. Every later change refetches through the server action
 * inside a transition, with sonner toasts for the outcome.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  listAlertSubscriptionsAction,
  bulkUpdateAlertSubscriptionsAction,
  bulkDeleteAlertSubscriptionsAction,
} from '@/app/actions/subscriptions-admin'
import type {
  AdminAlertSubscriptionRow,
  ListAlertSubscriptionsResult,
  AlertSubscriptionKind,
} from '@/lib/data/crm/subscriptionsAdmin'
import { getFiltersSummary } from '@/lib/search-filters'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  PAGE_SIZE,
  formatSubscriptionDate,
  StatusBadge,
  OriginBadge,
  PaginationBar,
  TableSkeleton,
} from '@/components/admin/crm/subscriptions/subscriptions-shared'

type StatusFilter = 'active' | 'paused' | 'all'
type FrequencyFilter = 'daily' | 'weekly' | 'all'

function frequencyLabel(f: string): string {
  const v = f.trim().toLowerCase()
  if (v === 'daily') return 'Daily'
  if (v === 'weekly') return 'Weekly'
  if (v === 'instant') return 'Instant'
  return f
}

export default function AlertSubscriptionsTab({
  kind,
  initial,
}: {
  kind: AlertSubscriptionKind
  initial: ListAlertSubscriptionsResult
}) {
  const noun = kind === 'guest' ? 'alert' : 'saved search'
  const nounPlural = kind === 'guest' ? 'alerts' : 'saved searches'

  const [rows, setRows] = useState<AdminAlertSubscriptionRow[]>(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [frequency, setFrequency] = useState<FrequencyFilter>('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Debounce the search box into the applied query.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(t)
  }, [qInput])

  const didInit = useRef(false)
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      return
    }
    startTransition(async () => {
      const res = await listAlertSubscriptionsAction({
        kind, q, status, frequency, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      if (!res.data) {
        toast.error(res.error ?? `Could not load ${nounPlural}`)
        return
      }
      setRows(res.data.rows)
      setTotal(res.data.total)
      setSelected(new Set())
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, frequency, page, kind])

  const reload = () => {
    startTransition(async () => {
      const res = await listAlertSubscriptionsAction({
        kind, q, status, frequency, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      if (!res.data) {
        toast.error(res.error ?? `Could not load ${nounPlural}`)
        return
      }
      setRows(res.data.rows)
      setTotal(res.data.total)
      setSelected(new Set())
    })
  }

  const resetToFirstPage = () => setPage(0)

  const ids = [...selected]
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const toggleAll = () => {
    setSelected((prev) => {
      if (allOnPageSelected) return new Set()
      const next = new Set(prev)
      for (const r of rows) next.add(r.id)
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runUpdate = (patch: { active?: boolean, frequency?: 'daily' | 'weekly' }, verb: string) => {
    startTransition(async () => {
      const res = await bulkUpdateAlertSubscriptionsAction(kind, ids, patch)
      if (!res.data) {
        toast.error(res.error ?? `Could not update those ${nounPlural}`)
        return
      }
      const n = res.data.updated
      toast.success(`${verb} ${n.toLocaleString('en-US')} ${n === 1 ? noun : nounPlural}`)
      reload()
    })
  }

  const runDelete = () => {
    startTransition(async () => {
      const res = await bulkDeleteAlertSubscriptionsAction(kind, ids)
      setConfirmDelete(false)
      if (!res.data) {
        toast.error(res.error ?? `Could not delete those ${nounPlural}`)
        return
      }
      const n = res.data.deleted
      toast.success(`Deleted ${n.toLocaleString('en-US')} ${n === 1 ? noun : nounPlural}`)
      reload()
    })
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={qInput}
          onChange={(e) => {
            setQInput(e.target.value)
            resetToFirstPage()
          }}
          placeholder={kind === 'guest' ? 'Search by email or name' : 'Search by name'}
          className="h-9 w-full sm:w-64"
          aria-label={`Search ${nounPlural}`}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter)
            resetToFirstPage()
          }}
        >
          <SelectTrigger className="h-9 w-32" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={frequency}
          onValueChange={(v) => {
            setFrequency(v as FrequencyFilter)
            resetToFirstPage()
          }}
        >
          <SelectTrigger className="h-9 w-36" aria-label="Frequency filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm tabular-nums text-foreground">
            {selected.size.toLocaleString('en-US')} selected
          </span>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate({ active: false }, 'Paused')}>
            Pause
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate({ active: true }, 'Resumed')}>
            Resume
          </Button>
          <Select value="" onValueChange={(v) => runUpdate({ frequency: v as 'daily' | 'weekly' }, 'Updated frequency for')}>
            <SelectTrigger className="h-8 w-36" aria-label="Set frequency" disabled={isPending}>
              <SelectValue placeholder="Set frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            disabled={isPending}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      {/* Table */}
      {isPending ? (
        <TableSkeleton />
      ) : (
        <div className="no-scrollbar overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows on this page"
                  />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Search</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last notified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No {nounPlural} match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.email ?? row.name ?? noun}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate text-sm text-foreground">{row.email ?? '—'}</p>
                      {row.crmPersonId ? (
                        <Link
                          href={`/admin/crm/${row.crmPersonId}`}
                          className="text-xs text-primary underline-offset-2 hover:underline"
                        >
                          Open contact
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.name?.trim() || 'Saved search'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getFiltersSummary(row.filters ?? {})}
                      </p>
                    </TableCell>
                    <TableCell><OriginBadge origin={row.origin} /></TableCell>
                    <TableCell className="text-sm text-foreground">{frequencyLabel(row.frequency)}</TableCell>
                    <TableCell><StatusBadge active={row.active} /></TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatSubscriptionDate(row.lastNotifiedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar page={page} total={total} isPending={isPending} onPage={setPage} />

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size.toLocaleString('en-US')} {selected.size === 1 ? noun : nounPlural}</DialogTitle>
            <DialogDescription>
              The selected {selected.size === 1 ? `${noun} stops` : `${nounPlural} stop`} sending and the {selected.size === 1 ? 'record is' : 'records are'} removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={runDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
