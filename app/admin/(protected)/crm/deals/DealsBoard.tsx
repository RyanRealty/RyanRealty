'use client'

/**
 * DealsBoard — the FUB-parity Deals Kanban (spec §10, delivery #3).
 *
 * - Per-pipeline stage columns: a Buyers/Sellers switcher (§4) renders the exact
 *   ordered stage columns for the selected pipeline from lib/crm/deal-pipelines
 *   (mirrors docs/fub-crm-spec/api-export/pipelines.json). Columns are the config's
 *   stages — NOT whatever strings happen to be in the data — so an empty stage
 *   still shows its column. Any deal whose stage isn't in the config surfaces in an
 *   appended "unsorted" column so nothing is silently dropped.
 * - Drag-to-restage (§15): dnd-kit. Dropping a card on another stage column calls
 *   the restageCrmDeal server action (updates crm_deals.stage + entered_stage_at,
 *   logs a crm_timeline audit row). Optimistic move with revert-on-failure. Broker
 *   scope is enforced in the action (the board only shows a restricted broker their
 *   own deals, so every visible card is theirs to move).
 * - Deal cards (§8): address/name, sale price (success), commission icon +
 *   commission $, projected/close date (ordinal), contact initials + agent photo.
 *
 * Desktop = the draggable kanban; mobile = a read-only stacked-by-stage list
 * (tap a card to open its detail) so the surface stays usable on a phone.
 *
 * Stage accent hex comes from stage.color (a variable, never a literal here) so
 * this file carries no hardcoded colors — the palette lives in deal-pipelines.ts.
 */

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Home, Banknote, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { crmAvatarColor, crmInitials } from '@/components/admin/crm/mobile/avatar-utils'
import {
  DEAL_PIPELINES,
  getDealPipeline,
  type DealPipeline,
  type DealStage,
} from '@/lib/crm/deal-pipelines'
import { restageCrmDeal, createCrmDeal } from '@/app/actions/crm-deals'
import type { CrmDealRow } from '@/app/actions/crm'

// ── formatting helpers (called here, never passed across the RSC boundary) ──────

