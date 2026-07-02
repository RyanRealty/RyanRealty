'use client'

/**
 * EditorPalette — the §12.4.2 left palette of the visual automation editor.
 *
 * Two tabs (Triggers / Steps). The Steps tab carries a Controls section
 * (Conditions, Time Delay) and an Actions section (every engine-executable
 * channel). Tiles are draggable onto the canvas (drop zones on the connector
 * lines) AND clickable (appends at the end) — the dragged tile shows a dashed
 * primary border per the spec's drag affordance. A search input filters tiles.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4.2 + the
 * pixel reference screens/screen-35.md (tab strip, search, drag banner,
 * Controls / Actions sections, drag handles).
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  GitBranch,
  GripVertical,
  Mail,
  MessageSquare,
  ClipboardCheck,
  Tag,
  ArrowRightLeft,
  StickyNote,
  UserRoundCog,
  Play,
  PauseCircle,
  Timer,
  Search,
  Zap,
} from 'lucide-react'
import type { StepChannel, SequenceTriggerType } from '@/lib/crm/sequence-step-schema'
import { SEQUENCE_TRIGGER_TYPES } from '@/lib/crm/sequence-step-schema'
import {
  ACTION_TILES,
  CONTROL_TILES,
  TRIGGER_TYPE_LABELS,
  PALETTE_DRAG_TYPE,
  encodeDragPayload,
  type PaletteDragPayload,
} from './editor-shared'

const CHANNEL_ICONS: Record<StepChannel, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  task: ClipboardCheck,
  tag: Tag,
  change_stage: ArrowRightLeft,
  add_note: StickyNote,
  reassign: UserRoundCog,
  run_automation: Play,
  stop_other_plans: PauseCircle,
}

function payloadKey(p: PaletteDragPayload): string {
  return p.kind === 'channel' ? `channel:${p.channel}` : p.kind
}

function PaletteTile({
  payload,
  label,
  description,
  icon: Icon,
  dragging,
  onDragChange,
  onClick,
}: {
  payload: PaletteDragPayload
  label: string
  description: string
  icon: typeof Mail
  dragging: PaletteDragPayload | null
  onDragChange: (p: PaletteDragPayload | null) => void
  onClick: () => void
}) {
  const isDragging = dragging != null && payloadKey(dragging) === payloadKey(payload)
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DRAG_TYPE, encodeDragPayload(payload))
        e.dataTransfer.effectAllowed = 'copy'
        onDragChange(payload)
      }}
      onDragEnd={() => onDragChange(null)}
      onClick={onClick}
      className={cn(
        'flex w-full cursor-grab items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-colors',
        isDragging ? 'border-dashed border-primary' : 'border-border hover:border-primary/50',
      )}
      title={description}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
      </span>
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

export function EditorPalette({
  dragging,
  onDragChange,
  onAddChannel,
  onAddCondition,
  onTimeDelay,
  onAddTrigger,
}: {
  dragging: PaletteDragPayload | null
  onDragChange: (p: PaletteDragPayload | null) => void
  /** Append a step of this channel at the end of the canvas. */
  onAddChannel: (channel: StepChannel) => void
  onAddCondition: () => void
  /** Focus the wait/delay config of the selected (or last) step. */
  onTimeDelay: () => void
  onAddTrigger: (type: SequenceTriggerType) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const actions = ACTION_TILES.filter((t) => !q || t.label.toLowerCase().includes(q))
  const controls = CONTROL_TILES.filter((t) => !q || t.label.toLowerCase().includes(q))
  const triggers = SEQUENCE_TRIGGER_TYPES.filter((t) => !q || TRIGGER_TYPE_LABELS[t].toLowerCase().includes(q))

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-r border-border bg-background p-3 no-scrollbar">
      <Tabs defaultValue="steps" className="flex min-h-0 flex-col gap-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
        </TabsList>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 pl-8 text-sm"
            aria-label="Search palette"
          />
        </div>

        <TabsContent value="triggers" className="mt-0 space-y-2">
          <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-2.5 py-2 text-xs text-muted-foreground">
            Click a trigger to add it. Any one matching trigger starts the automation.
          </p>
          {triggers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onAddTrigger(t)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/50"
            >
              <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate text-sm font-medium text-foreground">{TRIGGER_TYPE_LABELS[t]}</span>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="steps" className="mt-0 space-y-3">
          <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-2.5 py-2 text-xs text-muted-foreground">
            Drag a step to the canvas, or click to add it at the end.
          </p>

          {controls.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Controls</p>
              {controls.map((t) =>
                t.kind === 'condition' ? (
                  <PaletteTile
                    key="condition"
                    payload={{ kind: 'condition' }}
                    label={t.label}
                    description={t.description}
                    icon={GitBranch}
                    dragging={dragging}
                    onDragChange={onDragChange}
                    onClick={onAddCondition}
                  />
                ) : (
                  <PaletteTile
                    key="time_delay"
                    payload={{ kind: 'time_delay' }}
                    label={t.label}
                    description={t.description}
                    icon={Timer}
                    dragging={dragging}
                    onDragChange={onDragChange}
                    onClick={onTimeDelay}
                  />
                ),
              )}
            </div>
          ) : null}

          {actions.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
              {actions.map((t) => (
                <PaletteTile
                  key={t.channel}
                  payload={{ kind: 'channel', channel: t.channel }}
                  label={t.label}
                  description={t.description}
                  icon={CHANNEL_ICONS[t.channel]}
                  dragging={dragging}
                  onDragChange={onDragChange}
                  onClick={() => onAddChannel(t.channel)}
                />
              ))}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
