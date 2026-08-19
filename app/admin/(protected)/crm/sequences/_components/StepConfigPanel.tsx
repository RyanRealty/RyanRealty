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
 *     (unavailable options render disabled/greyed exactly like CRM's
 *     "company office hours" option), and the destructive Delete step control.
 *     The enabled radio in each group reflects what OUR engine actually does
 *     (sends from the assigned broker's mailbox to the primary contact inside
 *     the 07:00–19:00 PT window) — no fake persisted preferences.
 *
 * Admin v2 migration (11F): the shadcn Select/Dialog/Popover/Command/
 * RadioGroup/Button/Input/Textarea/Label/Switch/Badge/Checkbox/Separator stack
 * is replaced with '@/components/admin/v2' primitives:
 *   - the Template combobox (Popover+Command) is hand-built — a Button trigger
 *     + SearchField + an av2-menu__panel results list, click-outside + Escape
 *     close it, matching the pattern already shipped in
 *     crm/tasks/_components/NewTaskDialog.tsx. Its cmdk arrow-key list
 *     navigation is NOT reproduced (click/tap-to-select only), same
 *     flagged loss as that file.
 *   - the two engine-truth radio groups and the tag multiselect checkboxes are
 *     hand-built from native radio/checkbox inputs styled with the `av2-check`
 *     token class (the same class ToolbarCheck wraps) — the v2 barrel has no
 *     Radio/Checkbox primitive yet. Both groups were already non-interactive
 *     in the original (RadioGroup had no onValueChange), so the native inputs
 *     carry a no-op onChange to stay controlled without changing behaviour.
 *   - the destructive delete-step confirmation now uses ConfirmDialog
 *     directly instead of a hand-rolled Dialog.
 *
 * Spec: docs/crm-spec/12-action-plans-and-automations.md §12.4.4 + the
 * pixel reference screens/screen-36.md.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Button,
  ConfirmDialog,
  SearchField,
  TextField,
  ToolbarSelect,
} from '@/components/admin/v2'
import { ChevronsUpDown, Trash2 } from 'lucide-react'
import {
  EMPTY_STEP,
  STEP_CHANNELS,
  isConditionNode,
  type AnyStepOrCondition,
  type ConditionNode,
  type Step,
  type StepChannel,
  type SequenceTrigger,
  type SequenceTriggerType,
} from '@/lib/crm/sequence-step-schema'
import { CHANNEL_CARD_LABELS, type EditorSelection } from './editor-shared'
import { ConditionPanelShell, StepChannelBody } from './step-config-body-bits'
import {
  BranchStepEditor,
  SettingsPanel,
  TriggerPanel,
} from './step-config-bits'

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
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = options.find((t) => t.key === value)
  const filtered = query.trim()
    ? options.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
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
        id={id}
        variant="quiet"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className="w-full font-normal"
        style={{ width: '100%', justifyContent: 'space-between' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate" style={!selected ? { color: 'var(--a-text-2)' } : undefined}>
          {selected ? selected.name : 'Choose a template…'}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" style={{ opacity: 0.5 }} aria-hidden />
      </Button>
      {open ? (
        <div
          className="av2-menu__panel"
          role="listbox"
          aria-label="Templates"
          data-align="start"
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 320, maxHeight: 280, overflowY: 'auto' }}
        >
          <SearchField
            aria-label="Search templates"
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-1"
            style={{ width: '100%', maxWidth: 'none' }}
            autoFocus
          />
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>
              No template found.
            </p>
          ) : (
            filtered.map((t) => (
              <Button
                key={t.key}
                variant="quiet"
                role="option"
                aria-selected={t.key === value}
                className="w-full justify-start font-normal"
                style={{ background: 'transparent', border: 'none' }}
                onClick={() => {
                  onChange(t.key)
                  setOpen(false)
                  setQuery('')
                }}
              >
                {t.name}
              </Button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
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
  const [lastPicked, setLastPicked] = useState<StepChannel | ''>('')
  const badgeStyle = {
    fontSize: 'var(--a-text-xs)',
    color: 'var(--a-text-2)',
    border: '1px solid var(--a-border)',
    borderRadius: 'var(--a-r-sm)',
    padding: '1px 6px',
  } as const
  return (
    <div className="space-y-2 pt-1">
      {path.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          (empty, add steps below)
        </p>
      ) : (
        path.map((s, i) => {
          if (isConditionNode(s)) {
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded p-2 text-xs"
                style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)', color: 'var(--a-text-2)' }}
              >
                <span style={badgeStyle}>Condition</span>
                <span>Nested conditions are not editable here.</span>
                <Button
                  variant="quiet"
                  className="ml-auto h-6"
                  style={{ color: 'var(--a-danger)' }}
                  disabled={disabled}
                  onClick={() => onChange(path.filter((_, idx) => idx !== i))}
                >
                  ×
                </Button>
              </div>
            )
          }
          const step = s as Step
          return (
            <div key={i} className="flex items-start gap-2 rounded p-2" style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)' }}>
              <span className="mt-0.5 shrink-0" style={badgeStyle}>
                {CHANNEL_CARD_LABELS[step.channel]}
              </span>
              <div className="min-w-0 flex-1">
                <BranchStepEditor
                  step={step}
                  disabled={disabled}
                  onPatch={(p) => onChange(path.map((x, idx) => (idx === i && !isConditionNode(x) ? { ...(x as Step), ...p } : x)))}
                />
              </div>
              <Button
                variant="quiet"
                className="h-6 shrink-0"
                style={{ color: 'var(--a-danger)' }}
                disabled={disabled}
                onClick={() => onChange(path.filter((_, idx) => idx !== i))}
              >
                ×
              </Button>
            </div>
          )
        })
      )}
      <ToolbarSelect
        aria-label={`Add step to ${label}`}
        disabled={disabled}
        value={lastPicked}
        style={{ width: '100%', maxWidth: 'none' }}
        onChange={(e) => {
          const v = e.target.value as StepChannel
          if (!v) return
          setLastPicked(v)
          onChange([...path, { ...EMPTY_STEP[v] }])
        }}
      >
        <option value="" disabled>
          {`+ Add step to ${label}`}
        </option>
        {STEP_CHANNELS.map((c) => (
          <option key={c} value={c}>
            {CHANNEL_CARD_LABELS[c]}
          </option>
        ))}
      </ToolbarSelect>
    </div>
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

  // TextField forwards its ref to the underlying <input> (see Button.tsx for
  // why that is not optional), so this focuses the real node through React
  // instead of reaching into the document for it.
  const delayRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (delayFocusToken > 0) delayRef.current?.focus()
  }, [delayFocusToken])

  const emailTemplates = options.templates.filter((t) => t.channel === 'email')
  const smsTemplates = options.templates.filter((t) => t.channel === 'sms')

  // ── Settings (nothing selected) ─────────────────────────────────────────────
  if (selection.kind === 'settings') {
    return (
      <SettingsPanel
        description={description}
        disabled={disabled}
        stopOnReply={stopOnReply}
        status={status}
        onDescriptionChange={onDescriptionChange}
        onStopOnReplyChange={onStopOnReplyChange}
      />
    )
  }

  // ── Trigger config ──────────────────────────────────────────────────────────
  if (selection.kind === 'trigger') {
    return (
      <TriggerPanel
        triggers={triggers}
        options={options}
        disabled={disabled}
        triggerDraft={triggerDraft}
        onDraftChange={setTriggerDraft}
        onTriggersChange={onTriggersChange}
      />
    )
  }

  // ── Step / condition config ─────────────────────────────────────────────────
  const node = steps[selection.idx]
  if (!node) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--a-text-2)' }}>
        Select a step on the canvas.
      </div>
    )
  }

  const deleteBlock = (
    <>
      <div style={{ borderTop: '1px solid var(--a-border)' }} />
      <Button
        variant="quiet"
        className="h-8 px-2"
        style={{ color: 'var(--a-danger)', alignSelf: 'flex-start' }}
        disabled={disabled}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Delete step
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => {
          if (!disabled) setConfirmDelete(false)
        }}
        title="Remove this step?"
        description="The step is removed from the draft. Save the automation to make it permanent."
        confirmLabel="Remove step"
        busy={disabled}
        onConfirm={() => {
          setConfirmDelete(false)
          onRemoveStep(selection.idx)
        }}
      />
    </>
  )

  if (isConditionNode(node)) {
    const cond = node as ConditionNode
    return (
      <ConditionPanelShell
        cond={cond}
        disabled={disabled}
        options={options}
        onFieldChange={(field) => onPatchCondition(selection.idx, { field })}
        onOpChange={(op) => onPatchCondition(selection.idx, { op })}
        onValueChange={(value) => onPatchCondition(selection.idx, { value })}
        trueBranch={
          <BranchPathEditor
            path={cond.truePath}
            label="true branch"
            disabled={disabled}
            options={options}
            onChange={(next) => onPatchCondition(selection.idx, { truePath: next })}
          />
        }
        falseBranch={
          <BranchPathEditor
            path={cond.falsePath}
            label="false branch"
            disabled={disabled}
            options={options}
            onChange={(next) => onPatchCondition(selection.idx, { falsePath: next })}
          />
        }
        deleteBlock={deleteBlock}
      />
    )
  }

  const step = node as Step
  const patch = (p: Partial<Step>) => onPatchStep(selection.idx, p)

  const waitField = (
    <TextField
      ref={delayRef}
      label="Wait (days before this step)"
      name="cfg-wait"
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
  )

  const templatePicker = (
    <TemplatePicker
      id="cfg-template"
      value={step.templateKey}
      options={step.channel === 'email' ? emailTemplates : smsTemplates}
      disabled={disabled}
      onChange={(key) => patch({ templateKey: key, body: undefined })}
    />
  )

  return (
    <StepChannelBody
      step={step}
      disabled={disabled}
      patch={patch}
      options={options}
      waitField={waitField}
      templatePicker={templatePicker}
      deleteBlock={deleteBlock}
    />
  )
}
