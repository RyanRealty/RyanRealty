'use client'

/**
 * ReportSubscriptionsTab — the Market reports tab of the Subscriptions hub.
 * One row per crm_report_subscriptions record (person-keyed). Search + status
 * + frequency filters, a paginated table with a checkbox column, and a
 * selection toolbar for bulk pause, resume, and frequency changes via
 * app/actions/subscriptions-admin.ts. Report subscriptions have no bulk
 * delete (pausing is the off switch — the row keeps the person's areas).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  listReportSubscriptionsAdminAction,
  bulkUpdateReportSubscriptionsAction,
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
  PAGE_SIZE,
  formatSubscriptionDate,
  StatusBadge,
  PaginationBar,
  TableSkeleton,
} from '@/components/admin/crm/subscriptions/subscriptions-shared'

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
  const [isPending, startTransition] = useTransition()

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
  }, [q, status, frequency, page])

  const reload = () => {
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

  const runUpdate = (patch: { active?: boolean, frequency?: ReportFrequency }, verb: string) => {
    startTransition(async () => {
      const res = await bulkUpdateReportSubscriptionsAction(personIds, patch)
      if (!res.data) {
        toast.error(res.error ?? 'Could not update those subscriptions')
        return
      }
      const n = res.data.updated
      toast.success(`${verb} ${n.toLocaleString('en-US')} ${n === 1 ? 'subscription' : 'subscriptions'}`)
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
          placeholder="Search by name"
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
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate({ active: false }, 'Paused')}>
            Pause
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => runUpdate({ active: true }, 'Resumed')}>
            Resume
          </Button>
          <Select value="" onValueChange={(v) => runUpdate({ frequency: v as ReportFrequency }, 'Updated frequency for')}>
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
                <TableHead>Last sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
                        aria-label={`Select ${row.personName ?? row.personEmail ?? 'contact'}`}
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
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatSubscriptionDate(row.lastSentAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar page={page} total={total} isPending={isPending} onPage={setPage} />
    </div>
  )
}
