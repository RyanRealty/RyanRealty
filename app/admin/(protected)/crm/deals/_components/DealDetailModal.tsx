'use client'

/**
 * DealDetailModal — the §11 deal detail as a CENTERED MODAL over the Kanban
 * (not a page navigation). Mounted by the deals page when ?deal=<id> is set;
 * the board stays rendered (dimmed behind the scrim); dismiss = X or scrim
 * click, which strips the param (no data changed by dismissing — AC-5 #26).
 *
 * Header: deal name · "Created <Month D, YYYY> at <h:mm am>" · pipeline > ●
 * stage breadcrumb (dot = the stage's accent color) · Archive/Restore.
 *
 * Body, two columns (§11 field inventory):
 *   LEFT:  PRICE · EARNEST MONEY DUE · DUE DILIGENCE · POSSESSION · COMMISSION ·
 *          PEOPLE (junction contacts + search-to-link) · PROPERTY ADDRESS ·
 *          DESCRIPTION · CUSTOM FIELDS ("Show all fields") · FILES
 *   RIGHT: CLOSE DATE · MUTUAL ACCEPTANCE · FINAL WALK THROUGH ·
 *          SPLITS (+ Add team split) · TEAM (assigned broker)
 *
 * Empty fields render as accent-colored "Add <field>" links (never grayed
 * inputs); populated values render as accent links; both click-to-edit inline
 * (AC-5 #20).
 *
 * §13 archiving: Archive / Restore action in the header row (archive, not
 * delete, is how a lost deal leaves the board).
 *
 * 11F: migrated to the admin v2 language. Split across this file +
 * deal-detail-bits.tsx to clear the 600-LOC file-size budget (was 711 lines
 * as one file) — see that file's header for what moved and why. The header's
 * click-to-edit NAME is now a "Rename" trigger next to the v2 Dialog's native
 * title (that primitive's `title` is a plain string, not a clickable node) —
 * see EditableTitle's doc comment in deal-detail-bits.tsx.
 */

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button, Dialog } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import type { CrmDealDetail } from '@/lib/data/crm/getCrmDeal'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import { setDealStatus } from '@/app/actions/crm-deals'
import { dealMoney } from './DealsBoard'
import {
  EditableField,
  EditableTitle,
  FieldLabel,
  FilesSection,
  PeopleSection,
  SplitsSection,
  TeamSection,
  fmtModalDate,
} from './deal-detail-bits'

