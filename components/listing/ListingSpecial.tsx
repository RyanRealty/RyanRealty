'use client'

/**
 * "What Makes This Property Special" — listing agent voice / curated highlights.
 * Per cursor-listing-page-instructions: magazine pull-quote feel for luxury; before full description.
 */
type Props = {
  /** First 3–5 sentences of description, or bullet highlights if we had highlight_bullets */
  highlights: string[]
  /** Optional: e.g. "Private .78-acre lot", "3-car garage", "Caldera Springs community" */
  featureTags?: string[]
}

export default function ListingSpecial({ highlights, featureTags }: Props) {
  const hasHighlights = highlights.length > 0
  const hasTags = featureTags && featureTags.length > 0
  if (!hasHighlights && !hasTags) return null

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="listing-special-heading">
      <h2 id="listing-special-heading" className="mb-4 text-lg font-semibold text-foreground">
        What makes this property special
      </h2>
      {hasHighlights && (
        <blockquote className="border-l-4 border-success pl-4 text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed">
          {highlights.map((s, i) => (
            <p key={i} className={i > 0 ? 'mt-3' : ''}>
              {s}
            </p>
          ))}
        </blockquote>
      )}
      {hasTags && (
        <div className={`mt-4 flex flex-wrap gap-2 ${hasHighlights ? 'border-t border-border pt-4' : ''}`}>
          {featureTags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