function money(v: number | null | undefined): string {
  if (!v) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

/** Compact dollar sum for a column header: $2.4M / $655K / $0. */
function moneySum(v: number): string {
  if (v === 0) return '$0'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K'
  return '$' + v.toLocaleString('en-US')
}

const ORDINAL = (d: number): string => {
  if (d % 100 >= 11 && d % 100 <= 13) return `${d}th`
  switch (d % 10) {
    case 1: return `${d}st`
    case 2: return `${d}nd`
    case 3: return `${d}rd`
    default: return `${d}th`
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "July 30th 2025" — ordinal day, no comma (spec §8 Row 3). Date-only string, parsed as local. */
function formatOrdinalDate(iso: string | null): string | null {
  if (!iso) return null
  // crm_deals.close_date is a DATE ('YYYY-MM-DD'); parse the parts to avoid a UTC shift.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return `${MONTHS[dt.getMonth()]} ${ORDINAL(dt.getDate())} ${dt.getFullYear()}`
}

const BROKER_PHOTO: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}
const BROKER_LABEL: Record<string, string> = {
  matt: 'Matt Ryan',
  rebecca: 'Rebecca Peterson',
  paul: 'Paul Stevenson',
}

const UNSORTED = '__unsorted__'

// ── card body (shared by the column card, the drag overlay, and mobile rows) ────

function DealCardBody({ deal, pipeline }: { deal: CrmDealRow; pipeline: DealPipeline; }) {
  const personName = deal.person?.name ?? null
  const label = deal.name ?? deal.property_address ?? personName ?? `Deal #${deal.id}`
  const isSellers = pipeline.name === 'Sellers'
  const CommissionIcon = isSellers ? Home : Banknote

  // Date row: "Close Date:" on a closed-stage deal, else "Projected Close Date:".
  const stageCfg = pipeline.stages.find((s) => s.name === deal.stage)
  const dateLabel = stageCfg?.closedStage ? 'Close Date' : 'Projected Close Date'
  const dateStr = formatOrdinalDate(deal.close_date)

  const broker = deal.assigned_broker ?? null
  const brokerPhoto = broker ? BROKER_PHOTO[broker] : undefined
  const brokerLabel = broker ? (BROKER_LABEL[broker] ?? broker) : null

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      {/* Row 1 — address / deal name */}
      <p className="truncate text-sm font-medium text-foreground">{label}</p>

      {/* Row 2 — sale price + commission icon + commission $ */}
      {(deal.value || deal.commission_dollars) ? (
        <div className="mt-1 flex items-center gap-1.5 text-sm">
          {deal.value ? (
            <span className="font-semibold tabular-nums text-success">{money(deal.value)}</span>
          ) : null}
          {deal.commission_dollars ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CommissionIcon className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">{money(deal.commission_dollars)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Row 3 — projected / close date (hidden when no date) */}
      {dateStr ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {dateLabel}: <span className="tabular-nums">{dateStr}</span>
        </p>
      ) : null}

      {/* Row 4 — avatar cluster: contact initials (left) + agent photo (right) */}
      {(personName || brokerPhoto) ? (
        <div className="mt-2 flex items-center gap-1.5">
          {personName ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: crmAvatarColor(personName), color: 'rgb(255 255 255)' }}
              title={personName}
            >
              {crmInitials(personName)}
            </span>
          ) : null}
          {brokerPhoto ? (
            <Avatar className="h-6 w-6" title={brokerLabel ?? undefined}>
              <AvatarImage src={brokerPhoto} alt={brokerLabel ?? 'Agent'} />
              <AvatarFallback className="text-xs">
                {brokerLabel ? crmInitials(brokerLabel) : 'RR'}
              </AvatarFallback>
            </Avatar>
          ) : null}
          {personName ? (
            <span className="truncate text-xs text-muted-foreground">{personName}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── draggable card (desktop) ────────────────────────────────────────────────────

function DraggableDealCard({
  deal,
  pipeline,
  onOpen,
}: {
  deal: CrmDealRow
  pipeline: DealPipeline
  onOpen: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  })
  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    // Hide the origin card while its overlay clone floats; keep it in flow.
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Open deal ${deal.name ?? deal.id}`}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(deal.id)
        }
      }}
      className={cn(
        'cursor-grab touch-none rounded-lg transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isDragging && 'cursor-grabbing',
      )}
    >
      <DealCardBody deal={deal} pipeline={pipeline} />
    </div>
  )
}

// ── mobile card row (tap to open; no drag) ──────────────────────────────────────

function MobileDealRow({
  deal,
  pipeline,
  onOpen,
}: {
  deal: CrmDealRow
  pipeline: DealPipeline
  onOpen: (id: number) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open deal ${deal.name ?? deal.id}`}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(deal.id)
        }
      }}
      className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <DealCardBody deal={deal} pipeline={pipeline} />
    </div>
  )
}

// ── droppable stage column (desktop) ────────────────────────────────────────────

