'use client'

/**
 * V3 CHART SWITCH. The segmented control the chart-room forms put over a set
 * of pre-rendered views of one figure (a range: 1Y / 5Y / MAX; a sort; a
 * comparison). Not a pattern — an atom the patterns and pages mount.
 *
 * The panels arrive server-rendered as children, one per item, so the data
 * work stays on the server and this island only toggles which panel shows.
 * Nothing here fetches, formats, or computes a figure. Hidden panels stay in
 * the DOM (`hidden`), so switching is instant and printable content is not
 * re-requested.
 *
 * Semantics: a tablist. Roving tabindex, arrow keys move and select
 * (ARIA APG "Tabs with Automatic Activation"). Every control carries its
 * accessible name in the type (V3Text), like the rest of the barrel.
 */
import { Children, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Chart.css'

export type V3ChartSwitchItem = {
  /** Stable key for the view. */
  key: string
  /** The control's visible + accessible name, e.g. "5Y", "Supply". */
  label: V3Text
}

export type V3ChartSwitchProps = {
  /** Accessible name of the whole control, e.g. "Range". */
  label: V3Text
  items: readonly V3ChartSwitchItem[]
  /**
   * One panel per item, same order. Optional only so createElement callers
   * can pass panels positionally — the runtime check still refuses a panel
   * count that does not match the items.
   */
  children?: ReactNode
  /** items[].key to open first. Defaults to the first item. */
  defaultKey?: string
  className?: string
}

export function V3ChartSwitch({ label, items, children, defaultKey, className }: V3ChartSwitchProps) {
  const panels = Children.toArray(children)
  if (items.length === 0) {
    throw new Error('V3ChartSwitch: items is empty. A switch with nothing to switch is not rendered.')
  }
  if (panels.length !== items.length) {
    throw new Error(
      `V3ChartSwitch: ${items.length} item(s) but ${panels.length} panel child(ren). ` +
        'Pass exactly one panel per item, in the same order.',
    )
  }

  const baseId = useId()
  const defaultIndex = Math.max(
    0,
    items.findIndex((it) => it.key === defaultKey),
  )
  const [active, setActive] = useState(defaultIndex)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (index: number) => {
    const next = (index + items.length) % items.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      select(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      select(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      select(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      select(items.length - 1)
    }
  }

  return (
    <div className={cn(V3_ROOT_CLASS, 'v3-chart-switch', className)}>
      <div role="tablist" aria-label={label} className="v3-chart-switch__seg">
        {items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${it.key}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel-${it.key}`}
            tabIndex={i === active ? 0 : -1}
            className={cn('v3-chart-switch__tab', i === active && 'v3-chart-switch__tab--on')}
            onClick={() => select(i)}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {items.map((it, i) => (
        <div
          key={it.key}
          role="tabpanel"
          id={`${baseId}-panel-${it.key}`}
          aria-labelledby={`${baseId}-tab-${it.key}`}
          hidden={i !== active}
          className="v3-chart-switch__panel"
        >
          {panels[i]}
        </div>
      ))}
    </div>
  )
}
