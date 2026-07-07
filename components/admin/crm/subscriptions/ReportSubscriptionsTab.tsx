'use client'

/**
 * ReportSubscriptionsTab — the Market reports tab of the Subscriptions hub.
 * One row per crm_report_subscriptions record (person-keyed). Search (name or
 * email) + status + frequency filters, per-row engagement (sends / opens /
 * clicks / last open from email_events), a per-row actions menu (edit
 * areas/cadence, rendered email preview, assign broker, pause/resume, delete
 * with confirm), and a selection toolbar for bulk pause / resume / frequency
 * changes via app/actions/subscriptions-admin.ts.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import {
  listReportSubscriptionsAdminAction,
  bulkUpdateReportSubscriptionsAction,
  deleteReportSubscriptionAction,
  previewReportEmailAction,
} from '@/app/actions/subscriptions-admin'
import type { AdminReportSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
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
  EngagementCell,
  PaginationBar,
  TableSkeleton,
} from '@/components/admin/crm/subscriptions/subscriptions-shared'
import ReportEditDialog from '@/components/admin/crm/subscriptions/ReportEditDialog'
import AssignBrokerDialog from '@/components/admin/crm/subscriptions/AssignBrokerDialog'
import EmailPreviewDialog from '@/components/admin/crm/subscriptions/EmailPreviewDialog'

type StatusFilter = 'active' | 'paused' | 'all'
type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'
type FrequencyFilter = ReportFrequency | 'all'

function frequencyLabel(f: string): string {
  const v = f.trim().toLowerCase()
  if (v === 'weekly') return 'Weekly'
  if (v === 'monthly') return 'Monthly'
  if (v === 'quarterly') return 'Quarterly'
  return f
}

function contactLabel(row: AdminReportSubscriptionRow): string {
  return row.personName?.trim() || row.personEmail || `Contact #${row.personId}`
}

export default function ReportSubscriptionsTab({
  initial,
}: {
  initial: { rows: AdminReportSubscriptionRow[], total: number }
}) {
  const [rows, setRows] = useState<AdminReportSubscriptionRow[]>(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [frequency, setFrequency] = useState<FrequencyFilter>('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editRow, setEditRow] = useState<AdminReportSubscriptionRow | null>(null)
  const [previewRow, setPreviewRow] = useState<AdminReportSubscriptionRow | null>(null)
  const [assignRow, setAssignRow] = useState<AdminReportSubscriptionRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<AdminReportSubscriptionRow | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(t)
  }, [qInput])

  const fetchPage = () => {
    startTransition(async () => {
      const res = await listReportSubscriptionsAdminAction({
        q, status, frequency, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      if (!res.data) {
        toast.error(res.error ?? 'Could not load market report subscriptions')
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
  }, [q, status, frequency, page])

  const reload = fetchPage
  const resetToFirstPage = () => setPage(0)

  const personIds = [...selected]
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.personId))

  const toggleAll = () => {
    setSelected((prev) => {
      if (allOnPageSelected) return new Set()
      const next = new Set(prev)
      for (const r of rows) next.add(r.personId)
      return next
    })
  }

  const toggleOne = (personId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const runUpdate = (
    targetIds: number[],
    patch: { active?: boolean, frequency?: ReportFrequency },
    verb: string,
  ) => {
    startTransition(async () => {
      const res = await bulkUpdateReportSubscriptionsAction(targetIds, patch)
      if (!res.data) {
        toast.error(res.error ?? 'Could not update those subscriptions')
        return
      }
      const n = res.data.updated
      toast.success(`${verb} ${n.toLocaleString('en-US')} ${n === 1 ? 'subscription' : 'subscriptions'}`)
      reload()
    })
  }

  const runDelete = () => {
    if (!deleteRow) return
    startTransition(async () => {
      const res = await deleteReportSubscriptionAction(deleteRow.personId)
      setDeleteRow(null)
      if (!res.data) {
        toast.error(res.error ?? 'Could not delete that subscription')
        return
      }
      toast.success('Deleted the subscription')
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
          placeholder="Search by name or email"
          className="h-9 w-full sm:w-64"
          aria-label="Search market report subscriptions"
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
          <SelectTrigger className="h-9 w-40" aria-label="Frequency filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm tabular-nums text-foreground">
            {selected.size.toLocaleString('en-US')} selected
          </span>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate(personIds, { active: false }, 'Paused')}>
            Pause
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate(personIds, { active: true }, 'Resumed')}>
            Resume
          </Button>
          <Select value="" onValueChange={(v) => runUpdate(personIds, { frequency: v as ReportFrequency }, 'Updated frequency for')}>
            <SelectTrigger className="h-8 w-36" aria-label="Set frequency" disabled={isPending}>
              <SelectValue placeholder="Set frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Broker</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead className="w-10" aria-label="Row actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No market report subscriptions match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.personId} data-state={selected.has(row.personId) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.personId)}
                        onCheckedChange={() => toggleOne(row.personId)}
                        aria-label={`Select ${contactLabel(row)}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <Link
                        href={`/admin/crm/${row.personId}`}
                        className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {row.personName?.trim() || `Contact #${row.personId}`}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{row.personEmail ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{row.assignedBroker ?? '—'}</TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate text-sm text-foreground">
                        {row.areas.length > 0 ? row.areas.join(', ') : '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{frequencyLabel(row.frequency)}</TableCell>
                    <TableCell><StatusBadge active={row.active} /></TableCell>
                    <TableCell><EngagementCell engagement={row.engagement} /></TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatSubscriptionDate(row.lastSentAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground"
                            aria-label={`Actions for ${contactLabel(row)}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditRow(row)}>Edit areas &amp; cadence</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setPreviewRow(row)}>Preview email</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setAssignRow(row)}>Assign broker</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => runUpdate([row.personId], { active: !row.active }, row.active ? 'Paused' : 'Resumed')}
                          >
                            {row.active ? 'Pause' : 'Resume'}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteRow(row)}>
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

      {/* Delete confirm */}
      <Dialog open={deleteRow !== null} onOpenChange={(o) => { if (!o) setDeleteRow(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this subscription</DialogTitle>
            <DialogDescription>
              {deleteRow ? contactLabel(deleteRow) : 'This contact'} stops getting market report emails and the subscription record is removed. The CRM contact is kept. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={runDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editRow ? (
        <ReportEditDialog row={editRow} onClose={() => setEditRow(null)} onSaved={reload} />
      ) : null}

      {previewRow ? (
        <EmailPreviewDialog
          open
          title="Market report email"
          load={() => previewReportEmailAction(previewRow.personId, previewRow.personName)}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}

      {assignRow ? (
        <AssignBrokerDialog
          personId={assignRow.personId}
          contactLabel={contactLabel(assignRow)}
          currentBroker={assignRow.assignedBroker}
          onClose={() => setAssignRow(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  )
}