function StageColumn({
  stage,
  pipeline,
  deals,
  droppable,
  onOpen,
  onAdd,
}: {
  stage: DealStage
  pipeline: DealPipeline
  deals: CrmDealRow[]
  droppable: boolean
  onOpen: (id: number) => void
  onAdd?: (stage: DealStage) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.name, disabled: !droppable })
  const total = deals.reduce((s, d) => s + (d.value ?? 0), 0)

  return (
    <Card
      ref={droppable ? setNodeRef : undefined}
      className={cn(
        'flex w-72 shrink-0 flex-col self-start transition-colors',
        isOver && 'ring-2 ring-primary/50',
      )}
      style={{ borderTopWidth: 3, borderTopColor: stage.color }}
    >
      {/* Column header (§7) */}
      <div className="flex items-start justify-between gap-2 px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{stage.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{deals.length}</span> {deals.length === 1 ? 'deal' : 'deals'}
            {total > 0 ? <> · <span className="tabular-nums text-success">{moneySum(total)}</span></> : null}
            {stage.closedStage ? <span className="ml-1 font-medium text-success">Closed</span> : null}
          </p>
        </div>
        {onAdd ? (
          <Button
            type="button"
            size="icon-xs"
            onClick={() => onAdd(stage)}
            aria-label={`Add a deal to ${stage.name}`}
            className="shrink-0 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="mx-3 border-t border-border" />

      {/* Card stack */}
      <div className="flex min-h-16 flex-col gap-2 p-2">
        {deals.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            No deals,{' '}
            {onAdd ? (
              <Button
                type="button"
                variant="link"
                onClick={() => onAdd(stage)}
                className="h-auto p-0 align-baseline text-xs font-medium"
              >
                add deal
              </Button>
            ) : null}
          </p>
        ) : (
          deals.map((d) => (
            <DraggableDealCard key={d.id} deal={d} pipeline={pipeline} onOpen={onOpen} />
          ))
        )}
      </div>
    </Card>
  )
}

// ── main board ──────────────────────────────────────────────────────────────────

