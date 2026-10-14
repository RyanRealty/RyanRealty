'use client'
// Client boundary: the amount scrubber and the inputs behind the figures are
// visitor-caused state the caller holds; this primitive renders the controls
// and the drawing and reports every change back through the props.

/**
 * PATTERN — COMPARE. One amount, two uses, drawn on one scale.
 *
 * The Sheet pattern's comparison job (PUBLIC_UI.md section 3: "the working
 * surface for a step: form, filter set, COMPARISON, plan detail") as an
 * instrument rather than a table. Built for /buy/concessions (Matt
 * 2026-10-14): the same $10,000 off the price or toward the rate, which the
 * "Same $10,000" ad already shows as two rolling figures. The page continues
 * the ad: one amount the reader drags, two outcomes that roll to their new
 * values, and the difference drawn as two lengths on one scale so the claim
 * lands before the sentence is read (TASTE.md: a headline claim is drawn,
 * not said).
 *
 * THE FORM. The amount sits first, large, with its scrubber under it. The two
 * outcomes stand side by side past 48rem (stacked on a phone): a label, the
 * figure in the numeral face, its bar on the shared scale, one plain sentence
 * and one quiet detail. The larger outcome is the lead and its bar is full
 * ink; the other is drawn lighter so the margin reads as a length. The
 * verdict sentence under them says the margin in words. The inputs behind the
 * figures (price, down payment, rate, loan type) fold under one disclosure
 * so the fold shows the comparison, not a form.
 *
 * MOTION. The figures roll on every change the visitor makes (V3Number, which
 * publishes the settled face on the server and animates only on later
 * changes), and the bars re-size on --v3-dur-enter. Nothing moves on arrival.
 *
 * Barrel law honored here:
 *  - Controls are constructed HERE, in one place, with the V3Input classes
 *    (./V3Input.css) so the scrubber, the number fields and the selects wear
 *    the house field. Nothing from components/ui.
 *  - The caller formats every figure and owns its §0 trace; `source` renders
 *    as the section's collapsed trace. Nothing here rounds a dollar.
 *  - Every value resolves through ./tokens.css in ./V3Compare.css.
 *  - A blank heading, label or outcome label is dropped at render rather than
 *    shipped nameless; a section with no heading renders nothing.
 */
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from './atoms'
import { V3Number } from './V3Number.client'
import { V3SourceDisclosure } from './V3SourceLine'
import './tokens.css'
import './V3Input.css'
import './V3Compare.css'

export type V3CompareOutcome = {
  key: string
  /** "Off the price". Required: a figure without its label is not honest. */
  label: string
  /** The whole-number figure that drives the roll and the bar. */
  value: number
  /** The settled face, already formatted by the caller: "55", "1,284". */
  formatted: string
  /** Printed before the figure: "$". */
  prefix?: string
  /** Printed after the figure, in words: "a month". */
  unit: string
  /** One plain sentence under the figure: what the number means. */
  sentence: string
  /** One quiet line: the basis. */
  detail?: string
}

export type V3CompareAmount = {
  /** "Seller dollars". The scrubber's accessible name. */
  label: string
  value: number
  min: number
  max: number
  step: number
  /** The amount as it reads on screen: "$10,000". */
  formatted: string
  onChange: (value: number) => void
  /** One quiet line under the scrubber: where the starting value came from. */
  hint?: string
}

export type V3CompareOption = { value: string; label: string }

export type V3CompareNumberField = {
  kind: 'number'
  name: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  hint?: string
}

export type V3CompareSelectField = {
  kind: 'select'
  name: string
  label: string
  value: string
  options: readonly V3CompareOption[]
  onChange: (value: string) => void
  hint?: string
}

export type V3CompareField = V3CompareNumberField | V3CompareSelectField

