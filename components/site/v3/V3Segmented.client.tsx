'use client'
/**
 * A controlled segmented control: two or three ways to look at one set.
 *
 * IT RENDERS NO PANELS, which is the whole reason it is not V3ChartSwitch.
 * That primitive renders every panel and hides the inactive ones, which is
 * right for three pre-rendered views of one chart and wrong for a switch over
 * six hundred links — it would put twelve hundred anchors and six hundred
 * duplicate hrefs in the document. It also owns its own active state, so
 * mounting it conditionally around a search field resets the visitor's choice
 * on every keystroke.
 *
 * So: controlled, value in, change out, and the caller renders whichever view
 * the value names.
 */
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Segmented.css'

export type V3SegmentedOption = { key: string; label: string }

export type V3SegmentedProps = {
  /** The group's accessible name, e.g. "How to browse". */
  label: string
  options: readonly V3SegmentedOption[]
  value: string
  onValueChange: (key: string) => void
  className?: string
}

export function V3Segmented({ label, options, value, onValueChange, className }: V3SegmentedProps) {
  return (
    <div className={cn('v3-segmented', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className="v3-segmented__item"
          aria-pressed={option.key === value}
          onClick={() => onValueChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
