'use client'
/**
 * V3 ASK. One screen, every field, one button.
 *
 * The Sheet walks a visitor through one question at a time, which is right
 * for a valuation and wrong for "write to us": the contact page opened on
 * "Step 1 of 5" and a person with a question had to tap Continue four times
 * before they could type it (Matt 2026-09-01: how they get hold of us must be
 * simple). Ask is the whole form at once — the labels the Sheet uses, the
 * same control style, a two-column grid on a wide screen, one column on a
 * phone — and the caller owns the send: this primitive collects answers and
 * prints the result the caller returns, nothing more.
 *
 * Validation is the browser's (required, email, tel), which is also the
 * accessible one. A failed send keeps every answer on screen.
 */
import { useCallback, useId, useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading } from './atoms'
import './tokens.css'
import './V3Ask.css'

export type V3AskOption = { value: string; label: string }

export type V3AskField = {
  name: string
  /** A stable element id for locators and analytics; the default is derived. */
  id?: string
  label: string
  kind?: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  required?: boolean
  autoComplete?: string
  placeholder?: string
  options?: readonly V3AskOption[]
  defaultValue?: string
  rows?: number
  maxLength?: number
  /** Half a row on a wide screen; full is the default for textareas. */
  span?: 'half' | 'full'
  /** A short line under the label: "for a text back". */
  hint?: string
}

export type V3AskResult = { ok: true; heading: string; body?: string } | { ok: false; message: string }

export type V3AskProps = {
  id: string
  eyebrow?: string
  heading: string
  headingLevel?: 1 | 2
  /** One sentence under the heading. */
  lede?: string
  fields: readonly V3AskField[]
  /** Rendered between the fields and the button: a consent line, a note. */
  consent?: ReactNode
  submitLabel: string
  onSubmit: (answers: Readonly<Record<string, string>>) => Promise<V3AskResult>
  className?: string
}

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function V3Ask({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  lede,
  fields,
  consent,
  submitLabel,
  onSubmit,
  className,
}: V3AskProps) {
  const uid = useId()
  const [status, setStatus] = useState<Status>('asking')
  const [result, setResult] = useState<V3AskResult | null>(null)

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (status === 'sending') return
      const data = new FormData(event.currentTarget)
      const answers: Record<string, string> = {}
      for (const [key, value] of data.entries()) {
        if (typeof value === 'string') answers[key] = value.trim()
      }
      setStatus('sending')
      try {
        const r = await onSubmit(answers)
        setResult(r)
        setStatus(r.ok ? 'sent' : 'failed')
      } catch {
        setResult({ ok: false, message: 'The message did not send. Call or text instead, or try again.' })
        setStatus('failed')
      }
    },
    [onSubmit, status],
  )

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-ask', className)} aria-labelledby={`${uid}-h`}>
      <div className="v3-ask__head">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={`${uid}-h`} className="v3-ask__heading">
          {status === 'sent' && result?.ok ? result.heading : heading}
        </V3Heading>
        {status === 'sent' && result?.ok ? (
          result.body ? <p className="v3-ask__lede">{result.body}</p> : null
        ) : lede ? (
          <p className="v3-ask__lede">{lede}</p>
        ) : null}
      </div>

      {status !== 'sent' ? (
        <form className="v3-ask__form" onSubmit={submit} aria-busy={status === 'sending'}>
          <div className="v3-ask__fields">
            {fields.map((f) => {
              const fid = f.id ?? `${uid}-${f.name}`
              const kind = f.kind ?? 'text'
              const span = f.span ?? (kind === 'textarea' ? 'full' : 'half')
              return (
                <div key={f.name} className={cn('v3-ask__field', `v3-ask__field--${span}`)}>
                  <label htmlFor={fid} className="v3-ask__label">
                    {f.label}
                    {f.required ? null : <span className="v3-ask__optional"> optional</span>}
                  </label>
                  {f.hint ? <span className="v3-ask__hint">{f.hint}</span> : null}
                  {kind === 'textarea' ? (
                    <textarea
                      id={fid}
                      name={f.name}
                      className="v3-ask__control v3-ask__control--area"
                      required={f.required}
                      placeholder={f.placeholder}
                      defaultValue={f.defaultValue}
                      rows={f.rows ?? 5}
                      maxLength={f.maxLength}
                    />
                  ) : kind === 'select' ? (
                    <span className="v3-ask__select-wrap">
                      <select
                        id={fid}
                        name={f.name}
                        className="v3-ask__control v3-ask__control--select"
                        required={f.required}
                        defaultValue={f.defaultValue}
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  ) : (
                    <input
                      id={fid}
                      name={f.name}
                      type={kind}
                      className="v3-ask__control"
                      required={f.required}
                      autoComplete={f.autoComplete}
                      placeholder={f.placeholder}
                      defaultValue={f.defaultValue}
                      maxLength={f.maxLength}
                      inputMode={kind === 'tel' ? 'tel' : kind === 'email' ? 'email' : undefined}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {consent ? <div className="v3-ask__consent">{consent}</div> : null}
          <div className="v3-ask__actions">
            <V3Button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending' : submitLabel}
            </V3Button>
            {status === 'failed' && result && !result.ok ? (
              <p className="v3-ask__problem" role="alert">
                {result.message}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  )
}
