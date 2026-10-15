import {
  publishListingQuickFacts,
  type ListingQuickFactsInput,
} from '@/lib/listing/publish-listing-quick-facts'

/**
 * Server-rendered Quick facts answer block for listing detail.
 * Plain sentences plus a definition list. Missing fields never print.
 */
export function ListingQuickFacts(input: ListingQuickFactsInput) {
  const facts = publishListingQuickFacts(input)
  if (!facts) return null
  return (
    <section className="listing-quick-facts" aria-labelledby="listing-quick-facts-heading">
      <h2 id="listing-quick-facts-heading" className="sec-title">
        At a glance
      </h2>
      <p className="listing-quick-facts__answer">{facts.sentence}</p>
      {/* UX review F28: the rows repeated the Facts section below, so the
          answer block keeps the sentence and Facts carries the table. */}
    </section>
  )
}
