'use client'

/**
 * ReportSubscriptionsTab — the Market reports tab of the Subscriptions hub.
 * One row per crm_report_subscriptions record (person-keyed). Search (name or
 * email) + status + frequency filters, per-row engagement (sends / opens /
 * clicks / last open from email_events), a per-row actions menu (edit
 * areas/cadence, rendered email preview, assign broker, pause/resume, delete
 * with confirm), and a selection toolbar for bulk pause / resume / frequency
 * changes via app/actions/subscriptions-admin.ts.
 *
 * P11F: on the LOCKED admin v2 language — same conversion as its sibling
 * AlertSubscriptionsTab: shadcn Input/Select/Checkbox/Table/Dialog/
 * DropdownMenu/Button out, the av2-rgrid div/role reader in, colour from
 * var(--a-*) only. Every filter, mutation and string is carried over verbatim.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  listReportSubscriptionsAdminAction,
  bulkUpdateReportSubscriptionsAction,
  deleteReportSubscriptionAction,
  previewReportEmailAction,
} from '@/app/actions/subscriptions-admin'
import type { AdminReportSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import {
  Button,
  ConfirmDialog,
  Menu,
  SearchField,
  ToolbarCheck,
  ToolbarSelect,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
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

  // Desktop column template — the custom property report-grid.css reads at
  // >=720px. Below that the same markup stacks into one block per row.
  //
  // NO --rgrid-min and NO .av2-rgrid__scroll wrapper, deliberately — same call
  // as the sibling AlertSubscriptionsTab: the row actions are a v2 <Menu> whose
  // panel is position:absolute inside the row and is NOT portaled the way the
  // shadcn DropdownMenu it replaces was, so a scroll container would clip it
  // shut on the last rows (i.e. on every row of a short list). The tracks fit
  // the narrowest container the grid renders in (640px; minimums 542 + 8×12px
  // gaps = 638), and the fr units expand them on a real desktop. The actions
  // track is 44px because .av2-iconbtn is --a-touch wide on a coarse pointer.
  const gridStyle = {
    '--rgrid-cols':
      '20px minmax(68px,1.4fr) minmax(64px,0.8fr) minmax(74px,1.3fr) 58px 62px minmax(84px,1.2fr) 68px 44px',
  } as CSSProperties

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={qInput}
          onChange={(e) => {
            setQInput(e.target.value)
            resetToFirstPage()
          }}
          placeholder="Search by name or email"
          className="w-full sm:w-64"
          // Releases .av2-input--bar's 200px cap so the width classes decide.
          style={{ maxWidth: '100%' }}
          aria-label="Search market report subscriptions"
        />
        <ToolbarSelect
          className="w-32"
          aria-label="Status filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter)
            resetToFirstPage()
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </ToolbarSelect>
        <ToolbarSelect
          className="w-40"
          aria-label="Frequency filter"
          value={frequency}
          onChange={(e) => {
            setFrequency(e.target.value as FrequencyFilter)
            resetToFirstPage()
          }}
        >
          <option value="all">All frequencies</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </ToolbarSelect>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
          style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
        >
          <span className="text-sm tabular-nums" style={{ color: 'var(--a-text)' }}>
            {selected.size.toLocaleString('en-US')} selected
          </span>
          <Button variant="quiet" disabled={isPending} onClick={() => runUpdate(personIds, { active: false }, 'Paused')}>
            Pause
          </Button>
          <Button variant="quiet" disabled={isPending} onClick={() => runUpdate(personIds, { active: true }, 'Resumed')}>
            Resume
          </Button>
          <ToolbarSelect
            className="w-36"
            aria-label="Set frequency"
            value=""
            disabled={isPending}
            onChange={(e) => {
              if (!e.target.value) return
              runUpdate(personIds, { frequency: e.target.value as ReportFrequency }, 'Updated frequency for')
            }}
          >
            <option value="" disabled>Set frequency</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </ToolbarSelect>
          <Button
            variant="quiet"
            className="ml-auto"
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
        <div>
          {/* Select-all, phone only — report-grid.css hides .av2-rgrid__head
              below 720px and the header's select-all with it. Exactly one of
              the two is in the accessibility tree at any width. */}
          <div className="hidden items-center gap-2 pb-2 max-[719.98px]:flex">
            <ToolbarCheck
              label="Select all"
              checked={allOnPageSelected}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          <div
            className="av2-rgrid"
            role="table"
            aria-label="Market report subscriptions"
            style={gridStyle}
          >
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                <ToolbarCheck
                  label=""
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows on this page"
                />
              </span>
              <span role="columnheader" className="av2-rgrid__h">Contact</span>
              <span role="columnheader" className="av2-rgrid__h">Broker</span>
              <span role="columnheader" className="av2-rgrid__h">Areas</span>
              <span role="columnheader" className="av2-rgrid__h">Frequency</span>
              <span role="columnheader" className="av2-rgrid__h">Status</span>
              <span role="columnheader" className="av2-rgrid__h">Engagement</span>
              <span role="columnheader" className="av2-rgrid__h">Last sent</span>
              <span role="columnheader" className="av2-rgrid__h" aria-label="Row actions" />
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No market report subscriptions match these filters.</span>
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.personId}
                  role="row"
                  data-state={selected.has(row.personId) ? 'selected' : undefined}
                  className={
                    selected.has(row.personId)
                      ? 'av2-rgrid__row bg-[var(--a-accent-wash)] hover:bg-[var(--a-inset)]'
                      : 'av2-rgrid__row hover:bg-[var(--a-inset)]'
                  }
                >
                  <span role="cell" className="av2-rgrid__c">
                    <ToolbarCheck
                      label=""
                      checked={selected.has(row.personId)}
                      onChange={() => toggleOne(row.personId)}
                      aria-label={`Select ${contactLabel(row)}`}
                    />
                  </span>
                  <span role="cell" data-label="Contact" className="av2-rgrid__c">
                    {/* Spans, not <p>: the cell is a <span>, so a block element
                        here would be invalid nesting. */}
                    <Link
                      href={`/admin/people/${row.personId}`}
                      className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                      style={{ color: 'var(--a-text)' }}
                    >
                      {row.personName?.trim() || `Contact #${row.personId}`}
                    </Link>
                    <span className="block truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                      {row.personEmail ?? '—'}
                    </span>
                  </span>
                  <span role="cell" data-label="Broker" className="av2-rgrid__c text-sm" style={{ color: 'var(--a-text)' }}>
                    {row.assignedBroker ?? '—'}
                  </span>
                  <span role="cell" data-label="Areas" className="av2-rgrid__c">
                    <span className="block truncate text-sm" style={{ color: 'var(--a-text)' }}>
                      {row.areas.length > 0 ? row.areas.join(', ') : '—'}
                    </span>
                  </span>
                  <span role="cell" data-label="Frequency" className="av2-rgrid__c text-sm" style={{ color: 'var(--a-text)' }}>
                    {frequencyLabel(row.frequency)}
                  </span>
                  <span role="cell" data-label="Status" className="av2-rgrid__c">
                    <StatusBadge active={row.active} />
                  </span>
                  <span role="cell" data-label="Engagement" className="av2-rgrid__c">
                    <EngagementCell engagement={row.engagement} />
                  </span>
                  <span
                    role="cell"
                    data-label="Last sent"
                    className="av2-rgrid__c text-sm tabular-nums"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    {formatSubscriptionDate(row.lastSentAt)}
                  </span>
                  <span role="cell" className="av2-rgrid__c">
                    <Menu
                      label={`Actions for ${contactLabel(row)}`}
                      align="end"
                      trigger={<MoreHorizontal className="size-4" />}
                      items={[
                        { label: 'Edit areas & cadence', onSelect: () => setEditRow(row) },
                        { label: 'Preview email', onSelect: () => setPreviewRow(row) },
                        { label: 'Assign broker', onSelect: () => setAssignRow(row) },
                        {
                          label: row.active ? 'Pause' : 'Resume',
                          onSelect: () =>
                            runUpdate([row.personId], { active: !row.active }, row.active ? 'Paused' : 'Resumed'),
                        },
                        { label: 'Delete', danger: true, onSelect: () => setDeleteRow(row) },
                      ]}
                    />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <PaginationBar page={page} total={total} isPending={isPending} onPage={setPage} />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteRow !== null}
        onClose={() => setDeleteRow(null)}
        title="Delete this subscription"
        description={`${deleteRow ? contactLabel(deleteRow) : 'This contact'} stops getting market report emails and the subscription record is removed. The CRM contact is kept. This cannot be undone.`}
        confirmLabel="Delete"
        busy={isPending}
        onConfirm={runDelete}
      />

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
