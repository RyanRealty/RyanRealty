'use client'

/**
 * AutomationEditor — the §12.4 visual automation editor (FUB
 * /2/automations/v2/edit/{id}), re-skinned to Ryan Realty tokens.
 *
 * Three-column layout with no outer scrollbar:
 *   left palette (Triggers / Steps tabs) · dot-grid canvas (trigger card, step
 *   cards, delay badges, drop zones, zoom controls) · right config panel.
 * Top bar: "← Back to Automations", the automation name as an inline editable
 * field, the Enabled/Disabled publish toggle (optimistic, reverts on error),
 * and Save.
 *
 * The state model is the engine's canonical schema (steps jsonb + triggers
 * jsonb + settings) — saving runs the same three validated server calls the
 * previous builder used (saveTriggers → saveSteps → saveSettings), so a
 * malformed step can never reach the engine. Send-path compliance (suppression,
 * quiet hours, unsubscribe) lives in the engine and is NOT configurable here.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4 + pixel
 * references screens/screen-35/36/37.md.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  EMPTY_STEP,
  EMPTY_CONDITION,
  isConditionNode,
  type AnyStepOrCondition,
  type ConditionNode,
  type SequenceTrigger,
  type SequenceTriggerType,
  type Step,
  type StepChannel,
} from '@/lib/crm/sequence-step-schema'
import { EditorPalette } from './EditorPalette'
import { EditorCanvas, type CanvasFunnelRow, type CanvasLookups } from './EditorCanvas'
import {
  StepConfigPanel,
  type PanelOptions,
  type TemplateOption,
  type TagOption,
  type StageOption,
  type BrokerOption,
  type SequenceOption,
} from './StepConfigPanel'
import type { EditorSelection, PaletteDragPayload } from './editor-shared'

type ActionResult = { ok: true } | { ok: false; error: string }

export type AutomationEditorActions = {
  saveSteps: (steps: AnyStepOrCondition[]) => Promise<ActionResult>
  saveSettings: (input: { name: string; description: string | null; stopOnReply: boolean }) => Promise<ActionResult>
  saveTriggers: (triggers: SequenceTrigger[]) => Promise<ActionResult>
  setStatus: (status: 'active' | 'paused') => Promise<ActionResult>
}

export function AutomationEditor({
  initialName,
  initialDescription,
  initialStopOnReply,
  initialStatus,
  initialSteps,
  initialTriggers,
  templates,
  tags,
  stages,
  brokers,
  sequences,
  funnel,
  funnelUnreadable,
  actions,
}: {
  initialName: string
  initialDescription: string
  initialStopOnReply: boolean
  initialStatus: string
  initialSteps: AnyStepOrCondition[]
  initialTriggers: SequenceTrigger[]
  templates: TemplateOption[]
  tags: TagOption[]
  stages: StageOption[]
  brokers: BrokerOption[]
  sequences: SequenceOption[]
  funnel: CanvasFunnelRow[]
  funnelUnreadable: boolean
  actions: AutomationEditorActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [stopOnReply, setStopOnReply] = useState(initialStopOnReply)
  const [steps, setSteps] = useState<AnyStepOrCondition[]>(initialSteps)
  const [triggers, setTriggers] = useState<SequenceTrigger[]>(initialTriggers)
  const [status, setStatus] = useState(initialStatus)
  const [selection, setSelection] = useState<EditorSelection>({ kind: 'settings' })
  const [dragging, setDragging] = useState<PaletteDragPayload | null>(null)
  const [delayFocusToken, setDelayFocusToken] = useState(0)

  const options: PanelOptions = useMemo(
    () => ({ templates, tags, stages, brokers, sequences }),
    [templates, tags, stages, brokers, sequences],
  )

  const lookups: CanvasLookups = useMemo(
    () => ({
      templateNameByKey: new Map(templates.map((t) => [t.key, t.name])),
      stageLabelByKey: new Map(stages.map((s) => [s.key, s.label])),
      brokerNameBySlug: new Map(brokers.map((b) => [b.slug, b.label])),
      sequenceNameById: new Map(sequences.map((s) => [s.id, s.name])),
      tagLabelByKey: new Map(tags.map((t) => [t.key, t.label])),
    }),
    [templates, stages, brokers, sequences, tags],
  )

  // ── Step mutations ────────────────────────────────────────────────────────
  function insertAt(index: number, node: AnyStepOrCondition) {
    setSteps((prev) => {
      const next = [...prev]
      next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
      return next
    })
    setSelection({ kind: 'step', idx: Math.max(0, Math.min(index, steps.length)) })
  }

  function handleDropAt(index: number, payload: PaletteDragPayload) {
    if (payload.kind === 'channel') {
      insertAt(index, { ...EMPTY_STEP[payload.channel] })
    } else if (payload.kind === 'condition') {
      insertAt(index, { ...EMPTY_CONDITION })
    } else {
      // Time Delay drops onto a connector: configure the wait of the step the
      // connector leads INTO (or the last step at the tail position).
      const target = Math.min(index, steps.length - 1)
      if (target >= 0) {
        setSelection({ kind: 'step', idx: target })
        setDelayFocusToken((t) => t + 1)
      }
    }
    setDragging(null)
  }

  function appendChannel(channel: StepChannel) {
    insertAt(steps.length, { ...EMPTY_STEP[channel] })
  }

  function appendCondition() {
    insertAt(steps.length, { ...EMPTY_CONDITION })
  }

  function focusDelay() {
    // Palette "Time Delay" click: focus the wait field of the selected step,
    // or the last step when nothing is selected.
    const idx = selection.kind === 'step' ? selection.idx : steps.length - 1
    if (idx >= 0) {
      setSelection({ kind: 'step', idx })
      setDelayFocusToken((t) => t + 1)
    }
  }

  function patchStep(idx: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === idx && !isConditionNode(s) ? { ...(s as Step), ...patch } : s)))
  }

  function patchCondition(idx: number, patch: Partial<ConditionNode>) {
    setSteps((prev) => prev.map((s, i) => (i === idx && isConditionNode(s) ? { ...(s as ConditionNode), ...patch } : s)))
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    setSelection({ kind: 'settings' })
  }

  function addTrigger(type: SequenceTriggerType) {
    setTriggers((prev) => [...prev, { type }])
    setSelection({ kind: 'trigger' })
  }

  // ── Publish toggle (optimistic, §12.4.1 top bar) ──────────────────────────
  function toggleEnabled(nextEnabled: boolean) {
    const prev = status
    const target = nextEnabled ? 'active' : 'paused'
    setStatus(target)
    setNote(null)
    startTransition(async () => {
      const r = await actions.setStatus(target)
      if (!r.ok) {
        setStatus(prev)
        setNote({ tone: 'err', text: r.error })
      } else {
        router.refresh()
      }
    })
  }

  // ── Save (triggers → steps → settings, same validated calls as before) ─────
  function saveAll() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNote({ tone: 'err', text: 'An automation name is required' })
      return
    }
    setNote(null)
    startTransition(async () => {
      const triggersResult = await actions.saveTriggers(triggers)
      if (!triggersResult.ok) {
        setNote({ tone: 'err', text: triggersResult.error })
        return
      }
      const stepsResult = await actions.saveSteps(steps)
      if (!stepsResult.ok) {
        setNote({ tone: 'err', text: stepsResult.error })
        return
      }
      const settingsResult = await actions.saveSettings({
        name: trimmedName,
        description: description.trim() || null,
        stopOnReply,
      })
      if (!settingsResult.ok) {
        setNote({ tone: 'err', text: settingsResult.error })
        return
      }
      setNote({ tone: 'ok', text: 'Automation saved.' })
      router.refresh()
    })
  }

  const isArchived = status === 'archived'

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* ── Top bar (§12.4.1): back link · editable name · publish toggle · save ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <Link href="/admin/crm/sequences" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
          ← Back to Automations
        </Link>
        <div className="min-w-48 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Automation name"
            className="h-8 max-w-xl border-transparent bg-transparent font-medium text-foreground shadow-none focus-visible:border-border"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isArchived ? (
            <Badge variant="outline">Archived</Badge>
          ) : (
            <span className="flex items-center gap-2">
              <Label htmlFor="pub-toggle" className="text-sm text-muted-foreground">
                {status === 'active' ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch id="pub-toggle" checked={status === 'active'} disabled={pending} onCheckedChange={toggleEnabled} />
            </span>
          )}
          <Button size="sm" className="h-8" onClick={saveAll} disabled={pending}>
            Save
          </Button>
        </div>
      </div>

      {note ? (
        <div className="border-b border-border px-4 py-2">
          <Alert variant={note.tone === 'err' ? 'destructive' : 'default'} className="py-2">
            <AlertDescription className="whitespace-pre-wrap text-sm">{note.text}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {funnelUnreadable ? (
        <div className="border-b border-border px-4 py-2">
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">Step analytics could not be read right now.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {/* ── Three columns (§12.4.1 layout) ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[250px_minmax(0,1fr)_340px]">
        <EditorPalette
          dragging={dragging}
          onDragChange={setDragging}
          onAddChannel={appendChannel}
          onAddCondition={appendCondition}
          onTimeDelay={focusDelay}
          onAddTrigger={addTrigger}
        />
        <EditorCanvas
          steps={steps}
          triggers={triggers}
          selection={selection}
          onSelect={setSelection}
          dragging={dragging}
          onDropAt={handleDropAt}
          onAppendChannel={appendChannel}
          onAppendCondition={appendCondition}
          funnel={funnel}
          lookups={lookups}
        />
        <div className="min-h-0 overflow-y-auto border-t border-border bg-background no-scrollbar lg:border-l lg:border-t-0">
          <StepConfigPanel
            selection={selection}
            steps={steps}
            triggers={triggers}
            options={options}
            disabled={pending}
            description={description}
            stopOnReply={stopOnReply}
            status={status}
            delayFocusToken={delayFocusToken}
            onPatchStep={patchStep}
            onPatchCondition={patchCondition}
            onRemoveStep={removeStep}
            onTriggersChange={setTriggers}
            onDescriptionChange={setDescription}
            onStopOnReplyChange={setStopOnReply}
          />
        </div>
      </div>
    </div>
  )
}
