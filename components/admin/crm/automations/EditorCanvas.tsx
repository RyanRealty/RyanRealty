'use client'

/**
 * EditorCanvas — the §12.4.3 center canvas of the visual automation editor.
 *
 * Dot-grid background, the trigger card at the top, step cards connected by
 * vertical lines, delay badges (warning-token oval) on the connectors when the
 * following step waits, drop zones on the connectors while a palette tile is
 * being dragged, and the zoom toolbar (+ / − / fit / fullscreen) bottom-right.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4.3 + the
 * pixel reference screens/screen-35.md / screen-37.md. FUB's orange delay
 * badge maps to the Ryan Realty `warning` token (the sanctioned swap — no
 * off-brand hex).
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  GitBranch,
  Mail,
  MessageSquare,
  ClipboardCheck,
  Tag,
  ArrowRightLeft,
  StickyNote,
  UserRoundCog,
  Play,
  PauseCircle,
  Plus,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize,
  Scan,
} from 'lucide-react'
import {
  isConditionNode,
  type AnyStepOrCondition,
  type ConditionNode,
  type Step,
  type StepChannel,
  type SequenceTrigger,
} from '@/lib/crm/sequence-step-schema'
import {
  CHANNEL_CARD_LABELS,
  TRIGGER_TYPE_LABELS,
  PALETTE_DRAG_TYPE,
  decodeDragPayload,
  type EditorSelection,
  type PaletteDragPayload,
} from './editor-shared'
import { ACTION_TILES } from './editor-shared'

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

export type CanvasLookups = {
  templateNameByKey: Map<string, string>
  stageLabelByKey: Map<string, string>
  brokerNameBySlug: Map<string, string>
  sequenceNameById: Map<number, string>
  tagLabelByKey: Map<string, string>
}

export type CanvasFunnelRow = { stepIndex: number; currentlyHere: number; emailsSent: number | null }

/** One-line config summary rendered under the step name on its card. */
export function stepSummary(step: Step, lookups: CanvasLookups): string {
  switch (step.channel) {
    case 'email':
    case 'sms':
      if (step.templateKey) return lookups.templateNameByKey.get(step.templateKey) ?? step.templateKey
      return step.body?.trim() ? step.body.trim().slice(0, 60) : 'No template or message yet'
    case 'task':
      return step.taskName?.trim() || 'No task name yet'
    case 'tag': {
      const adds = (step.addTags ?? []).map((t) => lookups.tagLabelByKey.get(t) ?? t)
      const removes = (step.removeTags ?? []).map((t) => lookups.tagLabelByKey.get(t) ?? t)
      const parts: string[] = []
      if (adds.length) parts.push(`Add ${adds.join(', ')}`)
      if (removes.length) parts.push(`Remove ${removes.join(', ')}`)
      return parts.join(' · ') || 'No tags yet'
    }
    case 'change_stage':
      return step.value ? `Move to ${lookups.stageLabelByKey.get(step.value) ?? step.value}` : 'No stage yet'
    case 'add_note':
      return step.value?.trim() ? step.value.trim().slice(0, 60) : 'No note text yet'
    case 'reassign':
      return step.value ? `Assign to ${lookups.brokerNameBySlug.get(step.value) ?? step.value}` : 'No broker yet'
    case 'run_automation': {
      const id = Number(step.value)
      return step.value ? `Start ${lookups.sequenceNameById.get(id) ?? `workflow ${step.value}`}` : 'No automation yet'
    }
    case 'stop_other_plans':
      return 'Pauses every other running automation for the contact'
  }
}

function conditionSummary(node: ConditionNode): string {
  const field = node.field === 'stage' ? 'Stage' : node.field === 'tag' ? 'Tag' : 'Source'
  const op = node.op === 'is' ? 'is' : node.op === 'is_not' ? 'is not' : 'contains'
  return `If ${field} ${op} ${node.value || '…'}`
}

function DropZone({
  index,
  active,
  onDropAt,
}: {
  index: number
  active: boolean
  onDropAt: (index: number, payload: PaletteDragPayload) => void
}) {
  const [over, setOver] = useState(false)
  if (!active) return null
  return (
    <div
      data-dropzone={index}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const payload = decodeDragPayload(e.dataTransfer.getData(PALETTE_DRAG_TYPE))
        if (payload) onDropAt(index, payload)
      }}
      className={cn(
        'mx-auto my-1 flex h-8 w-64 items-center justify-center rounded-lg border-2 border-dashed text-xs transition-colors',
        over ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
      )}
    >
      Drop here
    </div>
  )
}

function Connector({ delayDays }: { delayDays: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-4 w-px bg-border" aria-hidden />
      {delayDays > 0 ? (
        <>
          <Badge className="rounded-full bg-warning px-2.5 py-0.5 text-xs tabular-nums text-warning-foreground hover:bg-warning">
            {delayDays} {delayDays === 1 ? 'day' : 'days'}
          </Badge>
          <div className="h-4 w-px bg-border" aria-hidden />
        </>
      ) : (
        <div className="h-4 w-px bg-border" aria-hidden />
      )}
    </div>
  )
}

