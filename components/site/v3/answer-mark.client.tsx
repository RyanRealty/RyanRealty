'use client'

/**
 * THE DRAWING ON AN ANSWER ROW, AS AN INSTRUMENT (site queue SITE-08, pass 2).
 *
 * The first cut of V3Answers drew each figure once and stopped: a dot on a
 * rule, a run of dots for a count. Correct, sourced, and — the separate
 * evaluator's words on all three place grains — "a single static mark on a
 * number-line with no hover, scrub, or tooltip", which "meets the letter of
 * 'click reveals more data' but the revealed chart itself is not interrogable".
 * TASTE.md's chart-craft bar says the same thing first: "A chart the reader
 * cannot interrogate is a picture of a chart."
 *
 * So the rule is something the reader RUNS ALONG, and the tally is something
 * they COUNT THROUGH.
 *
 *   scale — pointer, drag or arrow keys move a crosshair down the rule. The
 *           readout under it says what the rule says at that position, and
 *           snaps to a published mark (this place, the parent city, the asking
 *           price) when the reader is near one, so pointing at the dot always
 *           reads the dot's own figure rather than a coordinate 0.2 off it.
 *   tally — the pointer sweeps the marks and the readout counts them: "47 of
 *           120". A person can find the hundredth home. Leaving resets to the
 *           whole count. This is the count made physical, which is the only
 *           interrogation a count deserves.
 *
 * §0 IS NOT WEAKENED BY A RULER. Everything this component can print is either
 * a figure the page already published with its trace (the subject, the named
 * context) or a coordinate the reader chose, and a chosen coordinate is
 * written as one — "at 98.3%", never "98.3%" standing alone where it could be
 * read as this place's number. No value is derived, projected or estimated.
 *
 * NO-JS AND PRE-HYDRATION. Every element the static version drew is still
 * drawn by the server render of this component, in the same DOM order, with
 * the readout already holding the subject reading. Handlers are the only thing
 * hydration adds; nothing appears or moves on load (PUBLIC_UI.md section 5,
 * and TASTE's reduced-motion rule: same graphic, already complete).
 *
 * ACCESSIBILITY. The drawing is one `role="img"` with a label that reads the
 * whole thing as a sentence, so a screen reader gets one clean reading instead
 * of a pile of positioned spans; the interactive readout is aria-hidden
 * because it can only ever restate that label or a position the reader chose
 * with a pointer they do not have. It is focusable, so the crosshair is
 * reachable from the keyboard.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  answerScaleGeometry,
  answerScaleReadAt,
  answerTallyCount,
  formatScaleValue,
  isTallyGroupEnd,
  type ScaleReading,
  type V3AnswerMark,
  type V3AnswerScale,
  type V3AnswerTally,
} from './V3Answers.marks'

/** How far one arrow key moves the crosshair: fortieths of the rule. */
const KEY_STEP = 1 / 40

function fractionFromEvent(el: HTMLElement, clientX: number): number {
  const box = el.getBoundingClientRect()
  if (box.width <= 0) return 0
  return (clientX - box.left) / box.width
}

/**
 * The readout, in words. A named mark reads as "<name> · <value>"; a free
 * position reads as "at <value>", which is what it is.
 */
function readoutText(scale: V3AnswerScale, reading: ScaleReading): string {
  const value = formatScaleValue(reading.value, scale.format)
  const band = reading.band ? ` · ${reading.band}` : ''
  if (reading.named && reading.namedLabel) return `${reading.namedLabel} · ${value}${band}`
  if (reading.named) return `${value}${band}`
  return `at ${value}${band}`
}

function scaleLabel(scale: V3AnswerScale, subjectReading: ScaleReading | null): string {
  const value = formatScaleValue(scale.at, scale.format)
  const who = scale.subjectLabel?.trim()
  const band = subjectReading?.band ? `, in the ${subjectReading.band} band` : ''
  const context = scale.context ? `, against ${scale.context.label}` : ''
  return `${who ? `${who}: ` : ''}${value} on a scale from ${scale.minLabel} to ${scale.maxLabel}${band}${context}.`
}

