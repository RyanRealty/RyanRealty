/**
 * V3 CHART CARD. One chart-room form as a page card: the finding as its
 * title, one display line under it, the chart (or a segmented set of views of
 * one figure), and the section 0 trace folded into a collapsed disclosure
 * labeled Source (Matt 2026-08-19: traces live in a disclosure, never visible
 * paragraphs). An atom, not a seventh pattern — V3Instrument mounts a grid of
 * these under its figures the way it already mounts V3Chart.
 *
 * Authoring discipline the type cannot carry: the title is a FINDING of six
 * words or fewer, computed from the same rows the chart draws so it cannot go
 * stale against them; the line is fourteen words or fewer; there is no other
 * prose on the card.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import { V3Chart, type V3ChartProps } from './V3Chart'
import { V3ChartSwitch, type V3ChartSwitchItem } from './V3ChartSwitch.client'
import './tokens.css'
import './V3Chart.css'
import './V3ChartCard.css'

/** A segmented set of server-rendered views of one figure. */
export type V3ChartCardSwitch = {
  /** Accessible name of the control, e.g. "Range" or "Measure". */
  label: V3Text
  items: readonly V3ChartSwitchItem[]
  /** One chart per item, same order. */
  panels: readonly V3ChartProps[]
  defaultKey?: string
}

export type V3ChartCardProps = {
  /** The finding. Six words or fewer. */
  title: V3Text
  /** The one display line under the title. Fourteen words or fewer. */
  line?: V3Text
  /**
   * The section 0 trace, rendered inside the collapsed Source disclosure:
   * source, filter, window, population, and the figures the title asserts.
   */
  source: V3Text
  /** Spans both columns of the card grid, for a dense series. */
  wide?: boolean
  /** Exactly one of chart / switcher. */
  chart?: V3ChartProps
  switcher?: V3ChartCardSwitch
  id?: string
  className?: string
}

export function V3ChartCard({
  title,
  line,
  source,
  wide,
  chart,
  switcher,
  id,
  className,
}: V3ChartCardProps) {
  if ((chart ? 1 : 0) + (switcher ? 1 : 0) !== 1) {
    throw new Error(
      'V3ChartCard: pass exactly one of chart or switcher. A card with no ' +
        'series under its finding asserts a figure it does not show.',
    )
  }
  const titleId = id ? `${id}-title` : undefined
  return (
    <article
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-chartcard', wide && 'v3-chartcard--wide', className)}
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : title}
    >
      <h3 id={titleId} className="v3-chartcard__title">
        {title}
      </h3>
      {line ? <p className="v3-chartcard__line">{line}</p> : null}
      {chart ? (
        <V3Chart {...chart} id={chart.id ?? (id ? `${id}-chart` : undefined)} />
      ) : null}
      {switcher ? (
        <V3ChartSwitch
          label={switcher.label}
          items={switcher.items}
          defaultKey={switcher.defaultKey}
        >
          {switcher.panels.map((panel, i) => (
            <V3Chart
              key={switcher.items[i]?.key ?? i}
              {...panel}
              id={panel.id ?? (id ? `${id}-${switcher.items[i]?.key ?? i}` : undefined)}
            />
          ))}
        </V3ChartSwitch>
      ) : null}
      <details className="v3-chartcard__source">
        <summary className="v3-chartcard__source-summary">Source</summary>
        <p className="v3-chartcard__source-body">{source}</p>
      </details>
    </article>
  )
}
