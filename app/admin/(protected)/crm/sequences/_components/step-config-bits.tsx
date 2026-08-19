'use client'

/**
 * step-config-bits — stateless presentation extracted from StepConfigPanel,
 * in 11F so that file stays under the 600-LOC budget (ci:file-size-budget).
 * Splitting the file is the fix the gate asks for; re-baselining a
 * ~1055-line component is not.
 *
 * Every piece here is driven entirely by props — no local state, no direct
 * server-action calls. Widgets that DO own state (TemplatePicker, the
 * Template combobox; BranchPathEditor, the condition-branch step list) stay
 * in StepConfigPanel.tsx and are handed down to these components as
 * pre-rendered ReactNode props (`templatePicker`, `trueBranch`,
 * `falseBranch`) — that keeps this file free of any cross-file circular
 * import while still moving the surrounding layout out.
 */
import {
  Button,
  SearchField,
  SectionHead,
  SelectField,
  Switch,
  TextAreaField,
  TextField,
  ToolbarCheck,
  ToolbarRadio,
} from '@/components/admin/v2'
import {
  SEQUENCE_TRIGGER_TYPES,
  type Step,
  type SequenceTrigger,
  type SequenceTriggerType,
} from '@/lib/crm/sequence-step-schema'
import { TRIGGER_TYPE_LABELS } from './editor-shared'
import type { PanelOptions } from './StepConfigPanel'

export function TagMultiselect({
  legend,
  selected,
  tags,
  disabled,
  onChange,
}: {
  legend: string
  selected: string[]
  tags: PanelOptions['tags']
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
      <legend className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>
        {legend}
      </legend>
      <div
        className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg p-2.5 no-scrollbar"
        style={{ border: '1px solid var(--a-border)' }}
      >
        {tags.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
            No tags available.
          </p>
        ) : (
          tags.map((t) => (
            <ToolbarCheck
              key={t.key}
              label={
                <span className="min-w-0 truncate" style={{ color: 'var(--a-text)' }}>
                  {t.label}
                </span>
              }
              labelStyle={disabled ? { opacity: 0.6 } : undefined}
              checked={selected.includes(t.key)}
              disabled={disabled}
              onChange={(e) => toggle(t.key, e.target.checked)}
            />
          ))
        )}
      </div>
    </fieldset>
  )
}

