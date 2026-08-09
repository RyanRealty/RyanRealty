'use client'

/**
 * AlertSubscriptionsTab — one tab of the Alerts & reports hub, parameterized
 * by alert kind. Both kinds are rows of the ONE canonical listing_alerts
 * table (unified 2026-07-07): 'user' rows carry a user_id (signed-in saved
 * searches), 'guest' rows do not. Search + status + frequency (+ origin for
 * guest) filters, a paginated table with a checkbox column, per-row
 * engagement (sends / opens / clicks / last open from email_events), a
 * per-row actions menu (edit criteria, rendered email preview, assign
 * broker, pause/resume, delete), and a selection toolbar for bulk pause /
 * resume / re-cadence / delete via app/actions/subscriptions-admin.ts.
 *
 * P11F: on the LOCKED admin v2 language. shadcn Input/Select/Checkbox/Table/
 * Dialog/DropdownMenu/Button are gone. The reader is the div/role grid that
 * reuses ReportGrid's classes + roles (av2-rgrid*, report-grid.css) — the same
 * shape ConfigTableEditor and BlockListManager use, rather than the
 * <ReportGrid> component itself, because this grid's header and cells are
 * interactive (select-all, per-row checkbox, actions menu) and that component
 * is documented stateless. The tracks are sized to fit instead of being wrapped
 * in .av2-rgrid__scroll — see the note on gridStyle, the row menu cannot live
 * inside a scroll container. Every filter, mutation and string is carried over
 * verbatim.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import type { CSSProperties } from 'react'
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
  OriginBadge,
  EngagementCell,
  PaginationBar,
  TableSkeleton,
} from '@/components/admin/crm/subscriptions/subscriptions-shared'
import AlertEditDialog from '@/components/admin/crm/subscriptions/AlertEditDialog'
import AlertEngineSettingsDialog from '@/components/admin/crm/subscriptions/AlertEngineSettingsDialog'
import AssignBrokerDialog from '@/components/admin/crm/subscriptions/AssignBrokerDialog'
import EmailPreviewDialog from '@/components/admin/crm/subscriptions/EmailPreviewDialog'

type StatusFilter = 'active' | 'paused' | 'all'
type FrequencyFilter = 'instant' | 'daily' | 'weekly' | 'all'
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
  // Typed-event engine settings (preview mode + events + weekly days).
  const [settingsRow, setSettingsRow] = useState<AdminAlertSubscriptionRow | null>(null)
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
    patch: { active?: boolean, frequency?: 'instant' | 'daily' | 'weekly' },
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

  // Desktop column template — the custom property report-grid.css reads at
  // >=720px. Below that the same markup stacks into one block per row.
  //
  // NO --rgrid-min and NO .av2-rgrid__scroll wrapper, deliberately. The row
  // actions are a v2 <Menu>, whose panel is position:absolute inside the row —
  // it is NOT portaled the way the shadcn DropdownMenu it replaces was. Any
  // scroll container (.av2-rgrid__scroll is overflow-x:auto + overflow-y:hidden)
  // clips its descendants, so a menu on any of the last few rows — i.e. EVERY
  // row on a short list — would open into a clipped box and be unreachable.
  // The tracks are therefore sized to fit the narrowest container the grid ever
  // renders in (720px viewport − the shell's px-6 − the page's 16px = 640px;
  // minimums total 540 + 8×12px gaps = 636), so nothing overflows sideways and
  // the fr units let every column breathe on a real desktop. The actions track
  // is 44px because .av2-iconbtn is --a-touch wide on a coarse pointer.
  const gridStyle = {
    '--rgrid-cols':
      '20px minmax(68px,1.4fr) minmax(74px,1.7fr) 62px 58px 62px minmax(84px,1.2fr) 68px 44px',
  } as CSSProperties

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div data-tour="subs-filters" className="flex flex-wrap items-center gap-2">
        <SearchField
          value={qInput}
          onChange={(e) => {
            setQInput(e.target.value)
            resetToFirstPage()
          }}
          placeholder={kind === 'guest' ? 'Search by email or name' : 'Search by name'}
          className="w-full sm:w-64"
          // Releases .av2-input--bar's 200px cap so the width classes decide.
          style={{ maxWidth: '100%' }}
          aria-label={`Search ${nounPlural}`}
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
          className="w-36"
          aria-label="Frequency filter"
          value={frequency}
          onChange={(e) => {
            setFrequency(e.target.value as FrequencyFilter)
            resetToFirstPage()
          }}
        >
          <option value="all">All frequencies</option>
          <option value="instant">Instant</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </ToolbarSelect>
        {kind === 'guest' ? (
          <ToolbarSelect
            className="w-36"
            aria-label="Origin filter"
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value as OriginFilter)
              resetToFirstPage()
            }}
          >
            <option value="all">All origins</option>
            <option value="user">User</option>
            <option value="broker">Broker</option>
            <option value="system">System</option>
          </ToolbarSelect>
        ) : null}
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
          <Button variant="quiet" disabled={isPending} onClick={() => runUpdate(ids, { active: false }, 'Paused')}>
            Pause
          </Button>
          <Button variant="quiet" disabled={isPending} onClick={() => runUpdate(ids, { active: true }, 'Resumed')}>
            Resume
          </Button>
          <ToolbarSelect
            className="w-36"
            aria-label="Set frequency"
            value=""
            disabled={isPending}
            onChange={(e) => {
              if (!e.target.value) return
              runUpdate(ids, { frequency: e.target.value as 'instant' | 'daily' | 'weekly' }, 'Updated frequency for')
            }}
          >
            <option value="" disabled>Set frequency</option>
            <option value="instant">Instant</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </ToolbarSelect>
          <Button variant="danger" disabled={isPending} onClick={() => setDeleteTarget('selection')}>
            Delete
          </Button>
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
        <div data-tour="subs-table">
          {/* Select-all, phone only. report-grid.css hides .av2-rgrid__head
              below 720px (the row becomes one stacked block), which would take
              the header's select-all with it — and it is reachable on a phone
              today, first column of the scrolling table. Exactly one of the two
              is in the accessibility tree at any width; the other is display:none. */}
          <div className="hidden items-center gap-2 pb-2 max-[719.98px]:flex">
            <ToolbarCheck
              label="Select all"
              checked={allOnPageSelected}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          <div className="av2-rgrid" role="table" aria-label={nounPlural} style={gridStyle}>
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
              <span role="columnheader" className="av2-rgrid__h">Search</span>
              <span role="columnheader" className="av2-rgrid__h">Origin</span>
              <span role="columnheader" className="av2-rgrid__h">Frequency</span>
              <span role="columnheader" className="av2-rgrid__h">Status</span>
              <span role="columnheader" className="av2-rgrid__h">Engagement</span>
              <span role="columnheader" className="av2-rgrid__h">Last notified</span>
              <span role="columnheader" className="av2-rgrid__h" aria-label="Row actions" />
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No {nounPlural} match these filters.</span>
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  role="row"
                  data-state={selected.has(row.id) ? 'selected' : undefined}
                  className={
                    selected.has(row.id)
                      ? 'av2-rgrid__row bg-[var(--a-accent-wash)] hover:bg-[var(--a-inset)]'
                      : 'av2-rgrid__row hover:bg-[var(--a-inset)]'
                  }
                >
                  <span role="cell" className="av2-rgrid__c">
                    <ToolbarCheck
                      label=""
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.email ?? row.name ?? noun}`}
                    />
                  </span>
                  <span role="cell" data-label="Contact" className="av2-rgrid__c">
                    {/* Spans, not <p>: the cell is a <span>, so a block element
                        here would be invalid nesting. */}
                    <span className="block truncate text-sm" style={{ color: 'var(--a-text)' }}>{row.email ?? '—'}</span>
                    {row.crmPersonId ? (
                      <Link
                        href={`/admin/people/${row.crmPersonId}`}
                        className="text-xs underline-offset-2 hover:underline"
                        style={{ color: 'var(--a-accent)' }}
                      >
                        Open contact
                      </Link>
                    ) : null}
                  </span>
                  <span role="cell" data-label="Search" className="av2-rgrid__c">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>
                      {row.name?.trim() || 'Saved search'}
                    </span>
                    <span className="block truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                      {getFiltersSummary(row.filters ?? {})}
                    </span>
                  </span>
                  <span role="cell" data-label="Origin" className="av2-rgrid__c">
                    <OriginBadge origin={row.origin} />
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
                    data-label="Last notified"
                    className="av2-rgrid__c text-sm tabular-nums"
                    style={{ color: 'var(--a-text-2)' }}
                  >
                    {formatSubscriptionDate(row.lastNotifiedAt)}
                  </span>
                  <span role="cell" className="av2-rgrid__c">
                    <Menu
                      label={`Actions for ${row.email ?? row.name ?? noun}`}
                      align="end"
                      trigger={<MoreHorizontal className="size-4" />}
                      items={[
                        { label: 'Edit', onSelect: () => setEditRow(row) },
                        { label: 'Alert settings', onSelect: () => setSettingsRow(row) },
                        { label: 'Preview email', onSelect: () => setPreviewRow(row) },
                        {
                          label: 'Assign broker',
                          disabled: !row.crmPersonId,
                          onSelect: () => setAssignRow(row),
                        },
                        {
                          label: row.active ? 'Pause' : 'Resume',
                          onSelect: () =>
                            runUpdate([row.id], { active: !row.active }, row.active ? 'Paused' : 'Resumed'),
                        },
                        { label: 'Delete', danger: true, onSelect: () => setDeleteTarget(row) },
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

      {/* Delete confirm (selection or a single row) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteCount.toLocaleString('en-US')} ${deleteCount === 1 ? noun : nounPlural}`}
        description={`The selected ${deleteCount === 1 ? `${noun} stops` : `${nounPlural} stop`} sending and the ${deleteCount === 1 ? 'record is' : 'records are'} removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={isPending}
        onConfirm={runDelete}
      />

      {editRow ? (
        <AlertEditDialog row={editRow} onClose={() => setEditRow(null)} onSaved={reload} />
      ) : null}

      {settingsRow ? (
        <AlertEngineSettingsDialog
          alertId={settingsRow.id}
          onClose={() => setSettingsRow(null)}
          onSaved={reload}
        />
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
