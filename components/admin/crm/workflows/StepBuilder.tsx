'use client'

/**
 * StepBuilder — the ordered step builder for one workflow (Wave 6 authoring).
 *
 * v1: linear, reorderable step cards (email / sms / task / tag).
 * v2 additions:
 *   - Trigger panel above the steps (reads/writes the `triggers` column):
 *     "+ Add Trigger" → type selector + optional value → persists as pills.
 *   - New step channels: change_stage / add_note / reassign / run_automation.
 *   - Conditions step card: field / op / value + collapsible If-True / If-False
 *     sub-step lists (recursive nesting supported in the schema; UI exposes one
 *     level to keep the authoring experience tractable).
 *
 * Save splits into three server calls:
 *   1. saveTriggers (the triggers jsonb — validated by parseSequenceTriggers)
 *   2. saveSteps (the steps jsonb — validated by parseSteps + live templates)
 *   3. saveSettings (name / description / stop-on-reply)
 * Steps validate first; a malformed step never reaches the DB.
 *
 * Design-system only. Token-pure. No raw HTML controls.
 */

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { channelLabel, cumulativeDays } from './step-display'
import {
  EMPTY_STEP,
  EMPTY_CONDITION,
  STEP_CHANNELS,
  SEQUENCE_TRIGGER_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPS,
  isConditionNode,
  type Step,
  type StepChannel,
  type SequenceTrigger,
  type SequenceTriggerType,
  type ConditionNode,
  type AnyStepOrCondition,
  type ConditionField,
  type ConditionOp,
} from '@/lib/crm/sequence-step-schema'

type ActionResult = { ok: true } | { ok: false; error: string }

export type TemplateOption = { key: string; name: string; channel: 'email' | 'sms' }
export type TagOption = { key: string; label: string }
export type StageOption = { key: string; label: string }
export type BrokerOption = { slug: string; label: string }
export type SequenceOption = { id: number; name: string }

export type StepBuilderActions = {
  saveSteps: (steps: AnyStepOrCondition[]) => Promise<ActionResult>
  saveSettings: (input: { name: string; description: string | null; stopOnReply: boolean }) => Promise<ActionResult>
  saveTriggers: (triggers: SequenceTrigger[]) => Promise<ActionResult>
}

export type StepFunnelRow = {
  stepIndex: number
  channel: string | null
  currentlyHere: number
  emailsSent: number | null
}

const TRIGGER_TYPE_LABELS: Record<SequenceTriggerType, string> = {
  tag_added: 'Tag added',
  stage_changed: 'Stage changed',
  source_is: 'Source is',
  deal_stage_changed: 'Deal stage changed',
  inquiry: 'Inquiry submitted',
  property_saved: 'Property saved',
  calendar_date: 'Calendar date',
  appointment: 'Appointment',
}

const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  stage: 'Stage',
  tag: 'Has tag',
  source: 'Source',
}

const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
}

/** Channel labels for v2 channels */
const V2_CHANNEL_LABELS: Partial<Record<StepChannel, string>> = {
  change_stage: 'Change stage',
  add_note: 'Add note',
  reassign: 'Reassign broker',
  run_automation: 'Start another workflow',
}

