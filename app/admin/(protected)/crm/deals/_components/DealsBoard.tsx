'use client'

/**
 * DealsBoard — the §10 FUB-parity Deals Kanban (deals-desktop rebuild).
 *
 * - Columns come from the DB-backed pipeline config (crm_deal_stages via
 *   getDealPipelines) — an empty stage still renders its column; a deal whose
 *   stage isn't in the config surfaces in an appended "Unsorted" column so
 *   nothing is silently dropped.
 * - §7 column anatomy: stage-color accent bar, bold stage name, "N deals" +
 *   full-dollar green total + "Closed" badge on is_closed_stage columns, a
 *   round + button, and the "No deals, add deal" empty state.
 * - §8 card anatomy: address (bold) · green price + commission icon + gray
 *   stored commission (Buyers = bills icon, Sellers = house icon) ·
 *   "Close Date:" / "Projected Close Date:" ordinal date row · avatar cluster
 *   (ALL linked contacts' deterministic initials circles, agent photo LAST).
 * - §15 drag-to-restage: dnd-kit; optimistic move, revert-on-failure; the
 *   restageCrmDeal action stamps entered_stage_at + actual_close_date and
 *   writes the deal_stage_change audit row.
 * - Card click opens the §11 deal detail MODAL via the ?deal= URL param (the
 *   page loads the detail server-side and mounts DealDetailModal over the board).
 * - Owner-only §10 stage management: "Add a stage" link past the last column +
 *   a hover pencil on each column header (rename / recolor / closed flag /
 *   reorder / delete).
 *
 * Stage accent hex comes from stage.color (data, never a literal here); the
 * palette + config live in lib/crm/deal-pipelines.ts / the crm_deal_stages table.
 * Desktop = draggable kanban; mobile (< md) = stacked read-only list.
 *
 * 11F: migrated to the admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. shadcn Card/Avatar/Button are replaced by hand-styled
 * elements on admin tokens; contact-initials circles drop the old per-person
 * hue palette for the neutral token fill thread-bits.tsx's ThreadAvatar
 * established (admin v2 reserves color for action/status, ADMIN_UI §1 — the
 * old FUB-style per-contact hue is out of canon here). The draggable card
 * wrapper and the mobile row wrapper stay a <div role="button"> (not a real
 * <button> / v2 Button): dnd-kit's useDraggable binds its listeners + ref to
 * that exact node, and a real button risks the drag handle and nested-
 * interactive-element semantics — left raw per this migration's own hard
 * rule. Their hover/focus treatment moves to the shared .av2-dealcard rule in
 * admin-v2.css since a CSS pseudo-class can't live in an inline style.
 */

import { useCallback, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
import { Home, Banknote, Pencil, Plus } from 'lucide-react'
import { Button, IconButton } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { crmInitials } from '@/lib/admin/crm-avatar'
import type { BoardPipeline, BoardStage } from '@/lib/data/crm/getDealPipelines'
import type { DealBoardRow } from '@/lib/data/crm/listDealsBoard'
import { restageCrmDeal } from '@/app/actions/crm-deals'
import { AddDealDialog } from './DealsDialogs'
import { AddStageDialog } from './AddStageDialog'
import { StageEditDialog } from './StageEditDialog'

// ── formatting helpers ───────────────────────────────────────────────────────

/** Full locale dollars — "$4,515,000" (§7 header + §8 price; no abbreviation). */
export function dealMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
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

/** "July 30th 2025" — ordinal day, no comma (spec §8 Row 3). Date-only, local. */
export function formatOrdinalDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return `${MONTHS[dt.getMonth()]} ${ORDINAL(dt.getDate())} ${dt.getFullYear()}`
}

export const BROKER_PHOTO: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}
export const BROKER_LABEL: Record<string, string> = {
  matt: 'Matt Ryan',
  rebecca: 'Rebecca Peterson',
  paul: 'Paul Stevenson',
}

const UNSORTED = '__unsorted__'

// ── avatars (shared: card cluster here, DealDetailModal's Team section) ─────
// Hand-rolled — @/components/ui/avatar is banned. A plain <img>, same as the
// Radix AvatarImage it replaces (no lazy-loading behavior change).