function ScaleMark({ scale }: { scale: V3AnswerScale }) {
  const geometry = useMemo(() => answerScaleGeometry(scale), [scale])
  const subjectReading = useMemo(() => answerScaleReadAt(scale, geometry ? geometry.atPct / 100 : 0), [scale, geometry])
  const [reading, setReading] = useState<ScaleReading | null>(null)
  const fieldRef = useRef<HTMLDivElement | null>(null)

  const readAt = useCallback(
    (fraction: number) => setReading(answerScaleReadAt(scale, fraction)),
    [scale],
  )

  const onPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = fieldRef.current
      if (!el) return
      readAt(fractionFromEvent(el, event.clientX))
    },
    [readAt],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = reading ?? subjectReading
      if (!current) return
      const at = current.atPct / 100
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        readAt(at + KEY_STEP)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        readAt(at - KEY_STEP)
      } else if (event.key === 'Home') {
        event.preventDefault()
        readAt(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        readAt(1)
      } else if (event.key === 'Escape') {
        setReading(null)
      }
    },
    [reading, subjectReading, readAt],
  )

  if (!geometry || !subjectReading) return null
  const { atPct, contextPct, bands } = geometry
  const shown = reading ?? subjectReading
  // The chip rides the crosshair but is not allowed off either end of the
  // rule, which at 375 is the difference between a readout and a scrollbar.
  const tipPct = Math.min(Math.max(shown.atPct, 10), 90)

  return (
    <div
      className={cn('v3-answers__scale', scale.exception && 'v3-answers__scale--exception')}
    >
      <div
        ref={fieldRef}
        className={cn('v3-answers__scale-field', reading && 'v3-answers__scale-field--live')}
        role="img"
        aria-label={scaleLabel(scale, subjectReading)}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setReading(null)}
        onBlur={() => setReading(null)}
        onKeyDown={onKeyDown}
      >
        {bands.length > 0 ? (
          <div className="v3-answers__scale-bands" aria-hidden="true">
            {bands.map((band) => (
              <span
                key={band.label}
                className={cn(
                  'v3-answers__scale-band',
                  band.active && 'v3-answers__scale-band--is',
                  // Only while something is DRIVING the crosshair: at rest the
                  // outline would sit on the answer's own band and say nothing.
                  reading != null && shown.band === band.label && 'v3-answers__scale-band--at',
                )}
                style={{ left: `${band.fromPct}%`, width: `${band.widthPct}%` }}
              >
                <span className="v3-answers__scale-band-label">{band.label}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="v3-answers__scale-rule" aria-hidden="true">
          {contextPct != null && scale.context ? (
            <span
              className={cn(
                'v3-answers__scale-context',
                reading != null && shown.named === 'context' && 'v3-answers__scale-context--at',
              )}
              style={{ left: `${contextPct}%` }}
            >
              <span className="v3-answers__scale-context-label">{scale.context.label}</span>
            </span>
          ) : null}
          <span
            className={cn(
              'v3-answers__scale-at',
              reading != null && shown.named === 'subject' && 'v3-answers__scale-at--at',
            )}
            style={{ left: `${atPct}%` }}
          />
        </div>
        {/* The crosshair. It exists only while a pointer or a key is driving
            it — an always-on second vertical line would compete with the
            context tick for the same reading. */}
        {reading ? (
          <span className="v3-answers__scale-cross" style={{ left: `${reading.atPct}%` }} aria-hidden="true" />
        ) : null}
        <span
          className="v3-answers__scale-tip"
          style={{ left: `${tipPct}%` }}
          aria-hidden="true"
        >
          {formatScaleValue(shown.value, scale.format)}
        </span>
        <div className="v3-answers__scale-ends" aria-hidden="true">
          <span>{scale.minLabel}</span>
          <span>{scale.maxLabel}</span>
        </div>
      </div>
      <p className="v3-answers__scale-readout" aria-hidden="true">
        {readoutText(scale, shown)}
      </p>
    </div>
  )
}

type TallyPointer = { run: 'subject' | 'context'; upTo: number }

/**
 * A run of marks. One per counted thing, grouped in fives, and countable
 * under the pointer: the marks up to it are the count and the rest fall back,
 * so a reader can find the hundredth home instead of taking the numeral on
 * trust.
 */
function TallyRun({
  count,
  label,
  aria,
  live,
  onCount,
  onLeave,
  context,
}: {
  count: number
  label: string | null
  aria: string
  live: number | null
  onCount: (upTo: number) => void
  onLeave: () => void
  context: boolean
}) {
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = live ?? count
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        onCount(Math.min(current + 1, count))
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        onCount(Math.max(current - 1, 1))
      } else if (event.key === 'Home') {
        event.preventDefault()
        onCount(1)
      } else if (event.key === 'End') {
        event.preventDefault()
        onCount(count)
      } else if (event.key === 'Escape') {
        onLeave()
      }
    },
    [live, count, onCount, onLeave],
  )

  return (
    <div className={cn('v3-answers__tally-run', context && 'v3-answers__tally-run--context')}>
      {label ? <span className="v3-answers__tally-run-label">{label}</span> : null}
      <div
        className={cn('v3-answers__tally-marks', live != null && 'v3-answers__tally-marks--live')}
        role="img"
        aria-label={aria}
        tabIndex={0}
        onPointerLeave={onLeave}
        onBlur={onLeave}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            className={cn(
              'v3-answers__tally-dot',
              isTallyGroupEnd(i, count) && 'v3-answers__tally-dot--five',
              live != null && i < live && 'v3-answers__tally-dot--counted',
            )}
            key={i}
            onPointerEnter={() => onCount(i + 1)}
            onPointerDown={() => onCount(i + 1)}
          />
        ))}
      </div>
    </div>
  )
}