export function DealDetailModal({
  deal,
  pipelines,
  brokers,
  isOwner,
}: {
  deal: CrmDealDetail
  pipelines: BoardPipeline[]
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showAllFields, setShowAllFields] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const stage = pipelines
    .find((p) => p.name === deal.pipeline)
    ?.stages.find((s) => s.name === deal.stage)

  function close() {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('deal')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const refresh = () => router.refresh()

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Failed')
      else refresh()
    })
  }

  // §11 header: "Created Aug 27, 2025 at 7:39 am" (brand-timezone helper).
  const createdLine = deal.created_at
    ? `Created ${formatDate(deal.created_at)} at ${formatDate(deal.created_at, { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
    : null

  const isArchived = (deal.status ?? '').trim().toLowerCase() === 'archived'
  const broker = deal.assigned_broker

  return (
    <Dialog open onClose={close} title={deal.name ?? `Deal #${deal.id}`} size="work">
      {/* Header (§11) */}
      <div className="flex flex-wrap items-center gap-2">
        {createdLine ? <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{createdLine}</p> : null}
        <EditableTitle deal={deal} onSaved={refresh} />
      </div>
      <p className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        <span>{deal.pipeline ?? 'No pipeline'}</span>
        <span aria-hidden>›</span>
        {stage ? (
          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--a-text)' }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
            {stage.name}
          </span>
        ) : (
          <span className="font-medium" style={{ color: 'var(--a-text)' }}>{deal.stage ?? 'No stage'}</span>
        )}
        {isArchived ? (
          <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--a-inset)', color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>
            Archived
          </span>
        ) : null}
      </p>
      <div>
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => run(() => setDealStatus(deal.id, isArchived ? 'active' : 'archived'))}
        >
          {isArchived ? 'Restore deal' : 'Archive deal'}
        </Button>
      </div>

      <div style={{ borderTop: '1px solid var(--a-border)' }} />

      {error ? (
        <p className="rounded-md px-3 py-2" style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)', fontSize: 'var(--a-text-xs)' }}>
          {error}
        </p>
      ) : null}

      {/*
        Body (§11 field inventory, order preserved — LEFT group then RIGHT
        group), two columns as it always was. The migration briefly stacked this
        to one because the v2 Dialog was hard-fixed at the 460px confirm width;
        Dialog now takes size="work" (720px) for detail surfaces, so the original
        layout stands rather than the primitive reshaping the screen.
      */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {/* LEFT column */}
        <div className="space-y-4">
          <EditableField
            dealId={deal.id}
            label="Price"
            addLabel="Add price"
            column="value"
            kind="currency"
            value={deal.value}
            display={dealMoney(deal.value)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Earnest money due"
            addLabel="Add earnest money due date"
            column="earnest_money_due"
            kind="date"
            value={deal.earnest_money_due}
            display={fmtModalDate(deal.earnest_money_due)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Due diligence"
            addLabel="Add due diligence date"
            column="due_diligence"
            kind="date"
            value={deal.due_diligence}
            display={fmtModalDate(deal.due_diligence)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Possession"
            addLabel="Add possession date"
            column="possession"
            kind="date"
            value={deal.possession}
            display={fmtModalDate(deal.possession)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Commission"
            addLabel="Add commission"
            column="commission_dollars"
            kind="currency"
            value={deal.commission_dollars}
            display={dealMoney(deal.commission_dollars)}
            onSaved={refresh}
          />

          <PeopleSection dealId={deal.id} people={deal.people} pending={pending} run={run} />

          <EditableField
            dealId={deal.id}
            label="Property address"
            addLabel="Add property address"
            column="property_address"
            kind="text"
            value={deal.property_address}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Description"
            addLabel="Add description"
            column="description"
            kind="textarea"
            value={deal.description}
            onSaved={refresh}
          />

          {/* CUSTOM FIELDS (§14) — collapsed behind "Show all fields" */}
          <div className="space-y-1">
            <FieldLabel>Custom fields</FieldLabel>
            <Button
              variant="quiet"
              onClick={() => setShowAllFields((v) => !v)}
              className="av2-textlink"
              style={{ fontSize: 'var(--a-text-sm)' }}
            >
              {showAllFields ? 'Hide fields' : 'Show all fields'}
            </Button>
            {showAllFields ? (
              <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>No custom deal fields defined.</p>
            ) : null}
          </div>

          <FilesSection dealId={deal.id} files={deal.files} pending={pending} run={run} />
        </div>

        {/* RIGHT column */}
        <div className="space-y-4">
          <EditableField
            dealId={deal.id}
            label="Close date"
            addLabel="Add close date"
            column="close_date"
            kind="date"
            value={deal.close_date}
            display={fmtModalDate(deal.close_date)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Mutual acceptance"
            addLabel="Add mutual acceptance date"
            column="mutual_acceptance"
            kind="date"
            value={deal.mutual_acceptance}
            display={fmtModalDate(deal.mutual_acceptance)}
            onSaved={refresh}
          />
          <EditableField
            dealId={deal.id}
            label="Final walk through"
            addLabel="Add final walk through date"
            column="final_walkthrough"
            kind="date"
            value={deal.final_walkthrough}
            display={fmtModalDate(deal.final_walkthrough)}
            onSaved={refresh}
          />

          <SplitsSection dealId={deal.id} splits={deal.splits} brokers={brokers} pending={pending} run={run} />

          <TeamSection dealId={deal.id} broker={broker} brokers={brokers} isOwner={isOwner} run={run} />
        </div>
      </div>
    </Dialog>
  )
}