export function StepBuilder({
  sequenceId,
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
  sequenceId: number
  initialName: string
  initialDescription: string
  initialStopOnReply: boolean
  initialStatus: string
  initialSteps: AnyStepOrCondition[]
  initialTriggers: SequenceTrigger[]
  templates: TemplateOption[]
  tags: TagOption[]
  stages?: StageOption[]
  brokers?: BrokerOption[]
  sequences?: SequenceOption[]
  funnel: StepFunnelRow[]
  funnelUnreadable: boolean
  actions: StepBuilderActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [stopOnReply, setStopOnReply] = useState(initialStopOnReply)
  const [steps, setSteps] = useState<AnyStepOrCondition[]>(initialSteps)
  const [triggers, setTriggers] = useState<SequenceTrigger[]>(initialTriggers)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null)
  const [addTriggerOpen, setAddTriggerOpen] = useState(false)
  const [triggerDraft, setTriggerDraft] = useState<{ type: SequenceTriggerType; value: string }>({
    type: 'tag_added',
    value: '',
  })

  // Only flat (non-condition) steps contribute to cumulative day display.
  const flatStepsForDays = useMemo(
    () => steps.map((s) => (isConditionNode(s) ? { channel: 'condition' as StepChannel, delayDays: 0 } : s as Step)),
    [steps],
  )
  const days = useMemo(() => cumulativeDays(flatStepsForDays), [flatStepsForDays])
  const emailTemplates = useMemo(() => templates.filter((t) => t.channel === 'email'), [templates])
  const smsTemplates = useMemo(() => templates.filter((t) => t.channel === 'sms'), [templates])

  function patchStep(idx: number, patch: Partial<Step>) {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx || isConditionNode(s)) return s
        return { ...s, ...patch }
      }),
    )
  }

  function patchCondition(idx: number, patch: Partial<ConditionNode>) {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx || !isConditionNode(s)) return s
        return { ...s, ...patch }
      }),
    )
  }

  function move(idx: number, dir: -1 | 1) {
    setSteps((prev) => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[idx]
      next[idx] = next[target]
      next[target] = tmp
      return next
    })
  }

  function addStep(channel: StepChannel) {
    setSteps((prev) => [...prev, { ...EMPTY_STEP[channel] }])
    setAddOpen(false)
  }

  function addCondition() {
    setSteps((prev) => [...prev, { ...EMPTY_CONDITION }])
    setAddOpen(false)
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    setDeleteIdx(null)
  }

  function addTrigger() {
    if (!triggerDraft.type) return
    setTriggers((prev) => [
      ...prev,
      { type: triggerDraft.type, value: triggerDraft.value.trim() || undefined },
    ])
    setTriggerDraft({ type: 'tag_added', value: '' })
    setAddTriggerOpen(false)
  }

  function removeTrigger(idx: number) {
    setTriggers((prev) => prev.filter((_, i) => i !== idx))
  }

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function saveAll() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNote({ tone: 'err', text: 'A workflow name is required' })
      return
    }
    setNote(null)
    startTransition(async () => {
      // 1. Triggers
      const triggersResult = await actions.saveTriggers(triggers)
      if (!triggersResult.ok) {
        setNote({ tone: 'err', text: triggersResult.error })
        return
      }
      // 2. Steps (strict validation)
      const stepsResult = await actions.saveSteps(steps)
      if (!stepsResult.ok) {
        setNote({ tone: 'err', text: stepsResult.error })
        return
      }
      // 3. Settings
      const settingsResult = await actions.saveSettings({
        name: trimmedName,
        description: description.trim() || null,
        stopOnReply,
      })
      if (!settingsResult.ok) {
        setNote({ tone: 'err', text: settingsResult.error })
        return
      }
      setNote({ tone: 'ok', text: 'Workflow saved.' })
      router.refresh()
    })
  }

  const funnelByIndex = useMemo(() => {
    const map = new Map<number, StepFunnelRow>()
    for (const r of funnel) map.set(r.stepIndex, r)
    return map
  }, [funnel])

  return (
    <div className="space-y-6">
      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
        </Alert>
      ) : null}

      {/* Header — identity + reply behavior */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sb-name">Workflow name</Label>
              <Input id="sb-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <Label htmlFor="sb-stop" className="text-sm font-medium">
                    Stop on reply
                  </Label>
                  <p className="text-xs text-muted-foreground">Pause a person the moment they reply.</p>
                </div>
                <Switch id="sb-stop" checked={stopOnReply} disabled={pending} onCheckedChange={setStopOnReply} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-desc">Description (optional)</Label>
            <Textarea
              id="sb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Status: {initialStatus === 'active' ? 'Active' : initialStatus === 'archived' ? 'Archived' : 'Paused'}.
            Activate or pause from the workflow list.
          </p>
        </CardContent>
      </Card>

      {/* Triggers panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Triggers</h2>
            <p className="text-xs text-muted-foreground">Events that auto-start this workflow for a person.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddTriggerOpen(true)} disabled={pending}>
            Add trigger
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {triggers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No triggers — this workflow starts only when a broker manually enrolls someone.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {triggers.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                    <span className="font-medium">{TRIGGER_TYPE_LABELS[t.type] ?? t.type}</span>
                    {t.value ? (
                      <span className="text-muted-foreground">: {t.value}</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove trigger ${i + 1}`}
                      className="ml-1 h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => removeTrigger(i)}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Steps</h2>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={pending}>
            Add step
          </Button>
        </div>

        {steps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No steps yet. Add the first step to build this workflow.
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, idx) => {
              const fr = funnelByIndex.get(idx)
              const isCondition = isConditionNode(step)
              return (
                <li key={idx}>
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="tabular-nums">
                            Day {days[idx]}
                          </Badge>
                          <Badge variant={isCondition ? 'outline' : 'outline'}>
                            {isCondition ? 'Condition (IF/ELSE)' : channelLabel((step as Step).channel)}
                          </Badge>
                          {fr && !isCondition ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {fr.currentlyHere} here
                              {(step as Step).channel === 'email' && fr.emailsSent != null ? ` · ${fr.emailsSent} sent` : ''}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={pending || idx === 0}
                            aria-label={`Move step ${idx + 1} up`}
                            onClick={() => move(idx, -1)}
                          >
                            <span aria-hidden>↑</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={pending || idx === steps.length - 1}
                            aria-label={`Move step ${idx + 1} down`}
                            onClick={() => move(idx, 1)}
                          >
                            <span aria-hidden>↓</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteIdx(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {isCondition ? (
                        <ConditionEditor
                          idx={idx}
                          node={step as ConditionNode}
                          stages={stages}
                          tags={tags}
                          disabled={pending}
                          onPatch={(patch) => patchCondition(idx, patch)}
                        />
                      ) : (
                        <StepEditor
                          idx={idx}
                          step={step as Step}
                          emailTemplates={emailTemplates}
                          smsTemplates={smsTemplates}
                          tags={tags}
                          stages={stages}
                          brokers={brokers}
                          sequences={sequences}
                          disabled={pending}
                          onPatch={(patch) => patchStep(idx, patch)}
                        />
                      )}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {funnelUnreadable ? (
        <Alert variant="destructive">
          <AlertDescription>Step analytics could not be read right now.</AlertDescription>
        </Alert>
      ) : null}

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => router.push('/admin/crm/sequences')} disabled={pending}>
          Back to workflows
        </Button>
        <Button onClick={saveAll} disabled={pending}>
          Save workflow
        </Button>
      </div>

      {/* Add-step channel chooser */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a step</DialogTitle>
            <DialogDescription>Pick what this step does. You can configure it after adding.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STEP_CHANNELS.map((c) => (
              <Button key={c} variant="outline" className="justify-start" onClick={() => addStep(c)} disabled={pending}>
                {V2_CHANNEL_LABELS[c] ?? channelLabel(c)}
              </Button>
            ))}
            <Button
              variant="outline"
              className="justify-start border-dashed"
              onClick={addCondition}
              disabled={pending}
            >
              IF / ELSE condition
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-step confirm */}
      <Dialog open={deleteIdx != null} onOpenChange={(o) => !pending && !o && setDeleteIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this step?</DialogTitle>
            <DialogDescription>
              The step is removed from the draft. Save the workflow to make it permanent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteIdx(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => deleteIdx != null && removeStep(deleteIdx)}
            >
              Remove step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-trigger dialog */}
      <Dialog open={addTriggerOpen} onOpenChange={(o) => !pending && setAddTriggerOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a trigger</DialogTitle>
            <DialogDescription>
              When this event fires for a person, they are automatically enrolled in this workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trig-type">Event type</Label>
              <Select
                value={triggerDraft.type}
                onValueChange={(v) => setTriggerDraft((d) => ({ ...d, type: v as SequenceTriggerType, value: '' }))}
              >
                <SelectTrigger id="trig-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEQUENCE_TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIGGER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trig-value">
                {triggerDraft.type === 'tag_added'
                  ? 'Tag key'
                  : triggerDraft.type === 'stage_changed'
                    ? 'Stage key'
                    : triggerDraft.type === 'source_is'
                      ? 'Source value'
                      : 'Value (optional)'}
              </Label>
              <Input
                id="trig-value"
                value={triggerDraft.value}
                placeholder="e.g. audience:buyer"
                onChange={(e) => setTriggerDraft((d) => ({ ...d, value: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTriggerOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={addTrigger} disabled={pending}>
              Add trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Condition step editor ──────────────────────────────────────────────────────

function ConditionEditor({
  idx,
  node,
  stages,
  tags,
  disabled,
  onPatch,
}: {
  idx: number
  node: ConditionNode
  stages?: StageOption[]
  tags: TagOption[]
  disabled: boolean
  onPatch: (patch: Partial<ConditionNode>) => void
}) {
  const [showTrue, setShowTrue] = useState(true)
  const [showFalse, setShowFalse] = useState(false)

  function patchTruePath(truePath: AnyStepOrCondition[]) {
    onPatch({ truePath })
  }
  function patchFalsePath(falsePath: AnyStepOrCondition[]) {
    onPatch({ falsePath })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cond-field-${idx}`}>If</Label>
          <Select
            value={node.field}
            disabled={disabled}
            onValueChange={(v) => onPatch({ field: v as ConditionField })}
          >
            <SelectTrigger id={`cond-field-${idx}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((f) => (
                <SelectItem key={f} value={f}>
                  {CONDITION_FIELD_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cond-op-${idx}`}>Operator</Label>
          <Select
            value={node.op}
            disabled={disabled}
            onValueChange={(v) => onPatch({ op: v as ConditionOp })}
          >
            <SelectTrigger id={`cond-op-${idx}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPS.map((o) => (
                <SelectItem key={o} value={o}>
                  {CONDITION_OP_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cond-val-${idx}`}>Value</Label>
          {node.field === 'stage' && stages && stages.length > 0 ? (
            <Select
              value={node.value}
              disabled={disabled}
              onValueChange={(v) => onPatch({ value: v })}
            >
              <SelectTrigger id={`cond-val-${idx}`}>
                <SelectValue placeholder="Choose a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : node.field === 'tag' && tags.length > 0 ? (
            <Select
              value={node.value}
              disabled={disabled}
              onValueChange={(v) => onPatch({ value: v })}
            >
              <SelectTrigger id={`cond-val-${idx}`}>
                <SelectValue placeholder="Choose a tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`cond-val-${idx}`}
              value={node.value}
              disabled={disabled}
              placeholder="Value to match"
              onChange={(e) => onPatch({ value: e.target.value })}
            />
          )}
        </div>
      </div>

      {/* IF-TRUE sub-steps */}
      <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto w-full items-center justify-between px-0 text-sm font-medium text-foreground hover:bg-transparent"
          onClick={() => setShowTrue((v) => !v)}
        >
          <span>IF TRUE — {node.truePath.length} step{node.truePath.length !== 1 ? 's' : ''}</span>
          <span aria-hidden>{showTrue ? '▲' : '▼'}</span>
        </Button>
        {showTrue ? (
          <SubPathEditor
            path={node.truePath}
            disabled={disabled}
            label="True branch"
            onChange={patchTruePath}
          />
        ) : null}
      </div>

      {/* IF-FALSE sub-steps */}
      <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto w-full items-center justify-between px-0 text-sm font-medium text-foreground hover:bg-transparent"
          onClick={() => setShowFalse((v) => !v)}
        >
          <span>IF FALSE (ELSE) — {node.falsePath.length} step{node.falsePath.length !== 1 ? 's' : ''}</span>
          <span aria-hidden>{showFalse ? '▲' : '▼'}</span>
        </Button>
        {showFalse ? (
          <SubPathEditor
            path={node.falsePath}
            disabled={disabled}
            label="False branch"
            onChange={patchFalsePath}
          />
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Steps in the true/false branches run immediately after the condition resolves, with no extra delay.
        After the branch finishes, the workflow continues with the next top-level step.
      </p>
    </div>
  )
}

/** Minimal sub-path editor: add / remove channel steps in a branch. */
function SubPathEditor({
  path,
  disabled,
  label,
  onChange,
}: {
  path: AnyStepOrCondition[]
  disabled: boolean
  label: string
  onChange: (next: AnyStepOrCondition[]) => void
}) {
  function addToPath(channel: StepChannel) {
    onChange([...path, { ...EMPTY_STEP[channel] }])
  }
  function removeFromPath(i: number) {
    onChange(path.filter((_, idx) => idx !== i))
  }
  function patchInPath(i: number, patch: Partial<Step>) {
    onChange(
      path.map((s, idx) => {
        if (idx !== i || isConditionNode(s)) return s
        return { ...s, ...patch }
      }),
    )
  }

  return (
    <div className="space-y-2 pt-1">
      {path.length === 0 ? (
        <p className="text-xs text-muted-foreground">(empty — add steps below)</p>
      ) : (
        path.map((s, i) => {
          if (isConditionNode(s)) {
            return (
              <div key={i} className="flex items-center gap-2 rounded border border-border bg-card p-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">Condition</Badge>
                <span>Nested conditions not editable in this view. Use top-level steps.</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-destructive" disabled={disabled} onClick={() => removeFromPath(i)}>
                  ×
                </Button>
              </div>
            )
          }
          const step = s as Step
          return (
            <div key={i} className="flex items-start gap-2 rounded border border-border bg-card p-2">
              <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">{V2_CHANNEL_LABELS[step.channel] ?? channelLabel(step.channel)}</Badge>
              <div className="min-w-0 flex-1">
                <SubStepInlineEditor step={step} disabled={disabled} onPatch={(p) => patchInPath(i, p)} />
              </div>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 text-destructive" disabled={disabled} onClick={() => removeFromPath(i)}>
                ×
              </Button>
            </div>
          )
        })
      )}
      <Select disabled={disabled} onValueChange={(v) => addToPath(v as StepChannel)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={`+ Add step to ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {STEP_CHANNELS.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {V2_CHANNEL_LABELS[c] ?? channelLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Compact inline step editor for use inside branch sub-paths. */
function SubStepInlineEditor({
  step,
  disabled,
  onPatch,
}: {
  step: Step
  disabled: boolean
  onPatch: (patch: Partial<Step>) => void
}) {
  if (step.channel === 'email' || step.channel === 'sms') {
    return (
      <Input
        className="h-7 text-xs"
        placeholder={step.channel === 'email' ? 'Inline body text…' : 'SMS text…'}
        value={step.body ?? ''}
        disabled={disabled}
        onChange={(e) => onPatch({ body: e.target.value })}
      />
    )
  }
  if (step.channel === 'task') {
    return (
      <Input
        className="h-7 text-xs"
        placeholder="Task name"
        value={step.taskName ?? ''}
        disabled={disabled}
        onChange={(e) => onPatch({ taskName: e.target.value })}
      />
    )
  }
  if (step.channel === 'change_stage' || step.channel === 'add_note' || step.channel === 'reassign' || step.channel === 'run_automation') {
    return (
      <Input
        className="h-7 text-xs"
        placeholder={
          step.channel === 'change_stage' ? 'Stage key'
            : step.channel === 'add_note' ? 'Note text'
            : step.channel === 'reassign' ? 'Broker slug'
            : 'Workflow ID'
        }
        value={step.value ?? ''}
        disabled={disabled}
        onChange={(e) => onPatch({ value: e.target.value })}
      />
    )
  }
  // tag — simplified (add only in branch editor)
  return (
    <Input
      className="h-7 text-xs"
      placeholder="Tag to add (comma-separated)"
      value={(step.addTags ?? []).join(', ')}
      disabled={disabled}
      onChange={(e) => {
        const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
        onPatch({ addTags: tags })
      }}
    />
  )
}

// ── Per-channel step editor ───────────────────────────────────────────────────

function DelayField({
  idx,
  value,
  disabled,
  onChange,
}: {
  idx: number
  value: number | undefined
  disabled: boolean
  onChange: (days: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`delay-${idx}`}>Wait (days before this step)</Label>
      <Input
        id={`delay-${idx}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={String(value ?? 0)}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.max(0, Math.trunc(Number(e.target.value)))
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
    </div>
  )
}

function StepEditor({
  idx,
  step,
  emailTemplates,
  smsTemplates,
  tags,
  stages,
  brokers,
  sequences,
  disabled,
  onPatch,
}: {
  idx: number
  step: Step
  emailTemplates: TemplateOption[]
  smsTemplates: TemplateOption[]
  tags: TagOption[]
  stages?: StageOption[]
  brokers?: BrokerOption[]
  sequences?: SequenceOption[]
  disabled: boolean
  onPatch: (patch: Partial<Step>) => void
}) {
  if (step.channel === 'email' || step.channel === 'sms') {
    const options = step.channel === 'email' ? emailTemplates : smsTemplates
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`tpl-${idx}`}>Template</Label>
          <Select
            value={step.templateKey ?? ''}
            disabled={disabled}
            onValueChange={(v) => onPatch({ templateKey: v, body: undefined })}
          >
            <SelectTrigger id={`tpl-${idx}`}>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No {step.channel} templates
                </SelectItem>
              ) : (
                options.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!step.templateKey ? (
            <p className="text-xs text-muted-foreground">Pick a template before saving.</p>
          ) : null}
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  if (step.channel === 'task') {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`task-${idx}`}>Task name</Label>
          <Input
            id={`task-${idx}`}
            value={step.taskName ?? ''}
            disabled={disabled}
            onChange={(e) => onPatch({ taskName: e.target.value })}
          />
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  if (step.channel === 'tag') {
    return (
      <div className="space-y-3">
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TagMultiselect
            legend="Add tags"
            idx={idx}
            slot="add"
            selected={step.addTags ?? []}
            tags={tags}
            disabled={disabled}
            onChange={(next) => onPatch({ addTags: next })}
          />
          <TagMultiselect
            legend="Remove tags"
            idx={idx}
            slot="remove"
            selected={step.removeTags ?? []}
            tags={tags}
            disabled={disabled}
            onChange={(next) => onPatch({ removeTags: next })}
          />
        </div>
        {(step.addTags?.length ?? 0) + (step.removeTags?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Pick at least one tag to add or remove before saving.</p>
        ) : null}
      </div>
    )
  }

  // ── v2 channels ──────────────────────────────────────────────────────────────

  if (step.channel === 'change_stage') {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`cs-${idx}`}>Move to stage</Label>
          {stages && stages.length > 0 ? (
            <Select
              value={step.value ?? ''}
              disabled={disabled}
              onValueChange={(v) => onPatch({ value: v })}
            >
              <SelectTrigger id={`cs-${idx}`}>
                <SelectValue placeholder="Choose a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`cs-${idx}`}
              value={step.value ?? ''}
              placeholder="Stage key"
              disabled={disabled}
              onChange={(e) => onPatch({ value: e.target.value })}
            />
          )}
          {!step.value?.trim() ? (
            <p className="text-xs text-muted-foreground">A stage is required before saving.</p>
          ) : null}
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  if (step.channel === 'add_note') {
    return (
      <div className="space-y-3">
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
        <div className="space-y-1.5">
          <Label htmlFor={`note-${idx}`}>Note text</Label>
          <Textarea
            id={`note-${idx}`}
            rows={3}
            value={step.value ?? ''}
            disabled={disabled}
            placeholder="Note to add to the contact timeline. Merge tokens like %first_name% are supported."
            onChange={(e) => onPatch({ value: e.target.value })}
          />
          {!step.value?.trim() ? (
            <p className="text-xs text-muted-foreground">Note text is required.</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (step.channel === 'reassign') {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`ra-${idx}`}>Assign to broker</Label>
          {brokers && brokers.length > 0 ? (
            <Select
              value={step.value ?? ''}
              disabled={disabled}
              onValueChange={(v) => onPatch({ value: v })}
            >
              <SelectTrigger id={`ra-${idx}`}>
                <SelectValue placeholder="Choose a broker" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`ra-${idx}`}
              value={step.value ?? ''}
              placeholder="Broker slug (e.g. matt)"
              disabled={disabled}
              onChange={(e) => onPatch({ value: e.target.value })}
            />
          )}
          {!step.value?.trim() ? (
            <p className="text-xs text-muted-foreground">A broker is required.</p>
          ) : null}
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  if (step.channel === 'run_automation') {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`ra2-${idx}`}>Workflow to start</Label>
          {sequences && sequences.length > 0 ? (
            <Select
              value={step.value ?? ''}
              disabled={disabled}
              onValueChange={(v) => onPatch({ value: v })}
            >
              <SelectTrigger id={`ra2-${idx}`}>
                <SelectValue placeholder="Choose a workflow" />
              </SelectTrigger>
              <SelectContent>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`ra2-${idx}`}
              value={step.value ?? ''}
              placeholder="Workflow ID"
              disabled={disabled}
              onChange={(e) => onPatch({ value: e.target.value })}
            />
          )}
          {!step.value?.trim() ? (
            <p className="text-xs text-muted-foreground">A workflow is required.</p>
          ) : null}
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  // Fallback for any unknown channel (future-proof)
  return (
    <p className="text-xs text-muted-foreground">Unsupported channel: {(step as Step).channel}</p>
  )
}

function TagMultiselect({
  legend,
  idx,
  slot,
  selected,
  tags,
  disabled,
  onChange,
}: {
  legend: string
  idx: number
  slot: string
  selected: string[]
  tags: TagOption[]
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  function toggle(key: string, checked: boolean) {
    const set = new Set(selected)
    if (checked) set.add(key)
    else set.delete(key)
    onChange([...set])
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="max-h-48 space-y-1.5 overflow-y-auto no-scrollbar rounded-lg border border-border p-3">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
        ) : (
          tags.map((t) => {
            const id = `tag-${slot}-${idx}-${t.key}`
            return (
              <Label key={t.key} htmlFor={id} className={cn('flex items-center gap-2 text-sm', disabled && 'opacity-60')}>
                <Checkbox
                  id={id}
                  checked={selected.includes(t.key)}
                  disabled={disabled}
                  onCheckedChange={(c) => toggle(t.key, c === true)}
                />
                <span className="min-w-0 truncate text-foreground">{t.label}</span>
              </Label>
            )
          })
        )}
      </div>
    </fieldset>
  )
}
