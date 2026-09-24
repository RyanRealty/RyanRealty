/**
 * PATTERN — STEPS. How working with us goes, in order: one commitment in the
 * display face, the standing facts beside it (hours, where), and the steps as
 * a numbered line the reader follows left to right.
 *
 * Built for /about "How Ryan Realty works" (Matt 2026-09-23, the About-page
 * AEO playbook). A process is ORDERED, and a Quiet stack or an Answers set
 * loses the order; an Entries grid reads as a menu of equals. Here each step
 * is an H3 on a drawn line, so the order is both in the outline (an <ol>) and
 * in the picture.
 *
 * THE PROMISE IS THE CALLER'S. The primitive prints `promise` as the section's
 * display line and never composes one. A reply-time promise is a commitment a
 * person made, not a measured figure (V3OnDuty stays a clock, never a reply
 * time); the caller names whose commitment it is in its own source comment.
 *
 * Barrel law honored here:
 *  - Server component. `live` is an optional slot for a state the caller
 *    already read (an office-hours clock); nothing here fetches or formats.
 *  - Every value resolves through ./tokens.css in ./V3Steps.css; the step
 *    nodes are data marks and take --v3-radius-mark.
 *  - A step with no title or no body is dropped; nothing left returns null.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Steps.css'

export type V3Step = {
  /** The step, rendered as an H3. */
  title: string
  body: string | readonly string[]
  id?: string
}

export type V3StepsFact = { term: string; value: string }

export type V3StepsProps = {
  id: string
  heading: string
  eyebrow?: string
  /** The one commitment, in the display face. */
  promise?: string
  /** Standing facts beside the promise, as a description list. */
  facts?: readonly V3StepsFact[]
  /** A live state the caller already read, set under the facts. */
  live?: ReactNode
  steps: readonly V3Step[]
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function paragraphs(body: V3Step['body']): string[] {
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

export function V3Steps({ id, heading, eyebrow, promise, facts, live, steps, className }: V3StepsProps) {
  const title = text(heading)
  const rows = steps
    .map((step) => {
      const name = text(step.title)
      const body = paragraphs(step.body)
      return name && body.length > 0 ? { name, body, id: text(step.id) } : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!title || rows.length === 0) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const line = text(promise)
  const pairs = (facts ?? [])
    .map((fact) => {
      const term = text(fact.term)
      const value = text(fact.value)
      return term && value ? { term, value } : null
    })
    .filter((pair): pair is NonNullable<typeof pair> => pair !== null)
  const hasAside = pairs.length > 0 || live != null

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-steps', className)} aria-labelledby={headingId}>
      <div className={cn('v3-steps__top', hasAside && 'v3-steps__top--aside')}>
        <div className="v3-steps__lead">
          {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
          <V3Heading level={2} id={headingId} className="v3-steps__heading">
            {title}
          </V3Heading>
          {line ? <p className="v3-steps__promise">{line}</p> : null}
        </div>
        {hasAside ? (
          <div className="v3-steps__aside">
            {pairs.length > 0 ? (
              <dl className="v3-steps__facts">
                {pairs.map((pair) => (
                  <div key={pair.term} className="v3-steps__fact">
                    <dt className="v3-steps__term">{pair.term}</dt>
                    <dd className="v3-steps__value">{pair.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {live ? <div className="v3-steps__live">{live}</div> : null}
          </div>
        ) : null}
      </div>
      <ol className="v3-steps__list" style={{ '--v3-steps-count': String(rows.length) } as CSSProperties}>
        {rows.map((row, index) => (
          <li key={row.id ?? row.name} id={row.id} className="v3-steps__step">
            <span className="v3-steps__node" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="v3-steps__name">{row.name}</h3>
            {row.body.map((para, paraIndex) => (
              <p key={paraIndex} className="v3-steps__body">
                {para}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}
