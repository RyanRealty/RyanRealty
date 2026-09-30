/**
 * THE ARCHIVE'S FIRST SCREEN. What the page is for, above the fold at every
 * width: its name, one sentence of what it holds, the latest report (read it
 * here, or download its PDF), and a way into any year of the calendar below.
 * The latest edition's Central Oregon figures sit beside it as a compact tile
 * with the median's line, a glance and not a second hero.
 *
 * WHY (second taste evaluator, 2026-09-29). The archive opened on a copy of the
 * edition page's hero: the same eyebrow, title, figures and chart, with "Read
 * the August 2026 report" under the fold and the calendar starting about
 * 1,670px down. The two pages must not open on the same object, and the
 * archive's job is the list: this month's report first, then every other.
 *
 * WHY A PAGE SECTION AND NOT A BARREL PATTERN. It is the archive's own front
 * door, the way MonthlyArchive is its own calendar: a heading, a sentence, two
 * doors, a year index and a tile, built from the barrel's atoms (V3Heading,
 * V3Lede, V3Button, V3Figure, V3SourceLine) and the plot library's spark
 * (lib/charts/plot.ts, the Ledger's), styled from tokens alone.
 *
 * Server component, pure: every figure is the stored payload's, formatted by
 * the PDF's own helpers (report-view.ts marketFigures, medianSpark), so the
 * tile, the edition page and the PDF print one number per fact (CLAUDE.md
 * section 0).
 */
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buildSparkPlot } from '@/lib/charts/plot'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3Figure,
  V3Heading,
  V3Lede,
  V3SourceLine,
  type V3InstrumentFigures,
} from '@/components/site/v3'
import './archive-front.css'

/** The spark's drawing box. The SVG stretches to the tile's width; the stroke and the end mark do not. */
const SPARK_W = 240
const SPARK_H = 40

export type ArchiveFrontProps = {
  id: string
  /** The page's name, its one h1. */
  heading: string
  /** One sentence: what the archive holds, read off the list itself. */
  sentence: string
  /** The latest report: its page, and its PDF when the edition has a stored file. */
  latest: {
    readLabel: string
    href: string
    pdf?: { label: string; href: string }
  }
  /** Every year the calendar holds, newest first, each a jump to its row. */
  years: readonly { year: number; href: string }[]
  /** The latest edition's Central Oregon figures, and the trace they carry. */
  tile?: {
    heading: string
    figures: V3InstrumentFigures
    /**
     * The median's stored months as one line, oldest first, a withheld month
     * kept as a gap (null), and the words the line stands for: the visible
     * label is its accessible reading, so the drawing itself is hidden.
     */
    spark?: { values: readonly (number | null)[]; label: string }
    source: string
    sourceName: string
    asOf: string
  }
}

export function ArchiveFront({ id, heading, sentence, latest, years, tile }: ArchiveFrontProps) {
  const headingId = `${id}-heading`
  const yearsId = `${id}-years`
  const tileId = `${id}-tile`
  const spark = tile?.spark ? buildSparkPlot(tile.spark.values, { w: SPARK_W, h: SPARK_H, pad: 3, minPoints: 6 }) : null
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'archive-front', tile && 'archive-front--tile')}
      aria-labelledby={headingId}
    >
      <div className="archive-front__main">
        <V3Heading level={1} id={headingId} className="archive-front__heading">
          {heading}
        </V3Heading>
        <V3Lede className="archive-front__lede">{sentence}</V3Lede>
        <div className="archive-front__actions">
          <V3Button href={latest.href} variant="primary">
            {latest.readLabel}
          </V3Button>
          {latest.pdf ? (
            /* next/link, like every download door on these pages: the page's
               PdfLinkNavigation island hands the click to the browser. */
            <V3Button href={latest.pdf.href} variant="ghost" prefetch={false}>
              {latest.pdf.label}
            </V3Button>
          ) : null}
        </div>
        {years.length > 1 ? (
          <nav className="archive-front__years" aria-labelledby={yearsId}>
            <p id={yearsId} className="archive-front__years-label">
              Jump to a year
            </p>
            <ul className="archive-front__years-list">
              {years.map(({ year, href }) => (
                <li key={year}>
                  <a className="archive-front__year" href={href}>
                    {year}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {tile ? (
        <aside className="archive-front__tile" aria-labelledby={tileId}>
          <h2 id={tileId} className="archive-front__tile-heading">
            {tile.heading}
          </h2>
          <div className="archive-front__figures">
            {tile.figures.map((figure) => {
              const face = <V3Figure value={figure.value} label={figure.label} />
              // A market stat is a door into its node (PUBLIC-PRODUCT-OS), the
              // way the Instrument draws it: the number and its label together.
              return figure.href ? (
                <Link
                  key={figure.label}
                  href={figure.href}
                  prefetch={false}
                  className="archive-front__door"
                  aria-label={figure.ariaLabel}
                >
                  {face}
                </Link>
              ) : (
                <div key={figure.label}>{face}</div>
              )
            })}
          </div>
          {tile.spark && spark ? (
            <figure className="archive-front__spark">
              <span className="archive-front__spark-draw" aria-hidden="true">
                <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" focusable="false">
                  <path d={spark.d} vectorEffect="non-scaling-stroke" />
                </svg>
                {spark.dots.map((dot) => (
                  /* A month with no published neighbour, which the path
                     alone would not paint: the caption's low or high may be
                     this month, so it gets a mark the reader can find. */
                  <span
                    key={`${dot.x.toFixed(1)}-${dot.y.toFixed(1)}`}
                    className="archive-front__spark-dot"
                    style={
                      {
                        left: `${((dot.x / SPARK_W) * 100).toFixed(2)}%`,
                        top: `${((dot.y / SPARK_H) * 100).toFixed(2)}%`,
                      } as CSSProperties
                    }
                  />
                ))}
                {spark.last ? (
                  /* The newest month's mark, placed in the box's own
                     fractions, so it stays a circle however wide the tile
                     stretches the line. */
                  <span
                    className="archive-front__spark-end"
                    style={
                      {
                        left: `${((spark.last.x / SPARK_W) * 100).toFixed(2)}%`,
                        top: `${((spark.last.y / SPARK_H) * 100).toFixed(2)}%`,
                      } as CSSProperties
                    }
                  />
                ) : null}
              </span>
              <figcaption className="archive-front__spark-label">{tile.spark.label}</figcaption>
            </figure>
          ) : null}
          <V3SourceLine
            source={tile.source}
            sourceName={tile.sourceName}
            asOf={tile.asOf}
            className="archive-front__source"
          />
        </aside>
      ) : null}
    </section>
  )
}
