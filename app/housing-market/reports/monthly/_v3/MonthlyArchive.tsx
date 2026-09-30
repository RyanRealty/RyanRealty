/**
 * The monthly report archive: every published edition as a calendar, one row
 * per year, newest year first. Each month is two doors, the edition's page and
 * its PDF, and hovering, focusing or (on a phone) pressing and holding a month
 * shows that edition's first headline sentence, read from the stored summary,
 * so a reader can scan twenty years of openings without leaving the grid.
 *
 * THE PHONE GETS THE REVEAL TOO (taste evaluator, 2026-09-25: the reveal was
 * gated to a hover pointer and a wide window, so a phone got none). The hold
 * is the Ledger's (V3HoldReveal): a press of a third of a second on a month's
 * link opens the month's sentence in place and swallows the tap that would
 * have followed, a plain tap still opens the month, a tap outside closes it,
 * and the PDF door keeps the phone's own long-press menu. The sentence sits
 * INSIDE the month's link, so a tap on an open sentence opens that month and
 * never the month drawn under it; the link's aria-label still names it and
 * aria-describedby still reads the sentence, and keyboard focus (never a
 * tap's focus) opens it at every width.
 *
 * WHY A PAGE SECTION AND NOT A BARREL PATTERN. The six patterns carry one door
 * per row (Ledger, Directory, Quiet); an archive month carries two, and the
 * calendar shape is the point: January always sits in the first column, so a
 * missing or not-yet-published month reads as a gap, not a shorter list. Built
 * from the barrel's atoms (eyebrow, heading, lede, source line) and styled from
 * components/site/v3/tokens.css alone, the way the region supply ladder is
 * (app/housing-market/central-oregon/_v3/region-city-mos.css).
 *
 * A PHONE IS TOLD THE HOLD EXISTS (second taste evaluator, 2026-09-29): a
 * finger has no hover, so under the legend one line says a month can be
 * pressed and held, on a screen with no hover only (monthly-archive.css). The
 * year index moved up into the page's first screen (ArchiveFront), so a reader
 * reaches any year before scrolling; every year row here keeps its anchor.
 *
 * Server component. Every anchor is in the served HTML, every year is an
 * anchor target, and nothing but the phone's hold needs JavaScript. The PDF
 * doors are plain anchors on purpose: they lead to a route handler that
 * redirects to the stored file, and a client-side navigation or a prefetch has
 * nothing to render there.
 */
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  V3HoldReveal,
  V3Lede,
  V3RunningHead,
  V3SourceDisclosure,
} from '@/components/site/v3'
import { archiveYearId, monthShort, type ArchiveYear } from './report-view'
import './monthly-archive.css'

export type MonthlyArchiveProps = {
  id: string
  /** The context, set on the heading's line at its far end (a running head), not above it. */
  eyebrow: string
  heading: string
  lede: string
  /** What the month bars and figures show; printed under the heading when any month carries one. */
  legend?: string
  /**
   * One line under the legend telling a phone reader that a month can be
   * pressed and held to open its first line. Shown only where there is no
   * hover, and only when some month has a line to open.
   */
  holdHint?: string
  years: readonly ArchiveYear[]
  /** The §0 trace for the sentences the months reveal. */
  source: string
  /** The source's name for the one visible clause. */
  sourceName: string
}