/** Compact inline editor for steps inside condition branches. */
export function BranchStepEditor({
  step,
  disabled,
  onPatch,
}: {
  step: Step
  disabled: boolean
  onPatch: (patch: Partial<Step>) => void
}) {
  const smallFieldStyle = { width: '100%', maxWidth: 'none', height: 28, minHeight: 28 } as const
  if (step.channel === 'email' || step.channel === 'sms') {
    const placeholder = step.channel === 'email' ? 'Inline body text…' : 'SMS text…'
    return (
      <SearchField
        type="text"
        aria-label={placeholder}
        className="text-xs"
        style={smallFieldStyle}
        placeholder={placeholder}
        value={step.body ?? ''}
        disabled={disabled}
        onChange={(e) => onPatch({ body: e.target.value })}
      />
    )
  }
  if (step.channel === 'task') {
    return (
      <SearchField
        type="text"
        aria-label="Task name"
        className="text-xs"
        style={smallFieldStyle}
        placeholder="Task name"
        value={step.taskName ?? ''}
        disabled={disabled}
        onChange={(e) => onPatch({ taskName: e.target.value })}
      />
    )
  }
  if (step.channel === 'stop_other_plans') {
    return (
      <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>
        Pauses all other running automations for this contact.
      </span>
    )
  }
  if (step.channel === 'tag') {
    return (
      <SearchField
        type="text"
        aria-label="Tags to add"
        className="text-xs"
        style={smallFieldStyle}
        placeholder="Tags to add (comma-separated)"
        value={(step.addTags ?? []).join(', ')}
        disabled={disabled}
        onChange={(e) => onPatch({ addTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
      />
    )
  }
  const placeholder =
    step.channel === 'change_stage' ? 'Stage key' : step.channel === 'add_note' ? 'Note text' : step.channel === 'reassign' ? 'Broker slug' : 'Automation ID'
  return (
    <SearchField
      type="text"
      aria-label={placeholder}
      className="text-xs"
      style={smallFieldStyle}
      placeholder={placeholder}
      value={step.value ?? ''}
      disabled={disabled}
      onChange={(e) => onPatch({ value: e.target.value })}
    />
  )
}

/** Static engine-truth radio group. The enabled option reflects what the engine
 *  actually does; unavailable options render disabled/greyed (§12.4.4 pattern —
 *  same treatment CRM gives "Send during company office hours"). Hand-built
 *  from native radios (no v2 Radio primitive exists yet) reusing the
 *  `av2-check` token class. The original RadioGroup had no onValueChange
 *  either — it was already a read-only display of engine truth — so the
 *  native input carries a no-op onChange to stay controlled without adding
 *  interactivity that was never there. */
export function EngineTruthRadios({
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
      <legend className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>
        {legend}
      </legend>
      <div role="radiogroup" aria-label={legend} className="space-y-1.5">
        {items.map((it) => (
          <ToolbarRadio
            key={it.value}
            label={it.label}
            labelStyle={!it.available ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
            name={legend}
            checked={activeValue === it.value}
            disabled={!it.available}
            onChange={() => {}}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
        {footnote}
      </p>
    </fieldset>
  )
}

// ── Settings panel (nothing selected) — pure props, no state ───────────────────

export function SettingsPanel({
  description,
  disabled,
  stopOnReply,
  status,
  onDescriptionChange,
  onStopOnReplyChange,
}: {
  description: string
  disabled: boolean
  stopOnReply: boolean
  status: string
  onDescriptionChange: (v: string) => void
  onStopOnReplyChange: (v: boolean) => void
}) {
  return (
    <div className="space-y-4 p-4">
      <SectionHead>Automation settings</SectionHead>
      <TextAreaField
        label="Description (optional)"
        rows={3}
        value={description}
        disabled={disabled}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ border: '1px solid var(--a-border)' }}>
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--a-text)', margin: 0 }}>
            Stop on reply
          </p>
          <p className="text-xs" style={{ color: 'var(--a-text-2)', margin: 0 }}>
            Pause a person the moment they reply.
          </p>
        </div>
        <Switch
          label="Stop on reply"
          labelHidden
          checked={stopOnReply}
          disabled={disabled}
          onChange={(e) => onStopOnReplyChange(e.target.checked)}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
        Status: {status === 'active' ? 'Enabled' : status === 'archived' ? 'Archived' : 'Disabled'}. Use the toggle in
        the top bar. Click the trigger card or a step card to configure it here.
      </p>
    </div>
  )
}

// ── Trigger panel — the triggerDraft state stays owned by StepConfigPanel and
// is passed down + patched via onDraftChange, so this stays hook-free ───────────

export function TriggerPanel({
  triggers,
  options,
  disabled,
  triggerDraft,
  onDraftChange,
  onTriggersChange,
}: {
  triggers: SequenceTrigger[]
  options: PanelOptions
  disabled: boolean
  triggerDraft: { type: SequenceTriggerType; value: string }
  onDraftChange: (next: { type: SequenceTriggerType; value: string }) => void
  onTriggersChange: (next: SequenceTrigger[]) => void
}) {
  const triggerValueLabel = triggerDraft.type === 'tag_added' ? 'Tag' : triggerDraft.type === 'stage_changed' ? 'Stage' : 'Value'
  const valuePicker = () => {
    if (triggerDraft.type === 'tag_added' && options.tags.length) {
      return (
        <SelectField
          label={triggerValueLabel}
          value={triggerDraft.value}
          disabled={disabled}
          onChange={(e) => onDraftChange({ ...triggerDraft, value: e.target.value })}
        >
          <option value="" disabled>
            Choose a tag
          </option>
          {options.tags.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </SelectField>
      )
    }
    if (triggerDraft.type === 'stage_changed' && options.stages.length) {
      return (
        <SelectField
          label={triggerValueLabel}
          value={triggerDraft.value}
          disabled={disabled}
          onChange={(e) => onDraftChange({ ...triggerDraft, value: e.target.value })}
        >
          <option value="" disabled>
            Choose a stage
          </option>
          {options.stages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
      )
    }
    return (
      <TextField
        label={triggerValueLabel}
        value={triggerDraft.value}
        placeholder={triggerDraft.type === 'source_is' ? 'Source value' : 'Value (optional)'}
        disabled={disabled}
        onChange={(e) => onDraftChange({ ...triggerDraft, value: e.target.value })}
      />
    )
  }
  return (
    <div className="space-y-4 p-4">
      <SectionHead>Trigger</SectionHead>
      <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
        Events that auto-start this automation. Any one matching trigger fires it (OR logic). With no triggers it
        starts only manually.
      </p>
      {triggers.length === 0 ? (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px dashed var(--a-border)', color: 'var(--a-text-2)' }}>
          No triggers yet — manual enrollment only.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {triggers.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-sm"
              style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)', borderRadius: 'var(--a-r-sm)' }}
            >
              <span className="font-medium" style={{ color: 'var(--a-text)' }}>
                {TRIGGER_TYPE_LABELS[t.type] ?? t.type}
              </span>
              {t.value ? <span style={{ color: 'var(--a-text-2)' }}>: {t.value}</span> : null}
              <Button
                variant="quiet"
                aria-label={`Remove trigger ${i + 1}`}
                className="ml-1 h-5 w-5 p-0"
                style={{ color: 'var(--a-text-2)' }}
                disabled={disabled}
                onClick={() => onTriggersChange(triggers.filter((_, idx) => idx !== i))}
              >
                ×
              </Button>
            </span>
          ))}
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--a-border)' }} />
      <div className="space-y-3">
        <SelectField
          label="Event type"
          value={triggerDraft.type}
          disabled={disabled}
          onChange={(e) => onDraftChange({ type: e.target.value as SequenceTriggerType, value: '' })}
        >
          {SEQUENCE_TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRIGGER_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        {valuePicker()}
        <Button
          disabled={disabled}
          onClick={() => {
            onTriggersChange([...triggers, { type: triggerDraft.type, value: triggerDraft.value.trim() || undefined }])
            onDraftChange({ type: 'tag_added', value: '' })
          }}
        >
          Add trigger
        </Button>
      </div>
    </div>
  )
}

