import { Card } from '@/components/ui/card'

export type QuickFact = { label: string; value: string }

type Props = {
  /** e.g. "Bend", "Caldera Springs", "Old Town" */
  placeName: string
  /** For aria-labelledby and id on h2 */
  headingId: string
  /** Left column: description and any extra content. Keep condensed. */
  children: React.ReactNode
  /** Right column: key-value list. Omit entries with empty value to keep compact. */
  quickFacts: QuickFact[]
}

/**
 * Shared About section for city, community, and neighborhood pages.
 * Two columns: left = description/content, right = Quick facts card.
 * Same layout and styling everywhere for consistency.
 */
export default function GeoAboutSection({ placeName, headingId, children, quickFacts }: Props) {
  const visibleFacts = quickFacts.filter((f) => f.value != null && String(f.value).trim() !== '')

  return (
    <section className="bg-card px-4 py-10 sm:px-6 sm:py-12" aria-labelledby={headingId}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <h2 id={headingId} className="text-2xl font-bold tracking-tight text-primary">
              About {placeName}
            </h2>
            <div className="mt-4 text-muted-foreground">{children}</div>
          </div>
          {visibleFacts.length > 0 && (
            <div className="lg:pl-2">
              <Card className="p-5 shadow-sm">
                <h3 className="font-bold text-primary">Quick facts</h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  {visibleFacts.map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
