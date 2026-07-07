'use client'

/**
 * AlertSubscriptionsTab — one tab of the Subscriptions hub, parameterized by
 * alert kind: 'guest' (guest_search_alerts) or 'user' (signed-in
 * saved_searches). Search + status + frequency (+ origin for guest) filters, a
 * paginated table with a checkbox column, per-row engagement (sends / opens /
 * clicks / last open from email_events), a per-row actions menu (edit filters,
 * rendered email preview, assign broker, pause/resume, delete), and a
 * selection toolbar for bulk pause / resume / re-cadence / delete via
 * app/actions/subscriptions-admin.ts.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import {
  listAlertSubscriptionsAction,
  bulkUpdateAlertSubscriptionsAction,
  bulkDeleteAlertSubscriptionsAction,
  previewAlertEmailAction,
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PAGE_SIZE,
  formatSubscriptionDate,
  StatusBadge,
  OriginBadge,
  EngagementCell,
  PaginationBar,
  TableSkeleton,
} from '@/components/admin/crm/subscriptions/subscriptions-shared'
import AlertEditDialog from '@/components/admin/crm/subscriptions/AlertEditDialog'
import AssignBrokerDialog from '@/components/admin/crm/subscriptions/AssignBrokerDialog'
import EmailPreviewDialog from '@/components/admin/crm/subscriptions/EmailPreviewDialog'

type StatusFilter = 'active' | 'paused' | 'all'
type FrequencyFilter = 'daily' | 'weekly' | 'all'
type OriginFilter = 'user' | 'broker' | 'system' | 'all'

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
  const [origin, setOrigin] = useState<OriginFilter>('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Delete confirm target: the current selection, or one row from its menu.
  const [deleteTarget, setDeleteTarget] = useState<'selection' | AdminAlertSubscriptionRow | null>(null)
  const [editRow, setEditRow] = useState<AdminAlertSubscriptionRow | null>(null)
  const [previewRow, setPreviewRow] = useState<AdminAlertSubscriptionRow | null>(null)
  const [assignRow, setAssignRow] = useState<AdminAlertSubscriptionRow | null>(null)
  const [isPending, startTransition] = useTransition()

  // Debounce the search box into the applied query.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(t)
  }, [qInput])

  const fetchPage = () => {
    startTransition(async () => {
      const res = await listAlertSubscriptionsAction({
        kind, q, status, frequency, origin, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
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

  const didInit = useRef(false)
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      return
    }
    fetchPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, frequency, origin, page, kind])

  const reload = fetchPage
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

  const runUpdate = (
    targetIds: string[],
    patch: { active?: boolean, frequency?: 'daily' | 'weekly' },
    verb: string,
  ) => {
    startTransition(async () => {
      const res = await bulkUpdateAlertSubscriptionsAction(kind, targetIds, patch)
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
    const targetIds = deleteTarget === 'selection' ? ids : deleteTarget ? [deleteTarget.id] : []
    if (targetIds.length === 0) {
      setDeleteTarget(null)
      return
    }
    startTransition(async () => {
      const res = await bulkDeleteAlertSubscriptionsAction(kind, targetIds)
      setDeleteTarget(null)
      if (!res.data) {
        toast.error(res.error ?? `Could not delete those ${nounPlural}`)
        return
      }
      const n = res.data.deleted
      toast.success(`Deleted ${n.toLocaleString('en-US')} ${n === 1 ? noun : nounPlural}`)
      reload()
    })
  }

  const deleteCount = deleteTarget === 'selection' ? selected.size : deleteTarget ? 1 : 0

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
        {kind === 'guest' ? (
          <Select
            value={origin}
            onValueChange={(v) => {
              setOrigin(v as OriginFilter)
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="h-9 w-36" aria-label="Origin filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All origins</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="broker">Broker</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm tabular-nums text-foreground">
            {selected.size.toLocaleString('en-US')} selected
          </span>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate(ids, { active: false }, 'Paused')}>
            Pause
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate(ids, { active: true }, 'Resumed')}>
            Resume
          </Button>
          <Select value="" onValueChange={(v) => runUpdate(ids, { frequency: v as 'daily' | 'weekly' }, 'Updated frequency for')}>
            <SelectTrigger className="h-8 w-36" aria-label="Set frequency" disabled={isPending}>
              <SelectValue placeholder="Set frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setDeleteTarget('selection')}>
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
                <TableHead>Engagement</TableHead>
                <TableHead>Last notified</TableHead>
                <TableHead className="w-10" aria-label="Row actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
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
                    <TableCell><EngagementCell engagement={row.engagement} /></TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatSubscriptionDate(row.lastNotifiedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground"
                            aria-label={`Actions for ${row.email ?? row.name ?? noun}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditRow(row)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setPreviewRow(row)}>Preview email</DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!row.crmPersonId}
                            onSelect={() => setAssignRow(row)}
                          >
                            Assign broker
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => runUpdate([row.id], { active: !row.active }, row.active ? 'Paused' : 'Resumed')}
                          >
                            {row.active ? 'Pause' : 'Resume'}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(row)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar page={page} total={total} isPending={isPending} onPage={setPage} />

      {/* Delete confirm (selection or a single row) */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteCount.toLocaleString('en-US')} {deleteCount === 1 ? noun : nounPlural}</DialogTitle>
            <DialogDescription>
              The selected {deleteCount === 1 ? `${noun} stops` : `${nounPlural} stop`} sending and the {deleteCount === 1 ? 'record is' : 'records are'} removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={runDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editRow ? (
        <AlertEditDialog row={editRow} onClose={() => setEditRow(null)} onSaved={reload} />
      ) : null}

      {previewRow ? (
        <EmailPreviewDialog
          open
          title="Listing alert email"
          load={() => previewAlertEmailAction(kind, previewRow.id)}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}

      {assignRow?.crmPersonId ? (
        <AssignBrokerDialog
          personId={assignRow.crmPersonId}
          contactLabel={assignRow.email ?? assignRow.name ?? 'this contact'}
          currentBroker={null}
          onClose={() => setAssignRow(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  )
}