function TallyMark({ tally }: { tally: V3AnswerTally }) {
  const count = useMemo(() => answerTallyCount(tally), [tally])
  /**
   * The SECOND run: the same count over a different window, drawn under the
   * first. Two lengths beat two numerals, and it is refused on exactly the
   * grounds a lone count is (`answerTallyCount`), so a comparison can never
   * draw where the count itself would not.
   */
  const contextCount = useMemo(
    () =>
      tally.context
        ? answerTallyCount({ kind: 'tally', count: tally.context.count, unitLabel: tally.unitLabel })
        : null,
    [tally],
  )
  const [pointer, setPointer] = useState<TallyPointer | null>(null)

  if (count == null) return null
  const plural = tally.unitPlural?.trim() || `${tally.unitLabel}s`
  const runLabel = tally.runLabel?.trim() || null
  const contextLabel = tally.context?.label.trim() || null
  const showContext = contextCount != null && contextLabel != null

  const say = (n: number, total: number) =>
    `${n.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`

  return (
    <div className="v3-answers__tally">
      <TallyRun
        count={count}
        label={showContext ? runLabel : null}
        aria={`${count.toLocaleString('en-US')} ${plural}${runLabel ? `, ${runLabel}` : ''}, one mark each.`}
        live={pointer?.run === 'subject' ? pointer.upTo : null}
        onCount={(upTo) => setPointer({ run: 'subject', upTo })}
        onLeave={() => setPointer(null)}
        context={false}
      />
      {showContext ? (
        <TallyRun
          count={contextCount}
          label={contextLabel}
          aria={`${contextCount.toLocaleString('en-US')} ${plural}, ${contextLabel}, one mark each.`}
          live={pointer?.run === 'context' ? pointer.upTo : null}
          onCount={(upTo) => setPointer({ run: 'context', upTo })}
          onLeave={() => setPointer(null)}
          context
        />
      ) : null}
      <p className="v3-answers__tally-readout" aria-hidden="true">
        {pointer == null
          ? `${count.toLocaleString('en-US')} ${plural}${showContext ? `, against ${contextCount.toLocaleString('en-US')} ${contextLabel}` : ''}`
          : pointer.run === 'subject'
            ? say(pointer.upTo, count)
            : say(pointer.upTo, contextCount ?? 0)}
      </p>
    </div>
  )
}

/**
 * The drawing an open answer row leads with, or nothing.
 *
 * NOT A BARREL PRIMITIVE, and the filename says so. This is V3Answers' own
 * drawing — the same relationship ./V3Answers.marks.ts has to it — reached only
 * through a row's `figure.mark`. A second caller putting a value on a rule
 * outside a question set would be a second way to draw one thing, which is how
 * one site becomes two (TASTE, consistency).
 */
export function AnswerMarkDrawing({ mark }: { mark: V3AnswerMark }) {
  if (mark.kind === 'tally') return <TallyMark tally={mark} />
  return <ScaleMark scale={mark} />
}
