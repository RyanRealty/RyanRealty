'use client'

/**
 * EditorPalette — the §12.4.2 left palette of the visual automation editor.
 *
 * Two tabs (Triggers / Steps). The Steps tab carries a Controls section
 * (Conditions, Time Delay) and an Actions section (every engine-executable
 * channel). Tiles are draggable onto the canvas (drop zones on the connector
 * lines) AND clickable (appends at the end) — the dragged tile shows a dashed
 * accent border per the spec's drag affordance. A search input filters tiles.
 *
 * Admin v2 migration (11F): the shadcn Tabs/Input stack is replaced with
 * '@/components/admin/v2' + a hand-rolled APG tablist (the v2 barrel has no
 * Tabs primitive yet). The tablist reproduces Radix's default keyboard
 * behaviour — ArrowLeft/ArrowRight/Home/End move focus AND selection, with a
 * roving tabindex — since Radix Tabs activates on arrow-key move by default.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4.2 + the
 * pixel reference screens/screen-35.md (tab strip, search, drag banner,
 * Controls / Actions sections, drag handles).
 */

import { useState, type KeyboardEvent, useRef} from 'react'
import { Button, SearchField } from '@/components/admin/v2'
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

const TAB_ORDER = ['triggers', 'steps'] as const
type TabKey = (typeof TAB_ORDER)[number]

/** DOM id per tab, used to move focus without a ref — the v2 Button is a
 *  plain function component (no forwardRef), so a callback ref never
 *  attaches to the underlying <button>. Both tab buttons are always mounted
 *  (only their aria-selected/tabIndex change), so the lookup always finds
 *  the element it needs synchronously. */
const TAB_IDS: Record<TabKey, string> = {
  triggers: 'palette-tab-triggers',
  steps: 'palette-tab-steps',
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
    <Button
      variant="quiet"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DRAG_TYPE, encodeDragPayload(payload))
        e.dataTransfer.effectAllowed = 'copy'
        onDragChange(payload)
      }}
      onDragEnd={() => onDragChange(null)}
      onClick={onClick}
      className="w-full text-left transition-colors"
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--a-r-md)',
        cursor: 'grab',
        fontWeight: 400,
        minHeight: 'auto',
        justifyContent: 'flex-start',
        border: isDragging ? '1px dashed var(--a-accent)' : '1px solid var(--a-border)',
        background: 'var(--a-bg)',
      }}
      title={description}
    >
      <Icon aria-hidden style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-accent)' }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>
          {label}
        </span>
      </span>
      <GripVertical aria-hidden style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-text-2)' }} />
    </Button>
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
  const [tab, setTab] = useState<TabKey>('steps')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const actions = ACTION_TILES.filter((t) => !q || t.label.toLowerCase().includes(q))
  const controls = CONTROL_TILES.filter((t) => !q || t.label.toLowerCase().includes(q))
  const triggers = SEQUENCE_TRIGGER_TYPES.filter((t) => !q || TRIGGER_TYPE_LABELS[t].toLowerCase().includes(q))

  // Button forwards its ref (see Button.tsx), so the roving tabindex moves
  // focus through React rather than looking the node up in the document.
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({})
  function selectTab(next: TabKey) {
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  /** Reproduces Radix Tabs' default keyboard behaviour: arrow keys move focus
   *  AND selection (roving tabindex), Home/End jump to the first/last tab. */
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: TabKey) {
    const idx = TAB_ORDER.indexOf(current)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      selectTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      selectTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length])
    } else if (e.key === 'Home') {
      e.preventDefault()
      selectTab(TAB_ORDER[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      selectTab(TAB_ORDER[TAB_ORDER.length - 1])
    }
  }

  function tabStyle(key: TabKey) {
    const active = tab === key
    return {
      padding: '8px 0',
      borderRadius: 'var(--a-r-md)',
      border: '1px solid var(--a-border)',
      background: active ? 'var(--a-accent-wash)' : 'var(--a-bg)',
      color: active ? 'var(--a-accent)' : 'var(--a-text-2)',
      fontWeight: active ? 600 : 500,
    }
  }

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto p-3 no-scrollbar"
      style={{ borderRight: '1px solid var(--a-border)', background: 'var(--a-bg)' }}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div role="tablist" aria-label="Palette" className="grid w-full grid-cols-2" style={{ gap: 4 }}>
          <Button
            ref={(el) => {
              tabRefs.current.triggers = el
            }}
            variant="quiet"
            role="tab"
            id={TAB_IDS.triggers}
            aria-selected={tab === 'triggers'}
            aria-controls="palette-panel-triggers"
            tabIndex={tab === 'triggers' ? 0 : -1}
            onClick={() => selectTab('triggers')}
            onKeyDown={(e) => onTabKeyDown(e, 'triggers')}
            className="text-sm"
            style={tabStyle('triggers')}
          >
            Triggers
          </Button>
          <Button
            ref={(el) => {
              tabRefs.current.steps = el
            }}
            variant="quiet"
            role="tab"
            id={TAB_IDS.steps}
            aria-selected={tab === 'steps'}
            aria-controls="palette-panel-steps"
            tabIndex={tab === 'steps' ? 0 : -1}
            onClick={() => selectTab('steps')}
            onKeyDown={(e) => onTabKeyDown(e, 'steps')}
            className="text-sm"
            style={tabStyle('steps')}
          >
            Steps
          </Button>
        </div>

        <div className="relative">
          <Search
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              color: 'var(--a-text-2)',
              pointerEvents: 'none',
            }}
          />
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search palette"
            style={{ width: '100%', maxWidth: 'none', paddingLeft: 32 }}
          />
        </div>

        <div
          role="tabpanel"
          id="palette-panel-triggers"
          aria-labelledby="palette-tab-triggers"
          hidden={tab !== 'triggers'}
          className="mt-0 space-y-2"
        >
          <p
            className="rounded-lg px-2.5 py-2 text-xs"
            style={{ border: '1px dashed var(--a-border)', background: 'var(--a-inset)', color: 'var(--a-text-2)' }}
          >
            Click a trigger to add it. Any one matching trigger starts the automation.
          </p>
          {triggers.map((t) => (
            <Button
              key={t}
              variant="quiet"
              onClick={() => onAddTrigger(t)}
              className="w-full text-left transition-colors"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--a-r-md)',
                fontWeight: 400,
                minHeight: 'auto',
                justifyContent: 'flex-start',
                border: '1px solid var(--a-border)',
                background: 'var(--a-bg)',
              }}
            >
              <Zap aria-hidden style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--a-accent)' }} />
              <span className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>
                {TRIGGER_TYPE_LABELS[t]}
              </span>
            </Button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="palette-panel-steps"
          aria-labelledby="palette-tab-steps"
          hidden={tab !== 'steps'}
          className="mt-0 space-y-3"
        >
          <p
            className="rounded-lg px-2.5 py-2 text-xs"
            style={{ border: '1px dashed var(--a-border)', background: 'var(--a-inset)', color: 'var(--a-text-2)' }}
          >
            Drag a step to the canvas, or click to add it at the end.
          </p>

          {controls.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--a-text-2)' }}>
                Controls
              </p>
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
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--a-text-2)' }}>
                Actions
              </p>
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
        </div>
      </div>
    </div>
  )
}
