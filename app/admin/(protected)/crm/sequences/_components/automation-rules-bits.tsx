'use client'

/**
 * automation-rules-bits — stateless value-picker controls for
 * AutomationRulesManager, extracted in 11F so that file stays under the
 * 600-LOC budget (ci:file-size-budget). Splitting the file is the fix the
 * gate asks for; re-baselining a ~700-line component is not.
 *
 * These are pure, props-driven controls with no local state — the trigger
 * type / action type switch lives in the parent's form state, passed down
 * via `form` + `setForm`.
 */
import type { Dispatch, SetStateAction } from 'react'
import { SelectField, TextField } from '@/components/admin/v2'

export type SequenceOption = { id: number; name: string }
export type KeyLabelOption = { key: string; label: string }
export type BrokerOption = { slug: string; label: string }

export type FormState = {
  name: string
  triggerType: string
  triggerValue: string
  actionType: string
  actionValue: string
}

export function TriggerValueControl({
  form,
  tags,
  stages,
  setForm,
  disabled,
}: {
  form: FormState
  tags: KeyLabelOption[]
  stages: KeyLabelOption[]
  setForm: Dispatch<SetStateAction<FormState>>
  disabled: boolean
}) {
  if (form.triggerType === 'tag_added') {
    return (
      <KeyPicker
        label="Trigger value"
        placeholder="Choose a tag"
        value={form.triggerValue}
        options={tags}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, triggerValue: v }))}
      />
    )
  }
  if (form.triggerType === 'stage_changed') {
    return (
      <KeyPicker
        label="Trigger value"
        placeholder="Choose a stage"
        value={form.triggerValue}
        options={stages}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, triggerValue: v }))}
      />
    )
  }
  if (form.triggerType === 'inactivity') {
    return (
      <TextField
        label="Trigger value"
        type="number"
        min={1}
        inputMode="numeric"
        placeholder="Days"
        value={form.triggerValue}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, triggerValue: e.target.value }))}
      />
    )
  }
  // source_is (free text)
  return (
    <TextField
      label="Trigger value"
      placeholder="Source value"
      value={form.triggerValue}
      disabled={disabled}
      onChange={(e) => setForm((f) => ({ ...f, triggerValue: e.target.value }))}
    />
  )
}

export function ActionValueControl({
  form,
  sequences,
  tags,
  stages,
  brokers,
  setForm,
  disabled,
}: {
  form: FormState
  sequences: SequenceOption[]
  tags: KeyLabelOption[]
  stages: KeyLabelOption[]
  brokers: BrokerOption[]
  setForm: Dispatch<SetStateAction<FormState>>
  disabled: boolean
}) {
  if (form.actionType === 'enroll_sequence') {
    return (
      <SelectField
        label="Action target"
        value={form.actionValue}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, actionValue: e.target.value }))}
      >
        <option value="" disabled>
          Choose a workflow
        </option>
        {sequences.length === 0 ? (
          <option value="__none__" disabled>
            No workflows
          </option>
        ) : (
          sequences.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))
        )}
      </SelectField>
    )
  }
  if (form.actionType === 'add_tag') {
    return (
      <KeyPicker
        label="Action target"
        placeholder="Choose a tag"
        value={form.actionValue}
        options={tags}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
      />
    )
  }
  if (form.actionType === 'set_stage') {
    return (
      <KeyPicker
        label="Action target"
        placeholder="Choose a stage"
        value={form.actionValue}
        options={stages}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
      />
    )
  }
  // assign_broker
  return (
    <SelectField
      label="Action target"
      value={form.actionValue}
      disabled={disabled}
      onChange={(e) => setForm((f) => ({ ...f, actionValue: e.target.value }))}
    >
      <option value="" disabled>
        Choose a broker
      </option>
      {brokers.map((b) => (
        <option key={b.slug} value={b.slug}>
          {b.label}
        </option>
      ))}
    </SelectField>
  )
}

export function KeyPicker({
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  options: KeyLabelOption[]
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <SelectField label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {placeholder}
      </option>
      {options.length === 0 ? (
        <option value="__none__" disabled>
          None available
        </option>
      ) : (
        options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))
      )}
    </SelectField>
  )
}
