'use client'

/**
 * EditorCanvas — the §12.4.3 center canvas of the visual automation editor.
 *
 * Dot-grid background, the trigger card at the top, step cards connected by
 * vertical lines, delay badges (warning-chip token oval) on the connectors when
 * the following step waits, drop zones on the connectors while a palette tile is
 * being dragged, and the zoom toolbar (+ / − / fit / fullscreen) bottom-right.
 *
 * Admin v2 migration (11F): the shadcn Button/Badge/DropdownMenu stack is
 * replaced with '@/components/admin/v2' primitives. The zoom toolbar's
 * icon-only controls map straight onto IconButton (each already carried an
 * aria-label). The v2 barrel's Menu primitive assumes an icon-only trigger
 * (fixed av2-iconbtn box) and this file's "+ Add step" trigger carries visible
 * text, so the add-step menu is hand-built instead — a Button trigger plus an
 * av2-menu__panel/av2-menu__item results panel, with the same click-outside +
 * Escape-closes-and-refocuses-trigger behaviour Radix's DropdownMenu gave it.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4.3 + the
 * pixel reference screens/screen-35.md / screen-37.md. FUB's orange delay
 * badge maps to the admin v2 `--a-warn-chip` token (amber, dark text) — the
 * same "chip bg, carries dark text" token tokens.css documents for exactly
 * this shape of pill.
 */

import { useEffect, useRef, useState } from 'react'
import { Button, IconButton } from '@/components/admin/v2'
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
      className="mx-auto my-1 flex h-8 w-64 items-center justify-center rounded-lg text-xs transition-colors"
      style={{
        border: `2px dashed ${over ? 'var(--a-accent)' : 'var(--a-border)'}`,
        background: over ? 'var(--a-accent-wash)' : 'transparent',
        color: over ? 'var(--a-accent)' : 'var(--a-text-2)',
      }}
    >
      Drop here
    </div>
  )
}

function Connector({ delayDays }: { delayDays: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-4 w-px" style={{ background: 'var(--a-border)' }} aria-hidden />
      {delayDays > 0 ? (
        <>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs a-num"
            style={{ background: 'var(--a-warn-chip)', color: 'var(--a-text)', fontWeight: 600 }}
          >
            {delayDays} {delayDays === 1 ? 'day' : 'days'}
          </span>
          <div className="h-4 w-px" style={{ background: 'var(--a-border)' }} aria-hidden />
        </>
      ) : (
        <div className="h-4 w-px" style={{ background: 'var(--a-border)' }} aria-hidden />
      )}
    </div>
  )
}

/** "+ Add step" trigger + panel. Hand-built (see file header) to keep a
 *  text-carrying trigger while reusing the av2 menu panel/item tokens. */
