/**
 * Review JSON-LD for /reviews, built from the SAME quotes the page
 * renders so SERP rich results match what is on screen.
 *
 * Deliberately NO aggregateRating: an aggregate rating of the business,
 * published on the business's own site, is a self-serving review under
 * Google's structured-data policy.
 */

import type { ReviewQuote } from '@/lib/reviews/review-quotes'
import { REVIEW_BROKERS } from './reviews-faces'

function ratingValue(rating: number): number {
  if (!Number.isFinite(rating)) return 5
  return Math.min(5, Math.max(1, Math.round(rating)))
}

export function buildReviewsJsonLd(
  siteUrl: string,
  quotes: readonly ReviewQuote[],
): Record<string, unknown> {
  const reviews = quotes.map((t) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: t.author },
    reviewBody: t.quote,
    ...(t.date ? { datePublished: t.date } : {}),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: ratingValue(t.rating),
      bestRating: 5,
      worstRating: 1,
    },
  }))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${siteUrl}/reviews` },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/reviews#webpage`,
        name: `${quotes.length} Google reviews of Ryan Realty`,
        url: `${siteUrl}/reviews`,
        description: `${quotes.length} verified Google reviews of Ryan Realty, each in full on this page.`,
        isPartOf: { '@id': `${siteUrl}#website` },
        about: { '@id': `${siteUrl}#organization` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${siteUrl}${REVIEW_BROKERS[0]!.src}`,
        },
      },
      {
        '@type': 'ItemList',
        '@id': `${siteUrl}/reviews#list`,
        name: 'Google reviews of Ryan Realty',
        numberOfItems: quotes.length,
        itemListElement: quotes.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.author,
          url: `${siteUrl}/reviews#reviews`,
        })),
      },
      {
        '@type': 'RealEstateAgent',
        '@id': `${siteUrl}#organization`,
        name: 'Ryan Realty',
        // The same url the root layout gives this @id. /reviews here told a
        // parser the brand entity lives at /reviews, and /reviews outranked /
        // for the bare brand query (SITE-198).
        url: siteUrl,
        image: `${siteUrl}${REVIEW_BROKERS[0]!.src}`,
        employee: REVIEW_BROKERS.map((b) => ({
          '@type': 'Person',
          name: b.name,
          url: `${siteUrl}${b.href}`,
          image: `${siteUrl}${b.src}`,
          jobTitle: b.title,
        })),
        review: reviews,
      },
    ],
  }
}
