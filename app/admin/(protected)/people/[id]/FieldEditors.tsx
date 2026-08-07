'use client'

/**
 * FieldEditors (P11B B2) — stage · assigned broker · source · tags as v2
 * controls. Every edit posts to the SAME gated server action the legacy
 * workspace used (updateCrmStageAction, assignCrmBrokerAction,
 * updatePersonFieldAction('source'), add/removeCrmTagAction) via the
 * people/actions.ts wrappers; selects auto-submit on change. Name, phone, and
 * email editing stays behind the All-tools door for now.
 */
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, CRM_STAGES } from '@/lib/crm/constants'

type FormAction = (formData: FormData) => Promise<void>

export function FieldEditors(props: {
  stage: string
  assignedBroker: string | null
  canReassign: boolean
  source: string | null
  sources: string[]
  tags: string[]
  updateStage: FormAction
  assignBroker: FormAction
  updateSource: FormAction
  addTag: FormAction
  removeTag: (tag: string, formData: FormData) => Promise<void>
}) {
  const stages: string[] = (CRM_STAGES as readonly string[]).includes(props.stage)
    ? [...CRM_STAGES]
    : [props.stage, ...CRM_STAGES]
  const sources: string[] =
    props.source && !props.sources.includes(props.source)
      ? [props.source, ...props.sources]
      : props.sources

  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="av2-editgrid">
        <form action={props.updateStage}>
          <SelectField
            label="Stage"
            name="stage"
            key={`stage-${props.stage}`}
            defaultValue={props.stage}
            onChange={submitOnChange}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </form>

        {props.canReassign ? (
          <form action={props.assignBroker}>
            <SelectField
              label="Assigned broker"
              name="broker"
              key={`broker-${props.assignedBroker ?? 'none'}`}
              defaultValue={props.assignedBroker ?? ''}
              onChange={submitOnChange}
            >
              {!props.assignedBroker ? <option value="">Unassigned</option> : null}
              {CRM_BROKERS.map((b) => (
                <option key={b} value={b}>
                  {CRM_BROKER_DISPLAY[b]}
                </option>
              ))}
            </SelectField>
          </form>
        ) : (
          <div className="av2-field">
            <span className="av2-field__label">Assigned broker</span>
            <span style={{ padding: '10px 0', color: 'var(--a-text-2)' }}>
              {props.assignedBroker
                ? (CRM_BROKER_DISPLAY[props.assignedBroker as keyof typeof CRM_BROKER_DISPLAY] ??
                  props.assignedBroker)
                : 'Unassigned'}
            </span>
          </div>
        )}

        <form action={props.updateSource}>
          <SelectField
            label="Source"
            name="source"
            key={`source-${props.source ?? 'none'}`}
            defaultValue={props.source ?? ''}
            onChange={submitOnChange}
          >
            <option value="">Unspecified</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </form>
      </div>

      <div className="av2-wordrow" aria-label="Tags">
        {props.tags.map((tag) => (
          <form key={tag} action={props.removeTag.bind(null, tag)}>
            <Button
              type="submit"
              variant="quiet"
              aria-label={`Remove tag ${tag}`}
              title={`Remove tag ${tag}`}
              style={{ minHeight: 28, padding: '0 10px', fontSize: 'var(--a-text-xs)', fontWeight: 500 }}
            >
              {tag} ×
            </Button>
          </form>
        ))}
        {props.tags.length === 0 ? (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No tags.</span>
        ) : null}
      </div>

      <form action={props.addTag} className="av2-inline-form" style={{ maxWidth: 420 }}>
        <TextField label="Add a tag" name="tag" placeholder="past-client" maxLength={80} required />
        <Button type="submit" variant="quiet">
          Add
        </Button>
      </form>
    </div>
  )
}
