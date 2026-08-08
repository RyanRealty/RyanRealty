'use client'

/**
 * step-config-body-bits — the condition panel + step channel body, split out
 * of step-config-bits.tsx in 11F because that file itself crossed the
 * 600-LOC budget (ci:file-size-budget) once it absorbed everything pulled
 * out of StepConfigPanel.tsx. Splitting the file is the fix the gate asks
 * for; re-baselining a god-file (however it's arranged) is not.
 *
 * Same rule as step-config-bits.tsx: everything here is driven entirely by
 * props — no local state, no direct server-action calls. Widgets that DO own
 * state (TemplatePicker, BranchPathEditor) stay in StepConfigPanel.tsx and
 * are handed down as pre-rendered ReactNode props (`templatePicker`,
 * `trueBranch`, `falseBranch`).
 */
import type { ReactNode } from 'react'
import {
  Button,
  SectionHead,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/admin/v2'
import {
  CONDITION_FIELDS,
  CONDITION_OPS,
  type ConditionNode,
  type ConditionField,
  type ConditionOp,
  type Step,
} from '@/lib/crm/sequence-step-schema'
import { CHANNEL_CARD_LABELS } from './editor-shared'
import type { PanelOptions } from './StepConfigPanel'
import { EngineTruthRadios, TagMultiselect } from './step-config-bits'

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

// ── Condition panel shell — the two branch editors (BranchPathEditor, which
// owns its own `lastPicked` state) render in StepConfigPanel.tsx and are
// handed down here as `trueBranch` / `falseBranch` ReactNode props ─────────────

export function ConditionPanelShell({
  cond,
  disabled,
  options,
  onFieldChange,
  onOpChange,
  onValueChange,
  trueBranch,
  falseBranch,
  deleteBlock,
}: {
  cond: ConditionNode
  disabled: boolean
  options: PanelOptions
  onFieldChange: (field: ConditionField) => void
  onOpChange: (op: ConditionOp) => void
  onValueChange: (value: string) => void
  trueBranch: ReactNode
  falseBranch: ReactNode
  deleteBlock: ReactNode
}) {
  return (
    <div className="space-y-4 p-4">
      <SectionHead>Condition (IF / ELSE)</SectionHead>
      <div className="grid grid-cols-1 gap-3">
        <SelectField
          label="If"
          value={cond.field}
          disabled={disabled}
          onChange={(e) => onFieldChange(e.target.value as ConditionField)}
        >
          {CONDITION_FIELDS.map((f) => (
            <option key={f} value={f}>
              {CONDITION_FIELD_LABELS[f]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Operator"
          value={cond.op}
          disabled={disabled}
          onChange={(e) => onOpChange(e.target.value as ConditionOp)}
        >
          {CONDITION_OPS.map((o) => (
            <option key={o} value={o}>
              {CONDITION_OP_LABELS[o]}
            </option>
          ))}
        </SelectField>
        {cond.field === 'stage' && options.stages.length ? (
          <SelectField
            label="Value"
            value={cond.value}
            disabled={disabled}
            onChange={(e) => onValueChange(e.target.value)}
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
        ) : cond.field === 'tag' && options.tags.length ? (
          <SelectField
            label="Value"
            value={cond.value}
            disabled={disabled}
            onChange={(e) => onValueChange(e.target.value)}
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
        ) : (
          <TextField
            label="Value"
            value={cond.value}
            disabled={disabled}
            placeholder="Value to match"
            onChange={(e) => onValueChange(e.target.value)}
          />
        )}
      </div>
      <div className="space-y-2 rounded-lg p-3" style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>
          IF TRUE (<span className="a-num">{cond.truePath.length}</span>)
        </p>
        {trueBranch}
      </div>
      <div className="space-y-2 rounded-lg p-3" style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>
          IF FALSE / ELSE (<span className="a-num">{cond.falsePath.length}</span>)
        </p>
        {falseBranch}
      </div>
      <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
        Branch steps run immediately after the condition resolves. The automation then continues with the next
        top-level step.
      </p>
      {deleteBlock}
    </div>
  )
}

// ── Step channel body — the per-channel config form. `waitField` and
// `templatePicker` are pre-rendered in StepConfigPanel.tsx (they close over a
// DOM ref / own their own state) and handed down as ReactNode props ────────────

export function StepChannelBody({
  step,
  disabled,
  patch,
  options,
  waitField,
  templatePicker,
  deleteBlock,
}: {
  step: Step
  disabled: boolean
  patch: (p: Partial<Step>) => void
  options: PanelOptions
  waitField: ReactNode
  templatePicker: ReactNode
  deleteBlock: ReactNode
}) {
  return (
    <div className="space-y-4 p-4">
      <SectionHead>{CHANNEL_CARD_LABELS[step.channel]}</SectionHead>

      {step.channel === 'email' || step.channel === 'sms' ? (
        <>
          <div className="space-y-1.5">
            <span className="av2-field__label" style={{ display: 'block' }}>
              Template
            </span>
            {templatePicker}
            {step.templateKey ? (
              <Button
                variant="quiet"
                className="h-auto p-0 text-xs"
                style={{ color: 'var(--a-accent)' }}
                disabled={disabled}
                onClick={() => patch({ templateKey: undefined })}
              >
                Clear template and write inline instead
              </Button>
            ) : (
              <div className="space-y-1.5 pt-1">
                <TextAreaField
                  label={`Or write an inline ${step.channel === 'email' ? 'email body' : 'text message'}`}
                  rows={3}
                  value={step.body ?? ''}
                  disabled={disabled}
                  onChange={(e) => patch({ body: e.target.value })}
                />
                {!step.body?.trim() ? (
                  <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                    Pick a template or write a message before saving.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {step.channel === 'email' ? (
            <>
              <SelectField label="From" value="assigned_broker" disabled>
                <option value="assigned_broker">Broker assigned to the contact</option>
              </SelectField>
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
            <p className="rounded-lg p-2.5 text-xs" style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)', color: 'var(--a-text-2)' }}>
              Texts send from the assigned broker&apos;s number, honor the 8:00 am – 9:00 pm quiet hours, and skip opted-out
              contacts.
            </p>
          )}
          {waitField}
        </>
      ) : null}

      {step.channel === 'task' ? (
        <>
          <div className="space-y-1.5">
            <TextField label="Task name" value={step.taskName ?? ''} disabled={disabled} onChange={(e) => patch({ taskName: e.target.value })} />
            {!step.taskName?.trim() ? (
              <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                A task name is required.
              </p>
            ) : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'tag' ? (
        <>
          <TagMultiselect legend="Add tags" selected={step.addTags ?? []} tags={options.tags} disabled={disabled} onChange={(next) => patch({ addTags: next })} />
          <TagMultiselect legend="Remove tags" selected={step.removeTags ?? []} tags={options.tags} disabled={disabled} onChange={(next) => patch({ removeTags: next })} />
          {(step.addTags?.length ?? 0) + (step.removeTags?.length ?? 0) === 0 ? (
            <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
              Pick at least one tag to add or remove before saving.
            </p>
          ) : null}
          {waitField}
        </>
      ) : null}

      {step.channel === 'change_stage' ? (
        <>
          <div className="space-y-1.5">
            <SelectField label="Move to stage" value={step.value ?? ''} disabled={disabled} onChange={(e) => patch({ value: e.target.value })}>
              <option value="" disabled>
                Choose a stage
              </option>
              {options.stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </SelectField>
            {!step.value?.trim() ? (
              <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                A stage is required before saving.
              </p>
            ) : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'add_note' ? (
        <>
          <div className="space-y-1.5">
            <TextAreaField
              label="Note text"
              rows={3}
              value={step.value ?? ''}
              disabled={disabled}
              placeholder="Note to add to the contact timeline. Merge tokens like %first_name% are supported."
              onChange={(e) => patch({ value: e.target.value })}
            />
            {!step.value?.trim() ? (
              <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                Note text is required.
              </p>
            ) : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'reassign' ? (
        <>
          <div className="space-y-1.5">
            <SelectField label="Assign to broker" value={step.value ?? ''} disabled={disabled} onChange={(e) => patch({ value: e.target.value })}>
              <option value="" disabled>
                Choose a broker
              </option>
              {options.brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.label}
                </option>
              ))}
            </SelectField>
            {!step.value?.trim() ? (
              <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                A broker is required.
              </p>
            ) : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'run_automation' ? (
        <>
          <div className="space-y-1.5">
            <SelectField label="Automation to start" value={step.value ?? ''} disabled={disabled} onChange={(e) => patch({ value: e.target.value })}>
              <option value="" disabled>
                Choose an automation
              </option>
              {options.sequences.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            {!step.value?.trim() ? (
              <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                An automation is required. Only active automations are listed.
              </p>
            ) : null}
          </div>
          {waitField}
        </>
      ) : null}

      {step.channel === 'stop_other_plans' ? (
        <>
          <div className="rounded-lg p-3" style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--a-text)', margin: 0 }}>
              Pause all other running automations
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--a-text-2)' }}>
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
