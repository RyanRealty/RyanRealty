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
}: V3MosBarsProps) {
  const uid = useId()
  const tipId = `${uid}-tip`
  const [open, setOpen] = useState(false)
  const plot = useMemo(
    () =>
      buildPairPlot([
        { name: homesName, value: homesValue, label: homesLabel },
        { name: salesName, value: salesValue, label: salesLabel },
      ]),
    [homesName, homesValue, homesLabel, salesName, salesValue, salesLabel],
  )

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])

  if (!plot) return null

  // Whole-number faces count up (beui-number / rareui); fractional sales stay static.
  const valueFace = (label: string, value: number) => {
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
        {plot.bars.map((bar) => (
          <button
            key={bar.index}
            type="button"
            className="v3-mos__barrow"
            aria-describedby={open ? tipId : undefined}
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
            <span className="v3-mos__barvalue">
              {valueFace(bar.label, bar.index === 0 ? homesValue : salesValue)}
            </span>
          </button>
        ))}
      </div>
      {open ? (
        <div className="v3-mos__tip" id={tipId} role="status">
          {/* More data than the bars: the ratio and the dated source — not a
              second label of the same two numerals (SITE-84 evaluator). */}
          <p>
            Supply ratio: {homesLabel} detached ÷ {salesLabel} sales a month.
          </p>
          <p className="v3-mos__tip-source">{tooltip.source}</p>
        </div>
      ) : null}
      <V3SourceLine source={source} asOf={asOf} sourceName={sourceName} />
    </figure>
  )
}
