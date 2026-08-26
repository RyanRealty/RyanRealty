/**
 * FAQ — long-tail intent capture + AEO / voice-search wedge.
 *
 * Rendered with FAQPage schema markup so the questions surface in
 * Google's "People also ask" results. Voice rules per CLAUDE.md §3.
 *
 * Every answer must be specific and traceable to the course-inventory or
 * research notes — no hand-waving. Per-question references kept in the
 * `references` field even though they don't render on-page.
 */

import { GOLF_COURSES } from './courses'

// Derived, never typed. The hole-count answer shipped "roughly 270 holes across 14
// named courses" and "the other 14 destination-area courses" against an inventory of
// 279 holes across 16 and 171 across 10 — and its own itemised list summed to 261
// while double-counting Crosswater and Caldera inside Sunriver's 63. It renders as
// FAQPage schema, so it was wrong in Google's answer box too (CLAUDE.md §0).
const IN_COMMUNITY = GOLF_COURSES.filter((c) => c.communitySlug)
const OUTSIDE = GOLF_COURSES.filter((c) => !c.communitySlug)
const holes = (list: typeof GOLF_COURSES) => list.reduce((n, c) => n + c.holes, 0)

export interface GolfFaq {
  question: string
  /** Short answer rendered inline. Keep under ~90 words. */
  answer: string
  /** Sources, for the reviewer + future updates. Not rendered. */
  references?: string[]
}

export const GOLF_FAQS: GolfFaq[] = [
  {
    question: 'Which Central Oregon course is the best for a first-time visitor?',
    answer:
      'Tetherow if you want links-style firm-and-fast on Cascade backdrops. Pronghorn Nicklaus if you want the high-desert juniper-and-lava experience. Brasada Canyons if you want isolation and 18 panoramic views. They represent the three distinct visual styles you get in this region. Access differs: Pronghorn Nicklaus is public, Tetherow is semi-private, Brasada Canyons is resort play.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'Which Central Oregon courses are open year-round?',
    answer:
      'Eagle Crest Ridge in Redmond, Meadow Lakes in Prineville, and River\'s Edge in Bend stay open through the winter when conditions allow. Frost delays are common. Expect midday-only play November through March.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'Can I play Crosswater without staying at Sunriver Resort?',
    answer:
      'Crosswater is reserved for Sunriver Resort guests and Crosswater Club members. The path to play it is either a resort booking that includes a golf reservation, or a member who can walk you on. There is no published "public day."',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'What is the most photographed hole in Central Oregon?',
    answer:
      'Two contenders. Pronghorn Fazio\'s par-3 #8 plays across a 45-foot natural canyon with an exposed lava tube, but the Fazio is private. Crooked River Ranch\'s #5 plays over a corner of the Crooked River Canyon and is public. If you want the shot for yourself, drive to Terrebonne.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'Which Central Oregon course has the lowest green fees?',
    answer:
      'The municipal and small-town courses run cheapest: Desert Peaks in Madras, Meadow Lakes in Prineville, The Greens at Redmond, Quail Run in La Pine. Green fees move every season and by tee window, so we do not publish a number that will be wrong by the time you read it. Check the course.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'Which Central Oregon golf community is best if I want to live in it for under $1 million?',
    answer:
      'Eagle Crest in Redmond is the usual answer, with condo inventory well under the mainline resorts and three courses on site. Parts of Sunriver also work for cabin-sized inventory near the Meadows or Woodlands courses. Tetherow, Pronghorn and Brasada Ranch sit at the top of the market. Prices move, so ask us what is actually on today rather than trusting a figure on a page.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'How many holes of golf does Central Oregon have inside resort communities?',
    answer:
      `${holes(IN_COMMUNITY)} holes across ${IN_COMMUNITY.length} courses inside our resort-communities registry. Eagle Crest has three, Sunriver, Black Butte Ranch and Pronghorn two each. The other ${OUTSIDE.length} courses we cover, ${holes(OUTSIDE)} holes, sit outside those boundaries.`,
    references: ['data/golf/courses.ts'],
  },
  {
    question: 'When does Central Oregon golf season start and end?',
    answer:
      'Late March to early November for most public and resort courses. Tetherow and Glaze Meadow typically open in April. Pronghorn opens in late March or April depending on snowpack. Brasada and Crosswater hold through October. Eagle Crest Ridge and Meadow Lakes run year-round when conditions allow.',
    references: ['data/golf/SOURCES.md'],
  },
  {
    question: 'How much further does the golf ball carry at Central Oregon\'s elevation?',
    answer:
      'Enough that you should club down. Central Oregon golf sits above 3,000 feet, thin air carries the ball further, and most visitors find a half-club less is about right. Morning rounds play longer in colder air, with less carry.',
    references: ['NOAA elevation data, standard altitude-carry formula'],
  },
  {
    question: 'Which Central Oregon course was designed by Jack Nicklaus?',
    answer:
      'Pronghorn\'s Nicklaus Signature Course is the only Jack Nicklaus signature design in Oregon. Public access since the resort rebranded. Tom Fazio designed the Fazio course at the same property. That one is private.',
    references: ['data/golf/SOURCES.md'],
  },
]
