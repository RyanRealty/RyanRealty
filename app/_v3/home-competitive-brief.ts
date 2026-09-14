/**
 * Homepage Researchy 1–8. Same object lives on homepage-v6 parity +
 * taste-catalog so Mini can quote beats verbatim. Every beat string is
 * rendered on the page (section claims) — a boolean is not evidence.
 *
 * Source: design_system/public/references/homepage-v6.md (Redfin live
 * signal · Stripe composed object · Stage + Pulse) and the homepage-v6
 * layout lock in taste-catalog.json.
 */
export const HOME_COMPETITIVE_BRIEF_ID = 'homepage-v6-researchy-1-8'

export const HOME_COMPETITIVE_BRIEF = {
  id: HOME_COMPETITIVE_BRIEF_ID,
  source:
    'design_system/public/references/homepage-v6.md + taste-catalog homepage-v6 layoutLock (Researchy / Redfin + Stripe + Stage).',
  productLock:
    'live inventory in first viewport + MorphingSearch + Sell address without JS + house Card rails + featured carousel Card + place Cards with live town counts + sourced MLS line',
  refuse:
    'Stock search-hero with no house photo. Cream-box search. House featured pager. Identical empty place chips. Lone competitiveBriefPass boolean without the beats visible in shots.',
  beats: [
    {
      id: '1',
      text: 'The homepage opens with live inventory in the first viewport.',
    },
    {
      id: '2',
      text: 'Search field that morphs into results. Navy on cream, no glass.',
    },
    {
      id: '3',
      text: 'Buy / Sell as tabs with a sliding indicator on the house control.',
    },
    {
      id: '4',
      text: 'A real Sell address field without waiting on JS.',
    },
    {
      id: '5',
      text: 'House cards on the rail: price, address, beds/baths/sqft on the installed Card.',
    },
    {
      id: '6',
      text: 'Search hero carries a live market or inventory signal, not only a photo bar.',
    },
    {
      id: '7',
      text: 'Featured community cards carry sourced pulse figures.',
    },
    {
      id: '8',
      text: 'Browse places with live town counts, not identical empty chips.',
    },
  ],
} as const

export type HomeCompetitiveBeatId = (typeof HOME_COMPETITIVE_BRIEF.beats)[number]['id']

export function homeBriefText(id: HomeCompetitiveBeatId): string {
  const beat = HOME_COMPETITIVE_BRIEF.beats.find((b) => b.id === id)
  return beat?.text ?? ''
}
