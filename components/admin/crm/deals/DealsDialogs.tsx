'use client'

/**
 * Deals dialogs (spec §10):
 *  - AddDealDialog  — §12 Add Deal flow (per-column "+" / empty-state link):
 *    name + stage (required, pre-scoped), price, projected close date,
 *    associated contact (search), commission, assignee (owner picks any broker;
 *    a restricted broker always self-assigns — AC-6).
 *  - AddStageDialog — §10 Add-a-stage: name + accent color from the predefined
 *    palette + is_closed_stage toggle. Owner only (action enforces).
 *  - StageEditDialog — §10 stage management: rename / recolor / closed flag /
 *    move left-right (order_weight renumbers in 1000-gaps) / delete.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { STAGE_COLOR_PALETTE } from '@/lib/crm/deal-pipelines'
import type { BoardPipeline, BoardStage } from '@/lib/data/crm/getDealPipelines'
import { createCrmDeal } from '@/app/actions/crm-deals'
import {
  createDealStage,
  updateDealStage,
  deleteDealStage,
  moveDealStage,
} from '@/app/actions/crm-deal-pipelines'
import { searchPeopleForMergeAction, type MergeCandidate } from '@/app/actions/crm-person-gaps'

// ── contact search field (shared with the detail modal) ─────────────────────

export function ContactSearchField({
  selected,
  onSelect,
  excludeIds = [],
  placeholder = 'Search contacts…',
}: {
  selected: { id: number; name: string | null } | null
  onSelect: (p: { id: number; name: string | null } | null) => void
  excludeIds?: number[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MergeCandidate[]>([])
  const [searching, startSearch] = useTransition()

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchPeopleForMergeAction(q, -1)
        setResults(rows.filter((r) => !excludeIds.includes(r.id)))
      })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        <span className="truncate">{selected.name ?? `Contact #${selected.id}`}</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Remove contact"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      {query.trim().length >= 2 ? (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover text-sm">
          {searching && results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No matches</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ id: r.id, name: r.name })
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="truncate">{r.name ?? `Contact #${r.id}`}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{r.stage}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

// ── AddDealDialog (§12) ──────────────────────────────────────────────────────

export function AddDealDialog({
  stage,
  pipeline,
  brokers,
  isOwner,
  brokerSlug,
  onClose,
  onCreated,
}: {
  stage: BoardStage | null
  pipeline: BoardPipeline
  brokers: Array<{ slug: string; name: string }>
  isOwner: boolean
  brokerSlug: string | null
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [commission, setCommission] = useState('')
  const [contact, setContact] = useState<{ id: number; name: string | null } | null>(null)
  const [assignee, setAssignee] = useState<string>(brokerSlug ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setPrice('')
    setCloseDate('')
    setCommission('')
    setContact(null)
    setAssignee(brokerSlug ?? '')
    setError(null)
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed || !stage) {
      setError('Deal name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCrmDeal({
        name: trimmed,
        pipeline: pipeline.name,
        stage: stage.name,
        value: price.trim() ? Number(price.replace(/[^0-9.]/g, '')) : null,
        close_date: closeDate.trim() || null,
        commission_dollars: commission.trim() ? Number(commission.replace(/[^0-9.]/g, '')) : null,
        person_id: contact?.id ?? null,
        assigned_broker: isOwner ? (assignee || null) : null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      reset()
      onCreated(res.id)
    })
  }

  return (
    <Dialog
      open={stage != null}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add deal{stage ? ` · ${stage.name}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="add-deal-name">Deal name</Label>
            <Input
              id="add-deal-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="Property address, e.g. 2732 NW Ordway"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-deal-price">Price</Label>
              <Input
                id="add-deal-price"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="$"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-deal-commission">Commission</Label>
              <Input
                id="add-deal-commission"
                inputMode="numeric"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="$"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-deal-close">Projected close date</Label>
            <Input
              id="add-deal-close"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <ContactSearchField selected={contact} onSelect={setContact} />
          </div>
          {isOwner ? (
            <div className="space-y-1.5">
              <Label>Team member</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign a broker" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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

// ── color swatch row (shared by add + edit stage) ────────────────────────────

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Stage color ${c}`}
          aria-pressed={value === c}
          className={cn(
            'h-6 w-6 rounded-full border border-border transition-transform',
            value === c && 'scale-110 ring-2 ring-primary ring-offset-1',
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

// ── AddStageDialog (§10) ─────────────────────────────────────────────────────

export function AddStageDialog({
  open,
  pipeline,
  onClose,
}: {
  open: boolean
  pipeline: BoardPipeline
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(STAGE_COLOR_PALETTE[0])
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) {
      setError('Stage name is required')
      return
    }
    startTransition(async () => {
      const res = await createDealStage(pipeline.id, {
        name: name.trim(),
        color,
        isClosedStage: closed,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setName('')
      setClosed(false)
      setError(null)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a stage · {pipeline.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="add-stage-name">Stage name</Label>
            <Input
              id="add-stage-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatches value={color} onChange={setColor} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={closed} onCheckedChange={(v) => setClosed(v === true)} />
            Mark deals in this stage as closed for reporting
          </label>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !name.trim()}>
            {pending ? 'Adding…' : 'Add stage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── StageEditDialog (§10 stage management) ───────────────────────────────────

export function StageEditDialog({
  stage,
  pipeline,
  onClose,
}: {
  stage: BoardStage | null
  pipeline: BoardPipeline
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (stage) {
      setName(stage.name)
      setColor(stage.color)
      setClosed(stage.isClosedStage)
      setError(null)
    }
  }, [stage])

  if (!stage) return null

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Failed')
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit stage · {stage.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-stage-name">Stage name</Label>
            <Input id="edit-stage-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatches value={color} onChange={setColor} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={closed} onCheckedChange={(v) => setClosed(v === true)} />
            Mark deals in this stage as closed for reporting
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reorder:</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Move stage left"
              disabled={pending}
              onClick={() => run(() => moveDealStage(stage.id, -1))}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Move stage right"
              disabled={pending}
              onClick={() => run(() => moveDealStage(stage.id, 1))}
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => deleteDealStage(stage.id))}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() =>
                run(() => updateDealStage(stage.id, { name: name.trim(), color, isClosedStage: closed }))
              }
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