export function MonthlyArchive({
  id,
  eyebrow,
  heading,
  lede,
  legend,
  holdHint,
  years,
  source,
  sourceName,
}: MonthlyArchiveProps) {
  if (years.length === 0) return null
  const headingId = `${id}-heading`
  const anyLead = years.some((y) => y.slots.some((cell) => Boolean(cell?.lead)))
  const calendar = (
    <ol className="monthly-archive__years">
      {years.map((y) => (
        <ArchiveYearRow key={y.year} year={y} />
      ))}
    </ol>
  )
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'monthly-archive')} aria-labelledby={headingId}>
      <div className="monthly-archive__head">
        {/* The running head: the heading, then its context at the far end of
            the same line (the report's table opens the same way, through the
            same barrel atom), instead of the eyebrow-over-heading beat every
            section used to repeat. */}
        <V3RunningHead level={2} id={headingId} heading={heading} kicker={eyebrow} />
        <V3Lede className="monthly-archive__lede">{lede}</V3Lede>
      </div>

      {/* The year index lives in the page's first screen (ArchiveFront), so
          a reader can reach any year before scrolling; every year row below
          keeps its anchor. */}

      {legend && years.some((y) => y.slots.some((c) => c?.median)) ? (
        <p className="monthly-archive__legend">
          <span className="monthly-archive__legend-scale" aria-hidden="true" />
          {legend}
        </p>
      ) : null}

      {holdHint && anyLead ? (
        /* A finger has no hover and no way to know a month opens its first
           line: this says so, on a screen with no hover only
           (monthly-archive.css). */
        <p className="monthly-archive__hint">{holdHint}</p>
      ) : null}

      {anyLead ? (
        /* The phone's hover: a press and hold on a month's link opens its
           sentence (data-revealed, read by monthly-archive.css). Only the
           month link is a handle, so a long press on the PDF door still gets
           the phone's own menu. Mounted only when a month has a sentence to
           reveal. */
        <V3HoldReveal
          item=".monthly-archive__month"
          reveal=".monthly-archive__peek"
          handle=".monthly-archive__read"
          className="monthly-archive__hold"
        >
          {calendar}
        </V3HoldReveal>
      ) : (
        calendar
      )}

      <V3SourceDisclosure source={source} sourceName={sourceName} className="monthly-archive__source" />
    </section>
  )
}

/** One year: its name and count, then twelve months in calendar order. */
function ArchiveYearRow({ year: y }: { year: ArchiveYear }) {
  const yearHeadingId = `${archiveYearId(y.year)}-heading`
  return (
    <li id={archiveYearId(y.year)} className="monthly-archive__year" aria-labelledby={yearHeadingId}>
      <div className="monthly-archive__yearhead">
        <h3 id={yearHeadingId} className="monthly-archive__yearname">
          {y.year}
        </h3>
        <p className="monthly-archive__yearcount">{y.count === 1 ? '1 report' : `${y.count} reports`}</p>
      </div>
      <ul className="monthly-archive__months">
        {y.slots.map((cell, index) => {
          if (!cell) {
            return (
              <li
                key={`${y.year}-${index}`}
                className="monthly-archive__month monthly-archive__month--empty"
                aria-hidden="true"
              >
                <span className="monthly-archive__gap">{monthShort(index)}</span>
              </li>
            )
          }
          const leadId = cell.lead ? `lead-${cell.key}` : undefined
          return (
            <li
              key={cell.key}
              className={cn(
                'monthly-archive__month',
                cell.shade != null && 'monthly-archive__month--shaded',
                cell.latest && 'monthly-archive__month--latest',
              )}
              style={cell.shade != null ? ({ '--cell-shade': cell.shade.toFixed(3) } as CSSProperties) : undefined}
            >
              <Link
                href={cell.href}
                prefetch={false}
                className="monthly-archive__read"
                aria-label={`Read the ${cell.label} report`}
                aria-describedby={leadId}
              >
                {cell.short}
                {cell.lead ? (
                  /* Inside the month's own door, so an open sentence is part
                     of the link: a tap on it opens THIS month, never the month
                     drawn under it. Out of the flow, over the row below. */
                  <span id={leadId} role="tooltip" className="monthly-archive__peek">
                    <span className="monthly-archive__peek-when">{cell.label}</span>
                    {cell.lead}
                  </span>
                ) : null}
              </Link>
              {cell.median ? <span className="monthly-archive__median">{cell.median}</span> : null}
              {cell.pdfHref && cell.pdf ? (
                <a
                  href={cell.pdfHref}
                  className="monthly-archive__pdf"
                  aria-label={`Download the ${cell.label} report (${cell.pdf})`}
                >
                  PDF
                </a>
              ) : (
                <span className="monthly-archive__nopdf">Web only</span>
              )}
            </li>
          )
        })}
      </ul>
    </li>
  )
}