export type V3CompareProps = {
  id: string
  eyebrow?: string
  heading: string
  headingLevel?: 1 | 2
  /** The claim in plain words, under the heading. */
  claim?: string
  amount: V3CompareAmount
  outcomes: readonly [V3CompareOutcome, V3CompareOutcome]
  /** The margin in words: "Toward the rate saves $114 more a month." */
  verdict?: string
  /** A status the figures depend on (a loan cap). `exception` paints it as a data exception. */
  status?: { text: string; exception?: boolean }
  /** The adjustable inputs behind the figures, folded under one disclosure. */
  inputs?: { label: string; fields: readonly V3CompareField[] }
  /** The §0 trace, without the word "Source". */
  source: string
  sourceName?: string
  /** One quiet legal line at the foot. */
  legal?: string
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function NumberField({ field, id }: { field: V3CompareNumberField; id: string }) {
  const hintId = field.hint ? `${id}-hint` : undefined
  return (
    <div className="v3-input v3-compare__field">
      <label htmlFor={id} className="v3-input__label">
        {field.label}
      </label>
      <div className="v3-input__field">
        <input
          id={id}
          name={field.name}
          type="number"
          inputMode="decimal"
          className="v3-input__control"
          value={Number.isFinite(field.value) ? field.value : ''}
          min={field.min}
          max={field.max}
          step={field.step}
          aria-describedby={hintId}
          onChange={(event) => field.onChange(Number(event.target.value))}
        />
      </div>
      {field.hint ? (
        <span id={hintId} className="v3-input__hint">
          {field.hint}
        </span>
      ) : null}
    </div>
  )
}

function SelectField({ field, id }: { field: V3CompareSelectField; id: string }) {
  const hintId = field.hint ? `${id}-hint` : undefined
  return (
    <div className="v3-input v3-compare__field">
      <label htmlFor={id} className="v3-input__label">
        {field.label}
      </label>
      <div className="v3-input__field">
        <select
          id={id}
          name={field.name}
          className="v3-input__control v3-input__control--select"
          value={field.value}
          aria-describedby={hintId}
          onChange={(event) => field.onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {field.hint ? (
        <span id={hintId} className="v3-input__hint">
          {field.hint}
        </span>
      ) : null}
    </div>
  )
}

export function V3Compare({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  claim,
  amount,
  outcomes,
  verdict,
  status,
  inputs,
  source,
  sourceName,
  legal,
  className,
}: V3CompareProps) {
  const uid = useId()
  const title = text(heading)
  const sides = outcomes.filter((o) => text(o.label) && Number.isFinite(o.value))
  if (!title || sides.length < 2) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const claimLine = text(claim)
  const verdictLine = text(verdict)
  const legalLine = text(legal)
  const rangeId = `${uid}-amount`
  const hintId = amount.hint ? `${uid}-amount-hint` : undefined
  const scale = Math.max(...sides.map((o) => Math.max(0, o.value)), 0)
  const lead = sides.reduce((best, o) => (o.value > best.value ? o : best), sides[0]!)
  const fields = (inputs?.fields ?? []).filter((f) => text(f.label) && text(f.name))

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-compare', className)}
      aria-labelledby={headingId}
    >
      <header className="v3-compare__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId}>
          {title}
        </V3Heading>
        {claimLine ? <p className="v3-compare__claim">{claimLine}</p> : null}
      </header>

      <div className="v3-compare__amount">
        <label htmlFor={rangeId} className="v3-compare__amount-label">
          {amount.label}
        </label>
        <output htmlFor={rangeId} className="v3-compare__amount-value" aria-live="off">
          {amount.formatted}
        </output>
        <input
          id={rangeId}
          type="range"
          className="v3-compare__range"
          min={amount.min}
          max={amount.max}
          step={amount.step}
          value={amount.value}
          aria-valuetext={amount.formatted}
          aria-describedby={hintId}
          onChange={(event) => amount.onChange(Number(event.target.value))}
        />
        {amount.hint ? (
          <p id={hintId} className="v3-compare__amount-hint">
            {amount.hint}
          </p>
        ) : null}
      </div>

      <div className="v3-compare__outcomes">
        {sides.map((o) => {
          const share = scale > 0 ? Math.max(0, o.value) / scale : 0
          const isLead = o.key === lead.key
          return (
            <div
              key={o.key}
              className={cn('v3-compare__outcome', isLead && 'v3-compare__outcome--lead')}
              data-lead={isLead ? 'true' : undefined}
            >
              <p className="v3-compare__outcome-label">{o.label}</p>
              <p className="v3-compare__figure">
                {o.prefix ? <span className="v3-compare__figure-prefix">{o.prefix}</span> : null}
                <V3Number
                  value={Math.max(0, Math.round(o.value))}
                  formatted={o.formatted}
                  startOnView={false}
                  durationMs={600}
                  className="v3-compare__figure-num"
                />
                <span className="v3-compare__figure-unit"> {o.unit}</span>
              </p>
              <div className="v3-compare__track" aria-hidden="true">
                <span
                  className="v3-compare__bar"
                  style={{ '--v3-compare-share': share } as React.CSSProperties}
                />
              </div>
              <p className="v3-compare__sentence">{o.sentence}</p>
              {text(o.detail) ? <p className="v3-compare__detail">{o.detail}</p> : null}
            </div>
          )
        })}
      </div>

      {verdictLine ? (
        <p className="v3-compare__verdict" aria-live="polite">
          {verdictLine}
        </p>
      ) : null}

      {status && text(status.text) ? (
        <p
          className={cn('v3-compare__status', status.exception && 'v3-compare__status--exception')}
          role="status"
        >
          {status.text}
        </p>
      ) : null}

      {inputs && fields.length > 0 ? (
        <details className="v3-compare__inputs">
          <summary className="v3-compare__inputs-summary">{inputs.label}</summary>
          <div className="v3-compare__fields">
            {fields.map((field) =>
              field.kind === 'select' ? (
                <SelectField key={field.name} field={field} id={`${uid}-${field.name}`} />
              ) : (
                <NumberField key={field.name} field={field} id={`${uid}-${field.name}`} />
              ),
            )}
          </div>
        </details>
      ) : null}

      <V3SourceDisclosure className="v3-compare__source" source={source} sourceName={sourceName ?? null} />
      {legalLine ? <p className="v3-compare__legal">{legalLine}</p> : null}
    </section>
  )
}
