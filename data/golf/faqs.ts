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
      'Tetherow if you want links-style firm-and-fast on Cascade backdrops; Pronghorn Nicklaus if you want the high-desert juniper-and-lava experience; Brasada Canyons if you want isolation and 18 panoramic views. All three are public-access and represent the three distinct visual styles you get in this region.',
    references: ['research-notes.md §3, §10'],
  },
  {
    question: 'Which Central Oregon courses are open year-round?',
    answer:
      'Eagle Crest Ridge in Redmond, Meadow Lakes in Prineville, and River\'s Edge in Bend stay open through the winter when conditions allow. Frost delays are common; expect midday-only play November through March.',
    references: ['research-notes.md §8'],
  },
  {
    question: 'Can I play Crosswater without staying at Sunriver Resort?',
    answer:
      'Crosswater is reserved for Sunriver Resort guests and Crosswater Club members. The path to play it is either a resort booking that includes a golf reservation, or a member who can walk you on. There is no published "public day."',
    references: ['research-notes.md §3'],
  },
  {
    question: 'What is the most photographed hole in Central Oregon?',
    answer:
      'Two contenders. Pronghorn Fazio\'s par-3 #8 plays across a 45-foot natural canyon with an exposed lava tube — but the Fazio is private. Crooked River Ranch\'s #5 plays over a corner of the Crooked River Canyon and is public, $25-$55. If you want the shot for yourself, drive to Terrebonne.',
    references: ['research-notes.md §3, §10'],
  },
  {
    question: 'Which Central Oregon course has the lowest green fees?',
    answer:
      'Quail Run in La Pine at $25-$55 is the published low. Aspen Lakes ranges $20-$75 depending on tee window. The published bands change every season — always confirm with the course before booking.',
    references: ['research-notes.md §3'],
  },
  {
    question: 'Which Central Oregon golf community is best if I want to live in it for under $1 million?',
    answer:
      'Eagle Crest in Redmond — condos start in the $300Ks and the three courses are public-access for residents. Parts of Sunriver also fit under $1M for cabin-sized inventory near the Meadows or Woodlands courses. The mainline destination communities — Tetherow, Pronghorn, Brasada Ranch — start above $1M for a finished home.',
    references: ['research-notes.md §4'],
  },
  {
    question: 'How many holes of golf does Central Oregon have inside resort communities?',
    answer:
      'Roughly 270 holes spread across 14 named courses inside our resort-communities registry: Sunriver (63 holes across four courses), Eagle Crest (54 across three), Black Butte Ranch (45 including the putting course), Pronghorn (36), Brasada (18), Tetherow (18), Crosswater (18), Caldera Links (9). The other 14 destination-area courses sit outside HOA boundaries.',
    references: ['data/golf/courses.ts'],
  },
  {
    question: 'When does Central Oregon golf season start and end?',
    answer:
      'Late March to early November for most public and resort courses. Tetherow and Glaze Meadow typically open in April. Pronghorn opens in late March or April depending on snowpack. Brasada and Crosswater hold through October. Eagle Crest Ridge and Meadow Lakes run year-round when conditions allow.',
    references: ['research-notes.md §8'],
  },
  {
    question: 'How much further does the golf ball carry at Central Oregon\'s elevation?',
    answer:
      'Roughly 8 percent further than at sea level. The destination courses sit between 3,500 and 3,800 feet. Bring a half-club less than your sea-level yardages would suggest. Plan for the morning rounds to play longer — colder air, less carry.',
    references: ['NOAA elevation data, standard altitude-carry formula'],
  },
  {
    question: 'Which Central Oregon course was designed by Jack Nicklaus?',
    answer:
      'Pronghorn\'s Nicklaus Signature Course is the only Jack Nicklaus signature design in Oregon. Public access since the resort rebranded. Tom Fazio designed the Fazio course at the same property; that one is private.',
    references: ['research-notes.md §3, §5'],
  },
]
