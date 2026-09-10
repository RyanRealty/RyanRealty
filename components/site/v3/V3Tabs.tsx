'use client'

/**
 * Sliding-indicator tabs. Wraps the installed beUI tabs
 * (`components/motion/tabs.tsx`): cream track, navy pill that glides via
 * shared layout, no glass, no purple. Tokens only.
 *
 * Homepage Buy | Sell still keeps native radios in the page for no-JS; this
 * primitive is the visual control. Pass `items` when the triggers should
 * check those radios.
 */
import { Children, isValidElement, type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Tabs.css'

export type V3TabItem = {
  value: string
  label: ReactNode
  /** When set, clicking the tab also checks this radio (homepage no-JS pair). */
  htmlFor?: string
}

export type V3TabsProps = {
  /** Accessible name for the control group. */
  label: string
  /** How many tabs — drives the indicator width when using children. */
  count: number
  /**
   * Which tab is selected (0-based). Omit when a parent stylesheet drives
   * `--v3-tabs-index` from native radios (homepage Buy | Sell, no-JS).
   */
  index?: number
  value?: string
  onValueChange?: (value: string) => void
  items?: readonly V3TabItem[]
  children?: ReactNode
  className?: string
}

function checkRadio(htmlFor?: string) {
  if (!htmlFor || typeof document === 'undefined') return
  const el = document.getElementById(htmlFor)
  if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) {
    el.checked = true
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

export function V3Tabs({
  label,
  count,
  index,
  value,
  onValueChange,
  items,
  children,
  className,
}: V3TabsProps) {
  const fromItems = items?.length
    ? items.map((item) => ({ value: item.value, label: item.label, htmlFor: item.htmlFor }))
    : Children.toArray(children).map((child, i) => ({
        value: String(i),
        label: isValidElement(child) ? child : child,
        htmlFor: undefined as string | undefined,
      }))
  const safeCount = Math.max(1, fromItems.length || Math.floor(count) || 1)
  const current =
    value ??
    (index != null ? String(Math.min(Math.max(0, Math.floor(index)), safeCount - 1)) : undefined)

  return (
    <div className={cn(V3_ROOT_CLASS, 'v3-tabs', className)} role="group" aria-label={label}>
      <Tabs
        variant="pill"
        value={current}
        defaultValue={fromItems[0]?.value ?? '0'}
        onValueChange={(next) => {
          const hit = fromItems.find((row) => row.value === next)
          checkRadio(hit?.htmlFor)
          onValueChange?.(next)
        }}
      >
        <TabsList className="v3-tabs__list">
          {fromItems.map((row) => (
            <TabsTrigger
              key={row.value}
              value={row.value}
              className="v3-tabs__tab"
              indicatorClassName="v3-tabs__indicator"
            >
              {row.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