/** Deterministic-initials circle for a linked contact. Neutral token fill —
 *  see the file header note on dropping per-contact hue. */
export function ContactAvatar({ name, id, size = 24 }: { name: string | null; id: number; size?: number }) {
  return (
    <span
      key={id}
      title={name ?? `Contact #${id}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: 'var(--a-inset)', color: 'var(--a-text)' }}
    >
      {crmInitials(name ?? '?')}
    </span>
  )
}

/** Broker photo circle, initials fallback when there is no photo. */
export function BrokerAvatar({ src, label, size = 24 }: { src?: string; label: string; size?: number }) {
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{ width: size, height: size, background: 'var(--a-inset)', color: 'var(--a-text)', fontSize: Math.round(size * 0.42) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        crmInitials(label)
      )}
    </span>
  )
}

// ── card body (§8 — shared by column card, drag overlay, and mobile rows) ─────

export function DealCardBody({ deal, pipeline, stage }: {
  deal: DealBoardRow
  pipeline: BoardPipeline
  stage: BoardStage | null
}) {
  const label = deal.name ?? deal.property_address ?? deal.people[0]?.name ?? `Deal #${deal.id}`
  const CommissionIcon = pipeline.name === 'Sellers' ? Home : Banknote

  // §8 Row 3: "Close Date:" on closed-stage deals, else "Projected Close Date:".
  const dateLabel = stage?.isClosedStage ? 'Close Date' : 'Projected Close Date'
  const dateStr = formatOrdinalDate(
    stage?.isClosedStage ? (deal.actual_close_date ?? deal.close_date) : deal.close_date,
  )

  const broker = deal.assigned_broker ?? null
  const brokerPhoto = broker ? BROKER_PHOTO[broker] : undefined
  const brokerLabel = broker ? (BROKER_LABEL[broker] ?? broker) : null

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)' }}>
      {/* Row 1 — address / deal name */}
      <p className="truncate font-semibold" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
        {label}
      </p>

      {/* Row 2 — sale price (green bold) + commission icon + stored commission (gray) */}
      {(deal.value != null || deal.commission_dollars != null) ? (
        <div className="mt-1 flex items-center gap-2" style={{ fontSize: 'var(--a-text-sm)' }}>
          {deal.value != null ? (
            <span className="a-num font-bold" style={{ color: 'var(--a-ok)' }}>{dealMoney(deal.value)}</span>
          ) : null}
          {deal.commission_dollars != null ? (
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              <CommissionIcon className="h-3.5 w-3.5" aria-hidden />
              <span className="a-num">{dealMoney(deal.commission_dollars)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Row 3 — date row (hidden when no date) */}
      {dateStr ? (
        <p className="mt-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {dateLabel}: <span className="a-num">{dateStr}</span>
        </p>
      ) : null}

      {/* Row 4 — avatar cluster: contact initials first, agent photo LAST (§8) */}
      {(deal.people.length > 0 || brokerPhoto) ? (
        <div className="mt-2 flex items-center gap-1">
          {deal.people.map((p) => (
            <ContactAvatar key={p.id} id={p.id} name={p.name} />
          ))}
          {brokerPhoto ? <BrokerAvatar src={brokerPhoto} label={brokerLabel ?? 'Agent'} /> : null}
        </div>
      ) : null}
    </div>
  )
}

// ── draggable card (desktop) ─────────────────────────────────────────────────

function DraggableDealCard({ deal, pipeline, stage, onOpen }: {
  deal: DealBoardRow
  pipeline: BoardPipeline
  stage: BoardStage | null
  onOpen: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
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
        'av2-dealcard cursor-grab touch-none rounded-lg transition-shadow focus:outline-none',
        isDragging && 'cursor-grabbing',
      )}
    >
      <DealCardBody deal={deal} pipeline={pipeline} stage={stage} />
    </div>
  )
}

// ── stage column (§7) ────────────────────────────────────────────────────────

function StageColumn({ stage, pipeline, deals, droppable, canManage, onOpen, onAdd, onEditStage }: {
  stage: BoardStage
  pipeline: BoardPipeline
  deals: DealBoardRow[]
  droppable: boolean
  canManage: boolean
  onOpen: (id: number) => void
  onAdd?: (stage: BoardStage) => void
  onEditStage?: (stage: BoardStage) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.name, disabled: !droppable })
  const total = deals.reduce((s, d) => s + (d.value ?? 0), 0)

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className="flex w-60 shrink-0 flex-col self-start overflow-hidden rounded-lg transition-colors"
      style={{
        border: '1px solid var(--a-border)',
        background: 'var(--a-bg)',
        boxShadow: isOver ? '0 0 0 2px var(--a-accent)' : undefined,
      }}
    >
      {/* Accent bar — full-width, stage color (§7) */}
      <div className="h-1.5 w-full" style={{ backgroundColor: stage.color }} aria-hidden />

      {/* Column header */}
      <div className="group flex items-start justify-between gap-2 px-3 pb-2 pt-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
            {stage.name}
            {canManage && onEditStage ? (
              <IconButton
                label={`Edit stage ${stage.name}`}
                tone="quiet"
                onClick={() => onEditStage(stage)}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                style={{ width: 22, height: 22 }}
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </IconButton>
            ) : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            <span className="a-num">{deals.length}</span> {deals.length === 1 ? 'deal' : 'deals'}
            <span className="a-num font-semibold" style={{ color: 'var(--a-ok)' }}>{dealMoney(total)}</span>
            {stage.isClosedStage ? <span className="font-medium" style={{ color: 'var(--a-ok)' }}>Closed</span> : null}
          </p>
        </div>
        {onAdd ? (
          <IconButton
            label={`Add a deal to ${stage.name}`}
            onClick={() => onAdd(stage)}
            className="av2-addbtn shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        ) : null}
      </div>

      {/* Card stack — independently vertically scrollable (§2) */}
      <div className="flex max-h-[calc(100vh-20rem)] min-h-16 flex-col gap-2 overflow-y-auto p-2 pt-0">
        {deals.length === 0 ? (
          <p className="px-1 py-4 text-center" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            No deals,{' '}
            {onAdd ? (
              <Button
                variant="quiet"
                onClick={() => onAdd(stage)}
                className="av2-textlink align-baseline"
                style={{ fontSize: 'var(--a-text-xs)', display: 'inline' }}
              >
                add deal
              </Button>
            ) : null}
          </p>
        ) : (
          deals.map((d) => (
            <DraggableDealCard key={d.id} deal={d} pipeline={pipeline} stage={stage} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  )
}

// ── main board ───────────────────────────────────────────────────────────────

export function DealsBoard({ pipeline, deals, brokers, isOwner, brokerSlug }: {
  pipeline: BoardPipeline
  /** Deals already scoped + filtered server-side to this pipeline. */
  deals: DealBoardRow[]
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
  /** The acting user's broker slug (default assignee on Add Deal). */
  brokerSlug: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Optimistic stage overrides applied on top of props: dealId → new stage.
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addTo, setAddTo] = useState<BoardStage | null>(null)
  const [addStageOpen, setAddStageOpen] = useState(false)
  const [editStage, setEditStage] = useState<BoardStage | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const stageOf = useCallback(
    (d: DealBoardRow) => overrides[d.id] ?? d.stage ?? UNSORTED,
    [overrides],
  )

  /** Open the §11 deal detail modal (page-mounted, driven by ?deal=). */
  const openDeal = useCallback(
    (id: number) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('deal', String(id))
      router.push(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const { columns, orphanColumns } = useMemo(() => {
    const byStage = new Map<string, DealBoardRow[]>()
    for (const s of pipeline.stages) byStage.set(s.name, [])
    const orphans = new Map<string, DealBoardRow[]>()
    for (const d of deals) {
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

    // Optimistic move; revert on failure (§15).
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
        router.refresh()
      }
    })
  }

  const activeDragDeal =
    activeDragId != null ? (deals.find((d) => d.id === activeDragId) ?? null) : null
  const activeDragStage = activeDragDeal
    ? (pipeline.stages.find((s) => s.name === stageOf(activeDragDeal)) ?? null)
    : null

  return (
    <div>
      {error ? (
        <p
          className="mx-4 mb-3 rounded-md px-3 py-2"
          style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)', fontSize: 'var(--a-text-xs)' }}
        >
          Could not move the deal: {error}
        </p>
      ) : null}

      {/* Desktop — draggable kanban (board scrolls horizontally, §2) */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <div className="overflow-x-auto px-4 pb-4">
            <div className="flex items-start gap-2" style={{ width: 'max-content' }}>
              {columns.map(({ stage, deals: colDeals }) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  pipeline={pipeline}
                  deals={colDeals}
                  droppable
                  canManage={isOwner}
                  onOpen={openDeal}
                  onAdd={(s) => setAddTo(s)}
                  onEditStage={(s) => setEditStage(s)}
                />
              ))}
              {/* Orphan (unknown-stage) columns — display only, not drop targets */}
              {orphanColumns.map(({ name, deals: colDeals }) => (
                <StageColumn
                  key={name}
                  stage={{
                    id: -1,
                    name: name === UNSORTED ? 'Unsorted' : name,
                    color: 'var(--a-border)',
                    orderWeight: 0,
                    isClosedStage: false,
                  }}
                  pipeline={pipeline}
                  deals={colDeals}
                  droppable={false}
                  canManage={false}
                  onOpen={openDeal}
                />
              ))}
              {/* §10 "Add a stage" — past the last column, owner only */}
              {isOwner ? (
                <Button
                  variant="quiet"
                  onClick={() => setAddStageOpen(true)}
                  className="av2-textlink mt-2 shrink-0"
                  style={{ fontSize: 'var(--a-text-sm)' }}
                >
                  Add a stage
                </Button>
              ) : null}
            </div>
          </div>

          <DragOverlay>
            {activeDragDeal ? (
              <div className="w-60 cursor-grabbing opacity-95" style={{ boxShadow: 'var(--a-shadow-overlay)' }}>
                <DealCardBody deal={activeDragDeal} pipeline={pipeline} stage={activeDragStage} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile — read-only stacked-by-stage list (tap to open) */}
      <div className="space-y-5 px-4 pb-6 md:hidden">
        {columns.map(({ stage, deals: colDeals }) => {
          const total = colDeals.reduce((s, d) => s + (d.value ?? 0), 0)
          return (
            <section key={stage.id}>
              <div
                className="flex items-center justify-between rounded-t-lg px-3 py-2"
                style={{ borderTop: `3px solid ${stage.color}`, backgroundColor: 'var(--a-inset)' }}
              >
                <span className="font-semibold" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>{stage.name}</span>
                <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  <span className="a-num">{colDeals.length}</span>
                  {' · '}
                  <span className="a-num" style={{ color: 'var(--a-ok)' }}>{dealMoney(total)}</span>
                  {stage.isClosedStage ? <span className="font-medium" style={{ color: 'var(--a-ok)' }}> Closed</span> : null}
                </span>
              </div>
              <div
                className="space-y-2 rounded-b-lg p-2"
                style={{ border: '1px solid var(--a-border)', borderTop: 'none', background: 'var(--a-bg)' }}
              >
                {colDeals.length === 0 ? (
                  <p className="py-3 text-center" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>No deals</p>
                ) : (
                  colDeals.map((d) => (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDeal(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDeal(d.id)
                        }
                      }}
                      className="av2-dealcard block w-full cursor-pointer rounded-lg text-left focus:outline-none"
                    >
                      <DealCardBody deal={d} pipeline={pipeline} stage={stage} />
                    </div>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* §12 stage-scoped Add Deal */}
      <AddDealDialog
        stage={addTo}
        pipeline={pipeline}
        brokers={brokers}
        isOwner={isOwner}
        brokerSlug={brokerSlug}
        onClose={() => setAddTo(null)}
        onCreated={(id) => {
          setAddTo(null)
          openDeal(id)
          router.refresh()
        }}
      />

      {/* §10 Add / Edit stage (owner only) */}
      <AddStageDialog
        open={addStageOpen}
        pipeline={pipeline}
        onClose={() => setAddStageOpen(false)}
      />
      <StageEditDialog stage={editStage} pipeline={pipeline} onClose={() => setEditStage(null)} />
    </div>
  )
}