export function EditorCanvas({
  steps,
  triggers,
  selection,
  onSelect,
  dragging,
  onDropAt,
  onAppendChannel,
  onAppendCondition,
  funnel,
  lookups,
}: {
  steps: AnyStepOrCondition[]
  triggers: SequenceTrigger[]
  selection: EditorSelection
  onSelect: (sel: EditorSelection) => void
  dragging: PaletteDragPayload | null
  onDropAt: (index: number, payload: PaletteDragPayload) => void
  onAppendChannel: (channel: StepChannel) => void
  onAppendCondition: () => void
  funnel: CanvasFunnelRow[]
  lookups: CanvasLookups
}) {
  const [zoom, setZoom] = useState(1)
  const outerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isDragging = dragging != null
  const funnelByIndex = new Map(funnel.map((r) => [r.stepIndex, r]))

  function fitToScreen() {
    const outer = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return
    const contentHeight = content.scrollHeight
    const available = outer.clientHeight - 32
    if (contentHeight <= 0) return
    setZoom(Math.min(1, Math.max(0.25, available / contentHeight)))
  }

  function toggleFullscreen() {
    const outer = outerRef.current
    if (!outer) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void outer.requestFullscreen()
  }

  return (
    <div
      ref={outerRef}
      className="relative h-full min-h-0 overflow-auto bg-background no-scrollbar"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="flex justify-center p-6" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
        <div ref={contentRef} className="flex w-80 flex-col items-stretch">
          {/* Trigger card (§12.4.3 #1) */}
          <button
            type="button"
            onClick={() => onSelect({ kind: 'trigger' })}
            className={cn(
              'rounded-xl border bg-card p-3 text-left shadow-sm transition-colors',
              selection.kind === 'trigger' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
            )}
          >
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-sm font-semibold text-foreground">Trigger</span>
            </span>
            {triggers.length === 0 ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                Manual — started by a broker or another automation
              </span>
            ) : (
              <span className="mt-1 block space-y-0.5">
                {triggers.map((t, i) => (
                  <span key={i} className="block truncate text-xs text-muted-foreground">
                    {TRIGGER_TYPE_LABELS[t.type] ?? t.type}
                    {t.value ? `: ${t.value}` : ''}
                  </span>
                ))}
              </span>
            )}
          </button>

          {/* Step cards + connectors + drop zones */}
          {steps.map((node, idx) => {
            const isCondition = isConditionNode(node)
            const delayDays = isCondition ? 0 : Number((node as Step).delayDays ?? 0)
            const selected = selection.kind === 'step' && selection.idx === idx
            const fr = funnelByIndex.get(idx)
            return (
              <div key={idx} className="flex flex-col items-stretch">
                <DropZone index={idx} active={isDragging} onDropAt={onDropAt} />
                <Connector delayDays={delayDays} />
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'step', idx })}
                  className={cn(
                    'rounded-xl border bg-card p-3 text-left shadow-sm transition-colors',
                    selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
                  )}
                >
                  {isCondition ? (
                    <>
                      <span className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="text-sm font-semibold text-foreground">Condition</span>
                        <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                          IF / ELSE
                        </Badge>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {conditionSummary(node as ConditionNode)}
                      </span>
                      <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                        True: {(node as ConditionNode).truePath.length} · False: {(node as ConditionNode).falsePath.length}
                      </span>
                    </>
                  ) : (
                    (() => {
                      const step = node as Step
                      const Icon = CHANNEL_ICONS[step.channel]
                      return (
                        <>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <span className="text-sm font-semibold text-foreground">{CHANNEL_CARD_LABELS[step.channel]}</span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{stepSummary(step, lookups)}</span>
                          {fr ? (
                            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                              {fr.currentlyHere} here
                              {step.channel === 'email' && fr.emailsSent != null ? ` · ${fr.emailsSent} sent` : ''}
                            </span>
                          ) : null}
                        </>
                      )
                    })()
                  )}
                </button>
              </div>
            )
          })}

          {/* Tail: drop zone + add-step menu */}
          <DropZone index={steps.length} active={isDragging} onDropAt={onDropAt} />
          <div className="flex flex-col items-center">
            <div className="h-4 w-px bg-border" aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-full">
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add step
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {ACTION_TILES.map((t) => (
                  <DropdownMenuItem key={t.channel} onSelect={() => onAppendChannel(t.channel)}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onAppendCondition}>Condition (IF / ELSE)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Zoom toolbar (§12.4.3 canvas zoom controls) */}
      <div className="sticky bottom-3 z-10 mr-3 flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Fit to screen" onClick={fitToScreen}>
            <Scan className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Fullscreen" onClick={toggleFullscreen}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
