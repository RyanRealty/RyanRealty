/**
 * PATTERN — MARK STRIP. A record over time drawn small: one dot per event on
 * a hairline between two labelled ends, with optional notes (a tick and a
 * short label above the line) for moments that explain where the dots bunch.
 * The dataviz house form "dot strip", at the size of a line of text, so it can
 * sit inside a claim or a fact rather than needing a chart of its own.
 *
 * Built for /about (2026-09-23): the recorded-closings claim and fact. The
 * caller places every mark (0..1) and writes its label from the same rows it
 * counted; this primitive never does date arithmetic or formatting (barrel
 * law). The track is ONE role="img" read as `label`; the dots are aria-hidden
 * and answer a pointer with their own label. Ink is currentColor, so the strip
 * reads on cream and on the navy band without a variant.
 *
 * Nothing renders without a label, both ends, and two placeable marks: a line
 * needs two ends and a record of one is a sentence, not a drawing.
 */
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3MarkStrip.css'

export type V3MarkStripMark = { at: number; label: string }

export type V3MarkStripProps = {
  /** The whole drawing read as one sentence (the img's accessible name). */
  label: string
  /** The left and right end labels, preformatted ("Apr 2015", "Sep 2026"). */
  from: string
  to: string
  marks: ReadonlyArray<V3MarkStripMark>
  /** Moments on the line that are not events of the record. */
  notes?: ReadonlyArray<V3MarkStripMark>
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function placeable(list: ReadonlyArray<V3MarkStripMark> | undefined): V3MarkStripMark[] {
  return (list ?? [])
    .filter((m) => Number.isFinite(m.at) && m.at >= 0 && m.at <= 1 && text(m.label))
    .map((m) => ({ at: m.at, label: m.label.trim() }))
}

/** True when the strip has enough to draw; callers may use it to omit a slot. */
export function markStripDrawable(strip: Pick<V3MarkStripProps, 'label' | 'from' | 'to' | 'marks'> | null | undefined): boolean {
  if (!strip) return false
  return Boolean(text(strip.label) && text(strip.from) && text(strip.to) && placeable(strip.marks).length >= 2)
}

export function V3MarkStrip({ label, from, to, marks, notes, className }: V3MarkStripProps) {
  const name = text(label)
  const left = text(from)
  const right = text(to)
  const dots = placeable(marks)
  const ticks = placeable(notes)
  if (!name || !left || !right || dots.length < 2) return null
  return (
    <span className={cn('v3-strip', className)}>
      <span className="v3-strip__track" role="img" aria-label={name}>
        {ticks.map((note, index) => (
          <span
            key={`note-${index}`}
            className="v3-strip__note"
            style={{ left: `${(note.at * 100).toFixed(2)}%` } as CSSProperties}
            aria-hidden="true"
          >
            <span className="v3-strip__note-label">{note.label}</span>
          </span>
        ))}
        {dots.map((mark, index) => (
          <span
            key={index}
            className="v3-strip__mark"
            style={{ left: `${(mark.at * 100).toFixed(2)}%` } as CSSProperties}
            data-label={mark.label}
            aria-hidden="true"
          />
        ))}
      </span>
      <span className="v3-strip__ends" aria-hidden="true">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </span>
  )
}
