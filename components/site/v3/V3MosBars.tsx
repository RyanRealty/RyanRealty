'use client'

/**
 * Compact two-bar months-of-supply overlay for a place opening (SITE-43).
 *
 * DATA_GRAPHICS: homes for sale vs a month of sales on one shared scale.
 * Geometry is lib/charts/plot.ts buildPairPlot, the same function V3Drawing
 * uses. Hover, tap and keyboard reveal both counts and the section-0 source
 * line. Figures arrive preformatted (ci:public-v3 rule 3). Omit at the caller
 * when leftover HUD cannot publish MOS.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { buildPairPlot } from '@/lib/charts/plot'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3SourceLine } from './atoms'
import { DigitSwap } from '@/components/motion/digit-swap'
import { V3Number } from './V3Number.client'
import './tokens.css'
import './V3MosBars.css'

export type V3MosBarsProps = {
  caption: string
  plainLabel: string
  homesName: string
  homesLabel: string
  homesValue: number
  salesName: string
  salesLabel: string
  salesValue: number
  source: string
  asOf?: string | null
  sourceName?: string
  tooltip: { homes: string; sales: string; source: string }
  id?: string
  className?: string
  /**
   * beUI DigitSwap on the two sourced counts (slots that roll).
   * Opt-in — other MOS mounts keep the count-up face.
   */
  replay?: boolean
}

export function V3MosBars({
  caption,
  plainLabel,
  homesName,
  homesLabel,
  homesValue,
  salesName,
  salesLabel,
  salesValue,
  source,
  asOf,
  sourceName = 'Oregon Data Share',
  tooltip,
  id = 'place-mos',
  className,
  replay = false,
}: V3MosBarsProps) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [plays, setPlays] = useState(0)
  const [revealed, setRevealed] = useState(true)
  void tooltip
  const plot = useMemo(
    () =>
      buildPairPlot([
        { name: homesName, value: homesValue, label: homesLabel },
        { name: salesName, value: salesValue, label: salesLabel },
      ]),
    [homesName, homesValue, homesLabel, salesName, salesValue, salesLabel],
  )

  const show = useCallback(() => {
    setOpen(true)
  }, [])
  const hide = useCallback(() => setOpen(false), [])
  const replayDigits = useCallback(() => {
    setRevealed((current) => !current)
    setPlays((n) => n + 1)
  }, [])

  if (!plot) return null

  // Whole-number faces count up (beui-number / rareui); fractional sales stay static.
  // `replay` is official DigitSwapPreview (beui.dev/components/motion/number):
  // rest = live sourced face; Animate toggles MASKED ↔ revealed
  // (value + animationKey) so a 400–700ms still is mid-swap. Hover does not remount.
  void open
  const previewRevealed = revealed
  const valueFace = (label: string, value: number) => {
    if (replay) {
      const live = label
      const digits = live.replace(/\D/g, '')
      const suffixLength = Math.min(2, digits.length)
      let seen = 0
      const masked = live.replace(/[0-9]/g, () => {
        const index = seen
        seen += 1
        return index >= digits.length - suffixLength ? digits[index]! : '•'
      })
      return (
        <DigitSwap
          value={previewRevealed ? live : masked}
          animationKey={`${previewRevealed ? 'revealed' : 'masked'}-${plays}`}
          direction={previewRevealed ? 'up' : 'down'}
          suffixLength={suffixLength}
          duration={1.2}
          stagger={0.05}
          className="v3-mos__swap font-mono text-lg tracking-[0.08em] tabular-nums"
        />
      )
    }
    const whole = Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-9
    if (!whole) return label
    const n = Math.round(value)
    return <V3Number key={`${id}-${n}-${label}`} value={n} formatted={label} />
  }

  return (
    <figure
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-mos', className)}
      aria-labelledby={`${uid}-caption`}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <p className="v3-mos__plain">{plainLabel}</p>
      <p className="v3-mos__caption" id={`${uid}-caption`}>
        {caption}
      </p>
      <div className="v3-mos__pair">
        {plot.bars.map((bar) => {
          const value = bar.index === 0 ? homesValue : salesValue
          const face = valueFace(bar.label, value)
          return (
            <button
              key={bar.index}
              type="button"
              className="v3-mos__barrow"
              onMouseEnter={show}
              onFocus={show}
              onClick={show}
            >
              <span className="v3-mos__barname">{bar.name}</span>
              <span className="v3-mos__bartrack">
                <span
                  className="v3-mos__barfill"
                  style={{ ['--v3-mos-pct' as string]: `${bar.pct.toFixed(2)}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className="v3-mos__barvalue">{face}</span>
            </button>
          )
        })}
      </div>
      {replay ? (
        <button
          type="button"
          className="v3-mos__animate"
          onClick={replayDigits}
        >
          Animate
        </button>
      ) : null}
      <V3SourceLine source={source} asOf={asOf} sourceName={sourceName} open={replay} />
    </figure>
  )
}
