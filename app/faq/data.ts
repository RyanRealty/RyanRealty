/**
 * app/faq/data.ts — canonical FAQ content for Ryan Realty (Bend, Central Oregon).
 *
 * SINGLE SOURCE OF TRUTH for:
 *   - app/faq/page.tsx (the hub — every answer visible as Quiet prose + FAQPage JSON-LD)
 *   - app/faq/[slug]/page.tsx (one standalone, indexable page per question)
 *   - the GBP Q&A seed when posted via the UI runbook
 *
 * Kept inside app/ (not lib/) on purpose: this is user-facing prose, and the
 * brand-voice gate (scripts/check-brand-voice.mjs) only scans app/ and
 * components/. Moving it to lib/ would silently drop it out of that gate's
 * coverage. See CLAUDE.md §2 (gated, not advisory) and §6 (a rule that lives
 * only in a directory the gate doesn't scan is not enforced).
 *
 * Brand voice: CLAUDE.md §2 (no em-dashes, no semicolons, no banned words).
 */

export interface FAQItem {
  question: string
  answer: string
  /** Slug — also the id used for the on-page anchor AND the /faq/[slug] route. */
  id: string
  category: 'Neighborhoods' | 'Buying' | 'Selling' | 'Working with us'
}

export const FAQ_CATEGORIES: ReadonlyArray<FAQItem['category']> = [
  'Neighborhoods',
  'Buying',
  'Selling',
  'Working with us',
]