function AddStepMenu({
  onAppendChannel,
  onAppendCondition,
}: {
  onAppendChannel: (channel: StepChannel) => void
  onAppendCondition: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        wrapRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <Button
        variant="quiet"
        className="h-8 rounded-full"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add step
      </Button>
      {open ? (
        <div
          className="av2-menu__panel"
          role="menu"
          aria-label="Add step"
          data-align="start"
          style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)' }}
        >
          {ACTION_TILES.map((t) => (
            <Button
              key={t.channel}
              variant="quiet"
              role="menuitem"
              className="w-full justify-start font-normal"
              style={{ background: 'transparent', border: 'none' }}
              onClick={() => {
                setOpen(false)
                onAppendChannel(t.channel)
              }}
            >
              {t.label}
            </Button>
          ))}
          <div style={{ borderTop: '1px solid var(--a-border)', margin: '4px 0' }} aria-hidden />
          <Button
            variant="quiet"
            role="menuitem"
            className="w-full justify-start font-normal"
            style={{ background: 'transparent', border: 'none' }}
            onClick={() => {
              setOpen(false)
              onAppendCondition()
            }}
          >
            Condition (IF / ELSE)
          </Button>
        </div>
      ) : null}
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
      className="relative h-full min-h-0 overflow-auto no-scrollbar"
      style={{
        background: 'var(--a-bg)',
        backgroundImage: 'radial-gradient(circle, var(--a-border) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="flex justify-center p-6" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
        <div ref={contentRef} className="flex w-80 flex-col items-stretch">
          {/* Trigger card (§12.4.3 #1) */}
          <Button
            variant="quiet"
            onClick={() => onSelect({ kind: 'trigger' })}
            className="av2-pane text-left transition-colors"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              width: '100%',
              minHeight: 'auto',
              fontWeight: 400,
              border: `1px solid ${selection.kind === 'trigger' ? 'var(--a-accent)' : 'var(--a-border)'}`,
              boxShadow: selection.kind === 'trigger' ? '0 0 0 1px var(--a-accent)' : 'none',
            }}
          >
            <span className="flex items-center gap-2">
              <Zap style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-accent)' }} aria-hidden />
              <span className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
                Trigger
              </span>
            </span>
            {triggers.length === 0 ? (
              <span className="block text-xs" style={{ color: 'var(--a-text-2)' }}>
                Manual — started by a broker or another automation
              </span>
            ) : (
              <span className="block space-y-0.5">
                {triggers.map((t, i) => (
                  <span key={i} className="block truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                    {TRIGGER_TYPE_LABELS[t.type] ?? t.type}
                    {t.value ? `: ${t.value}` : ''}
                  </span>
                ))}
              </span>
            )}
          </Button>

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
                <Button
                  variant="quiet"
                  onClick={() => onSelect({ kind: 'step', idx })}
                  className={cn('av2-pane text-left transition-colors')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'flex-start',
                    width: '100%',
                    minHeight: 'auto',
                    fontWeight: 400,
                    border: `1px solid ${selected ? 'var(--a-accent)' : 'var(--a-border)'}`,
                    boxShadow: selected ? '0 0 0 1px var(--a-accent)' : 'none',
                  }}
                >
                  {isCondition ? (
                    <>
                      <span className="flex items-center gap-2">
                        <GitBranch style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-accent)' }} aria-hidden />
                        <span className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
                          Condition
                        </span>
                        <span
                          className="ml-auto shrink-0"
                          style={{
                            fontSize: 'var(--a-text-xs)',
                            color: 'var(--a-text-2)',
                            border: '1px solid var(--a-border)',
                            borderRadius: 'var(--a-r-sm)',
                            padding: '1px 6px',
                          }}
                        >
                          IF / ELSE
                        </span>
                      </span>
                      <span className="block">
                        <span className="block truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                          {conditionSummary(node as ConditionNode)}
                        </span>
                        <span className="mt-0.5 block text-xs a-num" style={{ color: 'var(--a-text-2)' }}>
                          True: {(node as ConditionNode).truePath.length} · False: {(node as ConditionNode).falsePath.length}
                        </span>
                      </span>
                    </>
                  ) : (
                    (() => {
                      const step = node as Step
                      const Icon = CHANNEL_ICONS[step.channel]
                      return (
                        <>
                          <span className="flex items-center gap-2">
                            <Icon style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-accent)' }} aria-hidden />
                            <span className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
                              {CHANNEL_CARD_LABELS[step.channel]}
                            </span>
                          </span>
                          <span className="block">
                            <span className="block truncate text-xs" style={{ color: 'var(--a-text-2)' }}>
                              {stepSummary(step, lookups)}
                            </span>
                            {fr ? (
                              <span className="mt-0.5 block text-xs a-num" style={{ color: 'var(--a-text-2)' }}>
                                {fr.currentlyHere} here
                                {step.channel === 'email' && fr.emailsSent != null ? ` · ${fr.emailsSent} sent` : ''}
                              </span>
                            ) : null}
                          </span>
                        </>
                      )
                    })()
                  )}
                </Button>
              </div>
            )
          })}

          {/* Tail: drop zone + add-step menu */}
          <DropZone index={steps.length} active={isDragging} onDropAt={onDropAt} />
          <div className="flex flex-col items-center">
            <div className="h-4 w-px" style={{ background: 'var(--a-border)' }} aria-hidden />
            <AddStepMenu onAppendChannel={onAppendChannel} onAppendCondition={onAppendCondition} />
          </div>
        </div>
      </div>

      {/* Zoom toolbar (§12.4.3 canvas zoom controls) */}
      <div className="sticky bottom-3 z-10 mr-3 flex justify-end">
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)', boxShadow: 'var(--a-shadow-overlay)' }}
        >
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}>
            <ZoomIn className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}>
            <ZoomOut className="h-4 w-4" />
          </IconButton>
          <span className="w-10 text-center text-xs a-num" style={{ color: 'var(--a-text-2)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <IconButton label="Fit to screen" onClick={fitToScreen}>
            <Scan className="h-4 w-4" />
          </IconButton>
          <IconButton label="Fullscreen" onClick={toggleFullscreen}>
            <Maximize className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
