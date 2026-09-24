/**
 * PATTERN — CLAIMS. A few specific, checkable claims about the firm, each one
 * led by the figure that proves it, on the inverse (navy) ground.
 *
 * Built for /about "What makes Ryan Realty different" (Matt 2026-09-23, the
 * About-page AEO playbook). A differentiator an answer engine can quote is a
 * named claim (an H3) with its evidence beside it: a rating and its count, a
 * fee, a turnaround, a record. Without the figure it is an adjective; without
 * the sentence the figure is the KPI tile TASTE.md bans. This primitive holds
 * the two together and never prints one without the other's slot being
 * honest: a claim with no figure renders as words alone, never a placeholder.
 *
 * WHY NAVY. The page around it is cream hairline sections; one inverse band is
 * the change in ground that stops a long About from reading as a stack, and it
 * is the brand's own second color, not a new one. Cream on navy is 14.8:1 and
 * the muted cream is held to text 16px and up (PUBLIC_UI.md section 4).
 *
 * NEVER A COMPARISON. The claims are our own facts. The primitive has no slot
 * for a named competitor and the copy it carries must not name one (Matt
 * 2026-09-23: NAR Code Article 15, Oregon advertising rules).
 *
 * Barrel law honored here:
 *  - Server component. The caller formats every figure and owns its §0 trace;
 *    `source` renders as the section's one trace line.
 *  - Every value resolves through ./tokens.css in ./V3Claims.css.
 *  - A claim with no title or no body is dropped; nothing left returns null.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import { V3MarkStrip, markStripDrawable, type V3MarkStripProps } from './V3MarkStrip'
import './tokens.css'
import './V3Claims.css'

export type V3ClaimFigure = {
  /** Already formatted by the caller: "5.0", "3%", "24 hrs". */
  value: string
  /** What it measures, in plain words. Required: a bare number is not a claim. */
  label: string
}

export type V3Claim = {
  /** The claim, rendered as an H3. */
  title: string
  /** The evidence in words. One string is one paragraph. */
  body: string | readonly string[]
  /** The figure that proves it. Omit rather than estimate (CLAUDE.md §0). */
  figure?: V3ClaimFigure
  /** Where the reader checks it. */
  door?: { label: string; href: string }
  /**
   * The evidence drawn, when the figure is a record over time (a count of
   * closings): the events as a dot strip the reader can point at.
   */
  strip?: Omit<V3MarkStripProps, 'className'>
  id?: string
}

export type V3ClaimsProps = {
  id: string
  heading: string
  eyebrow?: string
  claims: readonly V3Claim[]
  /** The §0 trace for the live figures, in a visitor's words. */
  source?: string
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function paragraphs(body: V3Claim['body']): string[] {
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

export function V3Claims({ id, heading, eyebrow, claims, source, className }: V3ClaimsProps) {
  const title = text(heading)
  const rows = claims
    .map((claim) => {
      const name = text(claim.title)
      const body = paragraphs(claim.body)
      const value = text(claim.figure?.value)
      const label = text(claim.figure?.label)
      const doorLabel = text(claim.door?.label)
      const doorHref = text(claim.door?.href)
      return name && body.length > 0
        ? {
            name,
            body,
            id: text(claim.id),
            figure: value && label ? { value, label } : undefined,
            door: doorLabel && doorHref ? { label: doorLabel, href: doorHref } : undefined,
            strip: claim.strip && markStripDrawable(claim.strip) ? claim.strip : undefined,
          }
        : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!title || rows.length === 0) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const trace = text(source)

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-claims', className)} aria-labelledby={headingId}>
      <div className="v3-claims__inner">
        <div className="v3-claims__head">
          {contextLine ? <V3Eyebrow className="v3-claims__eyebrow">{contextLine}</V3Eyebrow> : null}
          <V3Heading level={2} id={headingId} className="v3-claims__heading">
            {title}
          </V3Heading>
        </div>
        <ul className="v3-claims__list">
          {rows.map((row) => (
            <li key={row.id ?? row.name} id={row.id} className="v3-claims__item">
              {row.figure ? (
                <p className="v3-claims__figure">
                  <span className="v3-claims__value">{row.figure.value}</span>
                  <span className="v3-claims__label">{row.figure.label}</span>
                </p>
              ) : null}
              <h3 className="v3-claims__name">{row.name}</h3>
              {row.body.map((line, lineIndex) => (
                <p key={lineIndex} className="v3-claims__body">
                  {line}
                </p>
              ))}
              {row.strip ? <V3MarkStrip {...row.strip} className="v3-claims__strip" /> : null}
              {row.door ? (
                <Link href={row.door.href} className="v3-claims__door">
                  <span>{row.door.label}</span>
                  <span aria-hidden="true" className="v3-claims__arrow">
                    &rarr;
                  </span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        {trace ? <p className="v3-claims__source">{trace}</p> : null}
      </div>
    </section>
  )
}