export function DealsBoard({ deals }: { deals: CrmDealRow[] }) {
  const router = useRouter()
  const [activePipeline, setActivePipeline] = useState<string>(DEAL_PIPELINES[0].name)
  // Optimistic stage overrides applied on top of props: dealId → new stage.
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addTo, setAddTo] = useState<{ pipeline: string; stage: string } | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const pipeline = getDealPipeline(activePipeline) ?? DEAL_PIPELINES[0]

  const stageOf = useCallback(
    (d: CrmDealRow) => overrides[d.id] ?? d.stage ?? UNSORTED,
    [overrides],
  )

  const openDeal = useCallback(
    (id: number) => router.push(`/admin/crm/deals/${id}`),
    [router],
  )

  // Deals in the active pipeline, grouped by (effective) stage. Config stages are
  // always present (even when empty); unknown stages collect into orphan buckets.
  const { columns, orphanColumns } = useMemo(() => {
    const inPipe = deals.filter((d) => (d.pipeline ?? '') === pipeline.name)
    const byStage = new Map<string, CrmDealRow[]>()
    for (const s of pipeline.stages) byStage.set(s.name, [])
    const orphans = new Map<string, CrmDealRow[]>()
    for (const d of inPipe) {
      const st = stageOf(d)
      if (byStage.has(st)) byStage.get(st)!.push(d)
      else {
        if (!orphans.has(st)) orphans.set(st, [])
        orphans.get(st)!.push(d)
      }
    }
    return {
      columns: pipeline.stages.map((s) => ({ stage: s, deals: byStage.get(s.name) ?? [] })),
      orphanColumns: [...orphans.entries()].map(([name, ds]) => ({ name, deals: ds })),
    }
  }, [deals, pipeline, stageOf])

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(Number(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return
    const dealId = Number(e.active.id)
    const deal = deals.find((d) => d.id === dealId)
    if (!deal) return
    const current = overrides[dealId] ?? deal.stage ?? null
    if (current === overId) return

    // Optimistic move; revert on failure.
    setError(null)
    setOverrides((o) => ({ ...o, [dealId]: overId }))
    startTransition(async () => {
      const res = await restageCrmDeal(dealId, overId)
      if (!res.ok) {
        setOverrides((o) => {
          const next = { ...o }
          delete next[dealId]
          return next
        })
        setError(res.error)
      } else {
        // Refresh server data so column totals + persistence reflect the move; the
        // optimistic override equals the new server value, so no flicker.
        router.refresh()
      }
    })
  }

  const activeDragDeal = activeDragId != null ? deals.find((d) => d.id === activeDragId) ?? null : null

  return (
    <div>
      {/* Pipeline switcher (§4.1) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs value={activePipeline} onValueChange={setActivePipeline}>
          <TabsList>
            {DEAL_PIPELINES.map((p) => (
              <TabsTrigger key={p.id} value={p.name}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Could not move the deal: {error}
        </p>
      ) : null}

      {/* Desktop — draggable kanban */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="flex items-start gap-3" style={{ width: 'max-content' }}>
              {columns.map(({ stage, deals: colDeals }) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  pipeline={pipeline}
                  deals={colDeals}
                  droppable
                  onOpen={openDeal}
                  onAdd={(s) => setAddTo({ pipeline: pipeline.name, stage: s.name })}
                />
              ))}
              {/* Orphan (unknown-stage) columns — display only, not drop targets */}
              {orphanColumns.map(({ name, deals: colDeals }) => (
                <StageColumn
                  key={name}
                  stage={{ id: -1, name: name === UNSORTED ? 'Unsorted' : name, color: 'var(--border)', closedStage: false }}
                  pipeline={pipeline}
                  deals={colDeals}
                  droppable={false}
                  onOpen={openDeal}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragDeal ? (
              <div className="w-72 cursor-grabbing opacity-95 shadow-lg">
                <DealCardBody deal={activeDragDeal} pipeline={pipeline} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile — read-only stacked-by-stage list (tap to open) */}
      <div className="space-y-5 md:hidden">
        {columns.map(({ stage, deals: colDeals }) => {
          const total = colDeals.reduce((s, d) => s + (d.value ?? 0), 0)
          return (
            <section key={stage.id}>
              <div
                className="flex items-center justify-between rounded-t-lg px-3 py-2"
                style={{ borderTop: `3px solid ${stage.color}`, backgroundColor: 'var(--muted)' }}
              >
                <span className="text-sm font-semibold text-foreground">{stage.name}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="tabular-nums">{colDeals.length}</span>
                  {total > 0 ? <> · <span className="tabular-nums text-success">{moneySum(total)}</span></> : null}
                  {stage.closedStage ? <span className="ml-1 font-medium text-success">Closed</span> : null}
                </span>
              </div>
              <div className="space-y-2 rounded-b-lg border border-t-0 border-border bg-card p-2">
                {colDeals.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">No deals</p>
                ) : (
                  colDeals.map((d) => (
                    <MobileDealRow key={d.id} deal={d} pipeline={pipeline} onOpen={openDeal} />
                  ))
                )}
              </div>
            </section>
          )
        })}
        {orphanColumns.map(({ name, deals: colDeals }) => (
          <section key={name}>
            <div className="rounded-t-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
              <span className="text-sm font-semibold text-foreground">
                {name === UNSORTED ? 'Unsorted' : name}
              </span>
            </div>
            <div className="space-y-2 rounded-b-lg border border-t-0 border-border bg-card p-2">
              {colDeals.map((d) => (
                <MobileDealRow key={d.id} deal={d} pipeline={pipeline} onOpen={openDeal} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Per-column "add deal" dialog (§7 empty state + header "+") */}
      <AddDealDialog
        target={addTo}
        onClose={() => setAddTo(null)}
        onCreated={(id) => {
          setAddTo(null)
          router.push(`/admin/crm/deals/${id}`)
        }}
      />
    </div>
  )
}

// ── stage-scoped add-deal dialog ────────────────────────────────────────────────

function AddDealDialog({
  target,
  onClose,
  onCreated,
}: {
  target: { pipeline: string; stage: string } | null
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const trimmed = name.trim()
    if (!trimmed || !target) {
      setError('Deal name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCrmDeal({ name: trimmed, pipeline: target.pipeline, stage: target.stage })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setName('')
      onCreated(res.id)
    })
  }

  return (
    <Dialog
      open={target != null}
      onOpenChange={(o) => {
        if (!o) {
          setName('')
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            New deal{target ? ` · ${target.stage}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-deal-name">Deal name</Label>
            <Input
              id="add-deal-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="e.g. Smith — 123 Main St"
            />
          </div>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
