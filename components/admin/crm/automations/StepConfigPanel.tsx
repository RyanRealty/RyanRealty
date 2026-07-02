'use client'

/**
 * StepConfigPanel — the §12.4.4 right config panel of the visual automation
 * editor. Populates from the current canvas selection:
 *
 *   - settings  → automation description / stop-on-reply / status note
 *   - trigger   → trigger list + add/remove (type + value pickers)
 *   - step      → the per-channel config form. The Send Email panel carries the
 *     full §12.4.4 anatomy: searchable Template picker, From dropdown,
 *     Recipient Preferences radio group, Delivery Preferences radio group
 *     (unavailable options render disabled/greyed exactly like FUB's
 *     "company office hours" option), and the destructive Delete step control.
 *     The enabled radio in each group reflects what OUR engine actually does
 *     (sends from the assigned broker's mailbox to the primary contact inside
 *     the 07:00–19:00 PT window) — no fake persisted preferences.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.4.4 + the
 * pixel reference screens/screen-36.md.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, Trash2, UserRound } from 'lucide-react'
import {
  EMPTY_STEP,
  CONDITION_FIELDS,
  CONDITION_OPS,
  STEP_CHANNELS,
  isConditionNode,
  type AnyStepOrCondition,
  type ConditionNode,
  type ConditionField,
  type ConditionOp,
  type Step,
  type StepChannel,
  type SequenceTrigger,
  type SequenceTriggerType,
  SEQUENCE_TRIGGER_TYPES,
} from '@/lib/crm/sequence-step-schema'
import { CHANNEL_CARD_LABELS, TRIGGER_TYPE_LABELS, type EditorSelection } from './editor-shared'

export type TemplateOption = { key: string; name: string; channel: 'email' | 'sms' }
export type TagOption = { key: string; label: string }
export type StageOption = { key: string; label: string }
export type BrokerOption = { slug: string; label: string }
export type SequenceOption = { id: number; name: string }

export type PanelOptions = {
  templates: TemplateOption[]
  tags: TagOption[]
  stages: StageOption[]
  brokers: BrokerOption[]
  sequences: SequenceOption[]
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

/** Searchable template picker (§12.4.4 "Template" — searchable combobox). */
function TemplatePicker({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  value: string | undefined
  options: TemplateOption[]
  disabled: boolean
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((t) => t.key === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.name : 'Choose a template…'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search templates…" />
          <CommandList>
            <CommandEmpty>No template found.</CommandEmpty>
            <CommandGroup>
              {options.map((t) => (
                <CommandItem
                  key={t.key}
                  value={t.name}
                  onSelect={() => {
                    onChange(t.key)
                    setOpen(false)
                  }}
                >
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function TagMultiselect({
  legend,
  idPrefix,
  selected,
  tags,
  disabled,
  onChange,
}: {
  legend: string
  idPrefix: string
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
      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2.5 no-scrollbar">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
        ) : (
          tags.map((t) => {
            const id = `${idPrefix}-${t.key}`
            return (
              <Label key={t.key} htmlFor={id} className={cn('flex items-center gap-2 text-sm', disabled && 'opacity-60')}>
                <Checkbox id={id} checked={selected.includes(t.key)} disabled={disabled} onCheckedChange={(c) => toggle(t.key, c === true)} />
                <span className="min-w-0 truncate text-foreground">{t.label}</span>
              </Label>
            )
          })
        )}
      </div>
    </fieldset>
  )
}

/** Compact inline editor for steps inside condition branches. */
function BranchStepEditor({
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
      <Input className="h-7 text-xs" placeholder="Task name" value={step.taskName ?? ''} disabled={disabled} onChange={(e) => onPatch({ taskName: e.target.value })} />
    )
  }
  if (step.channel === 'stop_other_plans') {
    return <span className="text-xs text-muted-foreground">Pauses all other running automations for this contact.</span>
  }
  if (step.channel === 'tag') {
    return (
      <Input
        className="h-7 text-xs"
        placeholder="Tags to add (comma-separated)"
        value={(step.addTags ?? []).join(', ')}
        disabled={disabled}
        onChange={(e) => onPatch({ addTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
      />
    )
  }
  const placeholder =
    step.channel === 'change_stage' ? 'Stage key' : step.channel === 'add_note' ? 'Note text' : step.channel === 'reassign' ? 'Broker slug' : 'Automation ID'
  return <Input className="h-7 text-xs" placeholder={placeholder} value={step.value ?? ''} disabled={disabled} onChange={(e) => onPatch({ value: e.target.value })} />
}

function BranchPathEditor({
  path,
  label,
  disabled,
  options,
  onChange,
}: {
  path: AnyStepOrCondition[]
  label: string
  disabled: boolean
  options: PanelOptions
  onChange: (next: AnyStepOrCondition[]) => void
}) {
  return (
    <div className="space-y-2 pt-1">
      {path.length === 0 ? (
        <p className="text-xs text-muted-foreground">(empty, add steps below)</p>
      ) : (
        path.map((s, i) => {
          if (isConditionNode(s)) {
            return (
              <div key={i} className="flex items-center gap-2 rounded border border-border bg-card p-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">Condition</Badge>
                <span>Nested conditions are not editable here.</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-destructive" disabled={disabled} onClick={() => onChange(path.filter((_, idx) => idx !== i))}>
                  ×
                </Button>
              </div>
            )
          }
          const step = s as Step
          return (
            <div key={i} className="flex items-start gap-2 rounded border border-border bg-card p-2">
              <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">{CHANNEL_CARD_LABELS[step.channel]}</Badge>
              <div className="min-w-0 flex-1">
                <BranchStepEditor
                  step={step}
                  disabled={disabled}
                  onPatch={(p) => onChange(path.map((x, idx) => (idx === i && !isConditionNode(x) ? { ...(x as Step), ...p } : x)))}
                />
              </div>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 text-destructive" disabled={disabled} onClick={() => onChange(path.filter((_, idx) => idx !== i))}>
                ×
              </Button>
            </div>
          )
        })
      )}
      <Select disabled={disabled} onValueChange={(v) => onChange([...path, { ...EMPTY_STEP[v as StepChannel] }])}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={`+ Add step to ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {STEP_CHANNELS.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {CHANNEL_CARD_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Static engine-truth radio group. The enabled option reflects what the engine
 *  actually does; unavailable options render disabled/greyed (§12.4.4 pattern —
 *  same treatment FUB gives "Send during company office hours"). */
function EngineTruthRadios({
  legend,
  activeValue,
  items,
  footnote,
}: {
  legend: string
  activeValue: string
  items: Array<{ value: string; label: string; available: boolean }>
  footnote: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <RadioGroup value={activeValue} className="gap-1.5">
        {items.map((it) => (
          <Label
            key={it.value}
            htmlFor={`${legend}-${it.value}`}
            className={cn('flex items-center gap-2 text-sm font-normal', !it.available && 'cursor-not-allowed text-muted-foreground opacity-50')}
          >
            <RadioGroupItem id={`${legend}-${it.value}`} value={it.value} disabled={!it.available} />
            {it.label}
          </Label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">{footnote}</p>
    </fieldset>
  )
}

export function StepConfigPanel({
  selection,
  steps,
  triggers,
  options,
  disabled,
  description,
  stopOnReply,
  status,
  delayFocusToken,
  onPatchStep,
  onPatchCondition,
  onRemoveStep,
  onTriggersChange,
  onDescriptionChange,
  onStopOnReplyChange,
}: {
  selection: EditorSelection
  steps: AnyStepOrCondition[]
  triggers: SequenceTrigger[]
  options: PanelOptions
  disabled: boolean
  description: string
  stopOnReply: boolean
  status: string
  /** Increment to focus the Wait field of the selected step (palette Time Delay). */
  delayFocusToken: number
  onPatchStep: (idx: number, patch: Partial<Step>) => void
  onPatchCondition: (idx: number, patch: Partial<ConditionNode>) => void
  onRemoveStep: (idx: number) => void
  onTriggersChange: (next: SequenceTrigger[]) => void
  onDescriptionChange: (v: string) => void
  onStopOnReplyChange: (v: boolean) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [triggerDraft, setTriggerDraft] = useState<{ type: SequenceTriggerType; value: string }>({ type: 'tag_added', value: '' })
  const delayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (delayFocusToken > 0) delayRef.current?.focus()
  }, [delayFocusToken])

  const emailTemplates = options.templates.filter((t) => t.channel === 'email')
  const smsTemplates = options.templates.filter((t) => t.channel === 'sms')

  // ── Settings (nothing selected) ─────────────────────────────────────────────
  if (selection.kind === 'settings') {
    return (
      <div className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-foreground">Automation settings</h2>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-desc">Description (optional)</Label>
          <Textarea id="cfg-desc" rows={3} value={description} disabled={disabled} onChange={(e) => onDescriptionChange(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="min-w-0">
            <Label htmlFor="cfg-stop" className="text-sm font-medium">
              Stop on reply
            </Label>
            <p className="text-xs text-muted-foreground">Pause a person the moment they reply.</p>
          </div>
          <Switch id="cfg-stop" checked={stopOnReply} disabled={disabled} onCheckedChange={onStopOnReplyChange} />
        </div>
        <p className="text-xs text-muted-foreground">
          Status: {status === 'active' ? 'Enabled' : status === 'archived' ? 'Archived' : 'Disabled'}. Use the toggle in
          the top bar. Click the trigger card or a step card to configure it here.
        </p>
      </div>
    )
  }

  // ── Trigger config ──────────────────────────────────────────────────────────
  if (selection.kind === 'trigger') {
    const valuePicker = () => {
      if (triggerDraft.type === 'tag_added' && options.tags.length) {
        return (
          <Select value={triggerDraft.value} disabled={disabled} onValueChange={(v) => setTriggerDraft((d) => ({ ...d, value: v }))}>
            <SelectTrigger id="trig-value"><SelectValue placeholder="Choose a tag" /></SelectTrigger>
            <SelectContent>
              {options.tags.map((t) => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      if (triggerDraft.type === 'stage_changed' && options.stages.length) {
        return (
          <Select value={triggerDraft.value} disabled={disabled} onValueChange={(v) => setTriggerDraft((d) => ({ ...d, value: v }))}>
            <SelectTrigger id="trig-value"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
            <SelectContent>
              {options.stages.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      return (
        <Input
          id="trig-value"
          value={triggerDraft.value}
          placeholder={triggerDraft.type === 'source_is' ? 'Source value' : 'Value (optional)'}
          disabled={disabled}
          onChange={(e) => setTriggerDraft((d) => ({ ...d, value: e.target.value }))}
        />
      )
    }
    return (
      <div className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-foreground">Trigger</h2>
        <p className="text-xs text-muted-foreground">
          Events that auto-start this automation. Any one matching trigger fires it (OR logic). With no triggers it
          starts only manually.
        </p>
        {triggers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            No triggers yet — manual enrollment only.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {triggers.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                <span className="font-medium">{TRIGGER_TYPE_LABELS[t.type] ?? t.type}</span>
                {t.value ? <span className="text-muted-foreground">: {t.value}</span> : null}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove trigger ${i + 1}`}
                  className="ml-1 h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                  disabled={disabled}
                  onClick={() => onTriggersChange(triggers.filter((_, idx) => idx !== i))}
                >
                  ×
                </Button>
              </span>
            ))}
          </div>
        )}
        <Separator />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="trig-type">Event type</Label>
            <Select
              value={triggerDraft.type}
              disabled={disabled}
              onValueChange={(v) => setTriggerDraft({ type: v as SequenceTriggerType, value: '' })}
            >
              <SelectTrigger id="trig-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEQUENCE_TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TRIGGER_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trig-value">
              {triggerDraft.type === 'tag_added' ? 'Tag' : triggerDraft.type === 'stage_changed' ? 'Stage' : 'Value'}
            </Label>
            {valuePicker()}
          </div>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              onTriggersChange([...triggers, { type: triggerDraft.type, value: triggerDraft.value.trim() || undefined }])
              setTriggerDraft({ type: 'tag_added', value: '' })
            }}
          >
            Add trigger
          </Button>
        </div>
      </div>
    )
  }

  // ── Step / condition config ─────────────────────────────────────────────────
  const node = steps[selection.idx]
  if (!node) {
    return <div className="p-4 text-sm text-muted-foreground">Select a step on the canvas.</div>
  }

  const deleteBlock = (
    <>
      <Separator />
      <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive" disabled={disabled} onClick={() => setConfirmDelete(true)}>
        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Delete step
      </Button>
      <Dialog open={confirmDelete} onOpenChange={(o) => !disabled && setConfirmDelete(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this step?</DialogTitle>
            <DialogDescription>The step is removed from the draft. Save the automation to make it permanent.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={disabled}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                setConfirmDelete(false)
                onRemoveStep(selection.idx)
              }}
            >
              Remove step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (isConditionNode(node)) {
    const cond = node as ConditionNode
    return (
      <div className="space-y-4 p-4">
        <h2 className="text-sm font-semibold text-foreground">Condition (IF / ELSE)</h2>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cond-field">If</Label>
            <Select value={cond.field} disabled={disabled} onValueChange={(v) => onPatchCondition(selection.idx, { field: v as ConditionField })}>
              <SelectTrigger id="cond-field"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cond-op">Operator</Label>
            <Select value={cond.op} disabled={disabled} onValueChange={(v) => onPatchCondition(selection.idx, { op: v as ConditionOp })}>
              <SelectTrigger id="cond-op"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_OPS.map((o) => (
                  <SelectItem key={o} value={o}>{CONDITION_OP_LABELS[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cond-val">Value</Label>
            {cond.field === 'stage' && options.stages.length ? (
              <Select value={cond.value} disabled={disabled} onValueChange={(v) => onPatchCondition(selection.idx, { value: v })}>
                <SelectTrigger id="cond-val"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                <SelectContent>
                  {options.stages.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : cond.field === 'tag' && options.tags.length ? (
              <Select value={cond.value} disabled={disabled} onValueChange={(v) => onPatchCondition(selection.idx, { value: v })}>
                <SelectTrigger id="cond-val"><SelectValue placeholder="Choose a tag" /></SelectTrigger>
                <SelectContent>
                  {options.tags.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="cond-val" value={cond.value} disabled={disabled} placeholder="Value to match" onChange={(e) => onPatchCondition(selection.idx, { value: e.target.value })} />
            )}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-sm font-medium text-foreground">IF TRUE ({cond.truePath.length})</p>
          <BranchPathEditor path={cond.truePath} label="true branch" disabled={disabled} options={options} onChange={(next) => onPatchCondition(selection.idx, { truePath: next })} />
        </div>
        <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
          <p className="text-sm font-medium text-foreground">IF FALSE / ELSE ({cond.falsePath.length})</p>
          <BranchPathEditor path={cond.falsePath} label="false branch" disabled={disabled} options={options} onChange={(next) => onPatchCondition(selection.idx, { falsePath: next })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Branch steps run immediately after the condition resolves. The automation then continues with the next
          top-level step.
        </p>
        {deleteBlock}
      </div>
    )
  }

  const step = node as Step
  const patch = (p: Partial<Step>) => onPatchStep(selection.idx, p)

  const waitField = (
    <div className="space-y-1.5">
      <Label htmlFor="cfg-wait">Wait (days before this step)</Label>
      <Input
        id="cfg-wait"
        ref={delayRef}
        type="number"
        min={0}
        inputMode="numeric"
        value={String(step.delayDays ?? 0)}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.max(0, Math.trunc(Number(e.target.value)))
          patch({ delayDays: Number.isFinite(n) ? n : 0 })
        }}
      />
    </div>
  )

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-sm font-semibold text-foreground">{CHANNEL_CARD_LABELS[step.channel]}</h2>

      {step.channel === 'email' || step.channel === 'sms' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-template">Template</Label>
            <TemplatePicker
              id="cfg-template"
              value={step.templateKey}
              options={step.channel === 'email' ? emailTemplates : smsTemplates}
              disabled={disabled}
              onChange={(key) => patch({ templateKey: key, body: undefined })}
            />
            {step.templateKey ? (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" disabled={disabled} onClick={() => patch({ templateKey: undefined })}>
                Clear template and write inline instead
              </Button>
            ) : (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="cfg-body" className="text-xs text-muted-foreground">
                  Or write an inline {step.channel === 'email' ? 'email body' : 'text message'}
                </Label>
                <Textarea id="cfg-body" rows={3} value={step.body ?? ''} disabled={disabled} onChange={(e) => patch({ body: e.target.value })} />
                {!step.body?.trim() ? <p className="text-xs text-muted-foreground">Pick a template or write a message before saving.</p> : null}
              </div>
            )}
          </div>

          {step.channel === 'email' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-from">From</Label>
                <Select value="assigned_broker" disabled>
                  <SelectTrigger id="cfg-from">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned_broker">Broker assigned to the contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <EngineTruthRadios
                legend="Recipient Preferences"
                activeValue="primary"
                items={[
                  { value: 'primary', label: 'Send to primary contact only', available: true },
                  { value: 'relationships', label: 'Send to contact and all relationships', available: false },
                  { value: 'agent', label: 'Send to assigned agent', available: false },
                ]}
                footnote="The engine sends to the contact's primary email address."
              />
              <EngineTruthRadios
                legend="Delivery Preferences"
                activeValue="window"
                items={[
                  { value: 'window', label: 'Send between 7:00 am and 7:00 pm PT', available: true },
                  { value: 'immediate', label: 'Send immediately', available: false },
                  { value: 'office_hours', label: 'Send during company office hours', available: false },
                  { value: 'custom', label: 'Send at custom time', available: false },
                ]}
                footnote="Steps due outside the window queue for the next 7:00 am PT send window. Suppressed and unsubscribed contacts are never sent."
              />
            </>
          ) : (
            <p className="rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
              Texts send from the assigned broker's number, honor the 8:00 am – 9:00 pm quiet hours, and skip opted-out
              contacts.
            </p>
          )}
          {waitField}
        </>
      ) : null}

      {step.channel === 'task' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-task">Task name</Label>
            <Input id="cfg-task" value={step.taskName ?? ''} disabled={disabled} onChange={(e) => patch({ taskName: e.target.value })} />
            {!step.taskName?.trim() ? <p className="text-xs text-muted-foreground">A task name is required.</p> : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'tag' ? (
        <>
          <TagMultiselect legend="Add tags" idPrefix="cfg-add" selected={step.addTags ?? []} tags={options.tags} disabled={disabled} onChange={(next) => patch({ addTags: next })} />
          <TagMultiselect legend="Remove tags" idPrefix="cfg-rem" selected={step.removeTags ?? []} tags={options.tags} disabled={disabled} onChange={(next) => patch({ removeTags: next })} />
          {(step.addTags?.length ?? 0) + (step.removeTags?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Pick at least one tag to add or remove before saving.</p>
          ) : null}
          {waitField}
        </>
      ) : null}

      {step.channel === 'change_stage' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-stage">Move to stage</Label>
            <Select value={step.value ?? ''} disabled={disabled} onValueChange={(v) => patch({ value: v })}>
              <SelectTrigger id="cfg-stage"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
              <SelectContent>
                {options.stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!step.value?.trim() ? <p className="text-xs text-muted-foreground">A stage is required before saving.</p> : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'add_note' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-note">Note text</Label>
            <Textarea
              id="cfg-note"
              rows={3}
              value={step.value ?? ''}
              disabled={disabled}
              placeholder="Note to add to the contact timeline. Merge tokens like %first_name% are supported."
              onChange={(e) => patch({ value: e.target.value })}
            />
            {!step.value?.trim() ? <p className="text-xs text-muted-foreground">Note text is required.</p> : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'reassign' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-broker">Assign to broker</Label>
            <Select value={step.value ?? ''} disabled={disabled} onValueChange={(v) => patch({ value: v })}>
              <SelectTrigger id="cfg-broker"><SelectValue placeholder="Choose a broker" /></SelectTrigger>
              <SelectContent>
                {options.brokers.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!step.value?.trim() ? <p className="text-xs text-muted-foreground">A broker is required.</p> : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'run_automation' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-run">Automation to start</Label>
            <Select value={step.value ?? ''} disabled={disabled} onValueChange={(v) => patch({ value: v })}>
              <SelectTrigger id="cfg-run"><SelectValue placeholder="Choose an automation" /></SelectTrigger>
              <SelectContent>
                {options.sequences.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!step.value?.trim() ? <p className="text-xs text-muted-foreground">An automation is required. Only active automations are listed.</p> : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'stop_other_plans' ? (
        <>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-sm font-medium text-foreground">Pause all other running automations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When this step executes, every other running enrollment for this contact is paused. Use it as a guard so
              two drip sequences never compete for the same person. This automation continues normally.
            </p>
          </div>
          {waitField}
        </>
      ) : null}

      {deleteBlock}
    </div>
  )
}