export const FAQ: ReadonlyArray<FAQItem> = [
  {
    id: 'bend-neighborhoods',
    category: 'Neighborhoods',
    question: 'Do you specialize in any particular Bend neighborhoods?',
    answer:
      "We work the full Central Oregon region and spend the most time in Bend's named neighborhoods. Old Mill, Northwest Crossing, Tetherow, Broken Top, Awbrey Butte, Tumalo, and Vandevert Ranch are where we have the most active comp knowledge and the most relationships. Outside of Bend itself, Sisters, Redmond, Sunriver, and Crooked River Ranch are in our regular service area. Tell us the neighborhood and the budget. We will tell you plainly if it is not our area.",
  },
  {
    id: 'first-time-buyers',
    category: 'Buying',
    question: 'Do you work with first-time home buyers in Central Oregon?',
    answer:
      "Yes. A meaningful share of our business is first-time buyers. The Bend market can be intimidating for someone who has never bought before, so we walk you through the process at a pace that works for you. We tell you what you can and cannot get at your budget, including when that means waiting or adjusting the search.",
  },
  {
    // Design-audit (copy-clarity): the number-one seller question was missing
    // from the sitewide FAQ while /sell answered it — a seller researching
    // fees found nothing here and could read that as hiding the answer.
    // Answer mirrors the /sell FAQ verbatim (§0: one answer, one place edited).
    id: 'cost-to-list',
    category: 'Selling',
    question: 'What does it cost to list with you?',
    answer:
      'One plan at 3% of the sale price, with no add-on fees. That covers photography, the MLS listing, the full marketing plan, every showing, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer under the current rules. Commission is negotiable and every listing agreement is its own conversation.',
  },
  {
    id: 'timeline-selling',
    category: 'Selling',
    question: "What is the typical timeline for selling a home in Bend right now?",
    answer:
      "It depends on the price band and the neighborhood. A well-priced single-family home in Bend's $500K to $700K range tends to go pending in two to four weeks. Homes priced over $1M can take longer if the property has a narrower buyer pool. We pull live comps for your specific neighborhood and price band before we list, and we tell you what to expect.",
  },
  {
    id: 'investment',
    category: 'Buying',
    question: 'Do you have brokers who specialize in investment or second-home properties?',
    answer:
      'Yes. We work with second-home buyers across Bend, Sunriver, Vandevert Ranch, Crooked River Ranch, and the Cascade resort communities. We also work with investor clients looking at long-term holds, value-add opportunities, and 1031 exchanges. We do not manage rental properties for clients, but we work with property managers in town and can introduce you.',
  },
  {
    id: 'relocations',
    category: 'Buying',
    question: 'Can you help with relocations from out of state?',
    answer:
      'Yes. A large share of our business is relocations into Central Oregon from California, Washington, Colorado, and the Midwest. We do virtual tours, custom market reports for the neighborhoods you are considering, and we coordinate with lenders and title teams for a long-distance close. The conversation about what Bend is actually like, traffic, snow, wildfire risk, cost of living, happens before you make an offer, not after.',
  },
  {
    id: 'expired-listing',
    category: 'Selling',
    question: 'Do you work with sellers whose home did not sell with another agent?',
    answer:
      'Yes. If your listing expired or you withdrew, we start with an audit of what happened. We look at pricing, presentation, photography, marketing reach, and feedback from the original showings. We put together a re-launch plan only if we believe it has a real chance to perform. If we do not think we can do better, we will tell you.',
  },
  {
    id: 'service-area',
    category: 'Neighborhoods',
    question: 'What areas outside of Bend do you cover?',
    answer:
      'Our service area covers Bend, Tumalo, Redmond, Sisters, Sunriver, Tetherow, La Pine, Prineville, Terrebonne, Eagle Crest, Crooked River Ranch, Seventh Mountain, and Deschutes River Woods. We take on work in the broader Central Oregon area case by case. If your property is far outside where we work, we will refer you to a broker who knows that pocket of the market.',
  },
  {
    id: 'new-construction',
    category: 'Buying',
    question: 'Do you handle new construction or only resale homes?',
    answer:
      "Both. We represent buyers on new construction throughout Bend and Redmond, including walking the floor plans, reviewing builder contracts, negotiating upgrades, and managing inspections at key construction milestones. We also list resale homes across all of Central Oregon. If you are considering new construction, talk to us before you visit the model homes. The builder's onsite representative works for the builder, not for you.",
  },
  {
    id: 'market-report',
    category: 'Working with us',
    question: 'Is there a market report you publish regularly?',
    answer:
      'Yes. We publish a monthly Central Oregon market report covering Bend, Redmond, Sisters, Sunriver, and the resort communities. The report includes median price, days on market, months of supply by neighborhood, and a short narrative section. You can find the current report on our market page or ask us to email it to you.',
  },
  {
    id: 'availability',
    category: 'Working with us',
    question: 'Are you available evenings and weekends for showings?',
    answer:
      'Yes. Bend buyers and sellers do most of their thinking outside of standard business hours, and we work the schedule you need. We routinely run showings on weekday evenings, Saturdays, and Sundays. Tell us what works for you.',
  },
]

/** Lookup a single FAQ entry by its slug/id. Returns undefined for an unknown slug. */
export function getFaqBySlug(slug: string): FAQItem | undefined {
  return FAQ.find((item) => item.id === slug)
}

/** Every slug — feeds generateStaticParams() for /faq/[slug]. */
export function getFaqSlugs(): string[] {
  return FAQ.map((item) => item.id)
}

/**
 * Related questions for a standalone /faq/[slug] page — prefers the same
 * category, then fills from the rest of the list, always excluding the
 * current item. Deterministic (array order), no randomness.
 */
export function getRelatedFaq(current: FAQItem, limit = 3): FAQItem[] {
  const sameCategory = FAQ.filter((item) => item.id !== current.id && item.category === current.category)
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit)
  const rest = FAQ.filter((item) => item.id !== current.id && item.category !== current.category)
  return [...sameCategory, ...rest].slice(0, limit)
}

/** Grouped-by-category view for the hub page's table-of-contents + sections. */
export function getFaqGroupedByCategory(): Array<{ cat: FAQItem['category']; items: FAQItem[] }> {
  return FAQ_CATEGORIES.map((cat) => ({ cat, items: FAQ.filter((f) => f.category === cat) }))
}
