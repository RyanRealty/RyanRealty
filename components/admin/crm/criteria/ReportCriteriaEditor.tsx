'use client'

/**
 * ReportCriteriaEditor — a reusable, broker-friendly editor for a market
 * report subscription: "Send a [monthly] market report for [Bend and
 * Tetherow]". The cadence is an inline Select; the areas bracket opens a
 * searchable multi-select over the real area registry. Below the sentence
 * controls, the live plain-English sentence restates the subscription.
 *
 * Area options are PROPS-PASSED, not self-loaded: the parent server-loads
 * them once (listAvailableMarketReportAreas() from
 * lib/data/crm/getContactReportSubscriptions in a server component, or
 * getSubscriptionEditOptionsAction from a client dialog) and hands them down.
 * That keeps this component free of data fetching and lets one options load
 * serve many editors on a page. Areas already on the subscription but missing
 * from the registry stay visible so a save never silently drops them.
 *
 * Fully controlled: every edit calls onChange with the next
 * { areas, frequency } pair. The parent owns persistence.
 *
 * Admin v2 (11F): off shadcn and onto the locked admin language. The cadence
 * Select -> ToolbarSelect (a native select, which the platform makes
 * accessible for free). The areas Popover+cmdk -> a native <details>
 * disclosure holding a SearchField and one ToolbarCheck per area — the same
 * anchored-panel shape InboxThreadList uses. NOT Combobox: that primitive is
 * single-select and closes its panel on every choice, so picking three areas
 * would mean opening it three times. Checkboxes keep multi-select, keep the
 * selected/unselected state visible without a tick glyph, and stay
 * Tab-and-Space operable from the keyboard.
 */

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { SearchField, ToolbarCheck, ToolbarSelect } from '@/components/admin/v2'
import {
  reportCriteriaSentence,
  resolveAreaLabels,
  summarizeAreaLabels,
  type GeoOption,
  type ReportFrequency,
} from '@/components/admin/crm/criteria/criteria-sentence'

export type ReportCriteriaEditorProps = {
  /** The subscribed area slugs (crm_report_areas keys / geo slugs). */
  areas: string[]
  frequency: ReportFrequency
  /** Valid area options, server-loaded by the parent (see file header). */
  areaOptions: readonly GeoOption[]
  /** Called with the next full criteria on every edit. */
  onChange: (next: { areas: string[]; frequency: ReportFrequency }) => void
  disabled?: boolean
  className?: string
}

const FREQUENCY_OPTIONS: ReadonlyArray<{ value: ReportFrequency; label: string }> = [
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
  { value: 'quarterly', label: 'quarterly' },
]

/**
 * Layout-only sizing so inline controls clear 44 px on touch screens. An inline
 * style rather than a `min-h-11` class: admin-v2.css is UNLAYERED, so
 * .av2-input--bar's 32px min-height outranks any Tailwind utility no matter its
 * specificity (the @layer lesson recorded in admin-v2.css itself).
 */
const TOUCH_TRIGGER = { minHeight: 'var(--a-touch)' } as const

/** The areas panel, anchored under its summary. */
const AREAS_PANEL = {
  position: 'absolute',
  left: 0,
  top: '100%',
  marginTop: 4,
  zIndex: 30,
  width: 288,
  maxWidth: '90vw',
  background: 'var(--a-bg)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  boxShadow: 'var(--a-shadow-overlay)',
  padding: 'var(--a-s2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--a-s2)',
} as const

export function ReportCriteriaEditor({
  areas,
  frequency,
  areaOptions,
  onChange,
  disabled = false,
  className,
}: ReportCriteriaEditorProps) {
  const [areasOpen, setAreasOpen] = useState(false)
  const [areaQuery, setAreaQuery] = useState('')

  // Keep already-subscribed areas visible even when the registry no longer
  // offers them, so editing never silently drops a subscription.
  const options = useMemo(() => {
    const known = new Set(areaOptions.map((o) => o.slug))
    const extras = areas
      .filter((slug) => !known.has(slug))
      .map((slug) => ({ slug, label: slug }))
    return [...areaOptions, ...extras]
  }, [areaOptions, areas])

  const labels = resolveAreaLabels(areas, options)
  const sentence = reportCriteriaSentence(areas, frequency, options)
  const query = areaQuery.trim().toLowerCase()
  const visibleOptions = query
    ? options.filter((o) => o.label.toLowerCase().includes(query))
    : options

  function toggleArea(slug: string) {
    const next = areas.includes(slug) ? areas.filter((a) => a !== slug) : [...areas, slug]
    onChange({ areas: next, frequency })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* The sentence */}
      <div
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2"
        style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
      >
        <span>Send a</span>

        <ToolbarSelect
          aria-label="Report cadence"
          value={frequency}
          onChange={(e) => onChange({ areas, frequency: e.target.value as ReportFrequency })}
          disabled={disabled}
          style={TOUCH_TRIGGER}
        >
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </ToolbarSelect>

        <span>market report for</span>

        <details
          open={areasOpen}
          onToggle={(e) => setAreasOpen(e.currentTarget.open)}
          style={{ position: 'relative', maxWidth: '100%' }}
        >
          <summary
            className="av2-btn av2-btn--quiet"
            aria-expanded={areasOpen}
            aria-label="Report areas"
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : undefined}
            style={{
              ...TOUCH_TRIGGER,
              maxWidth: '100%',
              ...(disabled ? { pointerEvents: 'none' as const, opacity: 0.5 } : null),
            }}
          >
            <span className="truncate">{summarizeAreaLabels(labels)}</span>
          </summary>
          <div style={AREAS_PANEL}>
            <SearchField
              aria-label="Search areas"
              placeholder="Search areas"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              disabled={disabled}
              style={{ maxWidth: '100%' }}
            />
            <div
              role="group"
              aria-label="Report areas"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {visibleOptions.length === 0 ? (
                <p style={{ margin: 0, padding: 'var(--a-s2)', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  No area matches that search.
                </p>
              ) : (
                visibleOptions.map((option) => (
                  <ToolbarCheck
                    key={option.slug}
                    label={option.label}
                    checked={areas.includes(option.slug)}
                    onChange={() => toggleArea(option.slug)}
                    disabled={disabled}
                    labelStyle={{ minHeight: 'var(--a-touch)', padding: '0 var(--a-s1)' }}
                  />
                ))
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Live plain-English restatement */}
      <div
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-md)',
          background: 'var(--a-inset)',
          padding: '8px var(--a-s3)',
        }}
      >
        <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }} aria-live="polite">
          {sentence}
        </p>
      </div>
    </div>
  )
}

export default ReportCriteriaEditor
