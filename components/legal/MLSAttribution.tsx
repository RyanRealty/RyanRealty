/**
 * MLS / Oregon Data Share attribution. Required on every page that displays MLS data.
 * ODS Rules Sections 5-3/5-4.
 */

export interface MLSAttributionProps {
  /** Optional: last data update timestamp for display */
  lastUpdated?: Date | string | null
  /** Optional: compact style for footer */
  compact?: boolean
}

export default function MLSAttribution({ lastUpdated, compact = false }: MLSAttributionProps) {
  const dateStr =
    lastUpdated != null
      ? new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : null

  if (compact) {
    return (
      <p className="text-xs text-primary-foreground/70">
        Listing data provided by Oregon Data Share. All information deemed reliable but not guaranteed.
        {dateStr && <span className="ml-1">Data as of {dateStr}.</span>}
      </p>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground" aria-label="MLS attribution">
      <p>
        Listing data provided by Oregon Data Share. All information deemed reliable but not guaranteed.
        {dateStr && (
          <span className="mt-1 block">Last updated: {dateStr}.</span>
        )}
      </p>
    </section>
  )
}
