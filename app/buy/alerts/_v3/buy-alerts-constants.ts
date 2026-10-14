/**
 * /buy/alerts copy, links, and tracking tokens in one object so Writing Bot
 * can swap visible words in one edit. Live figures are interpolated in
 * buy-alerts-copy.ts from the same published city and price-drop helpers the
 * city and price-drop pages use. No figure lives here.
 *
 * H1 and meta use the fallback: saved-search-alerts cron is hourly
 * (`0 * * * *`), so this page does not claim same-day delivery. Town, price,
 * and bed filters ship on the form; "price and beds" still drops from meta
 * per the approved fallback. No SMS. Weekly median excludes drops over 50%.
 */
import type { LeadFormId, LeadType } from '@/lib/analytics/lead-event'

export const ROUTE_PATH = '/buy/alerts'

/** Recurring email list. Flip this on /buy/leverage if that form becomes a consult. */
export const BUY_ALERTS_LEAD_TYPE: LeadType = 'buyer_alerts'
export const BUY_ALERTS_FORM_ID: LeadFormId = 'buyer_alerts_lp'
export const BUY_ALERTS_LP_VARIANT = 'buy-alerts'

export const CENTRAL_OREGON_ID = 'central-oregon'

export const BUY_ALERTS_TOWNS = [
  { id: 'Bend', label: 'Bend' },
  { id: 'Redmond', label: 'Redmond' },
  { id: 'Sisters', label: 'Sisters' },
  { id: 'Sunriver', label: 'Sunriver' },
  { id: 'La Pine', label: 'La Pine' },
  { id: 'Prineville', label: 'Prineville' },
  { id: CENTRAL_OREGON_ID, label: 'Central Oregon' },
] as const

export const BUY_ALERTS_DEFAULT_TOWNS = ['Bend'] as const

export const BUY_ALERTS_BED_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5+' },
] as const

export const BUY_ALERTS_LINKS = {
  homes: '/homes-for-sale',
  bendHomes: '/homes-for-sale/bend',
  redmondHomes: '/homes-for-sale/redmond',
  sistersHomes: '/homes-for-sale/sisters',
  laPineHomes: '/homes-for-sale/la-pine',
  prinevilleHomes: '/homes-for-sale/prineville',
  sunriver: '/communities/sunriver',
  priceDrops: '/price-drops',
  bendDrops: '/price-drops/bend',
  openHouses: '/open-houses',
  newConstruction: '/new-construction',
  leverage: '/buy/leverage',
  bendCity: '/cities/bend',
  book: '/book',
  fairHousing: '/fair-housing',
  privacy: '/privacy',
} as const

/** Browse links for Pick your town. Central Oregon is a form option, not a town page. */
export const BUY_ALERTS_TOWN_LINKS = [
  { href: BUY_ALERTS_LINKS.bendHomes, label: 'Bend' },
  { href: BUY_ALERTS_LINKS.redmondHomes, label: 'Redmond' },
  { href: BUY_ALERTS_LINKS.sistersHomes, label: 'Sisters' },
  { href: BUY_ALERTS_LINKS.sunriver, label: 'Sunriver' },
  { href: BUY_ALERTS_LINKS.laPineHomes, label: 'La Pine' },
  { href: BUY_ALERTS_LINKS.prinevilleHomes, label: 'Prineville' },
] as const

/**
 * Every visitor-facing line on this page. Live numbers are tokens filled by
 * buyAlertsCopy(). Consent checkbox and US notice lines come from
 * components/site/FormAdConsent (PR #465) and are listed in the ship summary.
 */
export const BUY_ALERTS_COPY = {
  title: 'Bend & Central Oregon New Listing Alerts',
  meta: 'Get every new Bend and Central Oregon listing and price cut by email, straight from the MLS. Pick your towns. Unsubscribe anytime.',
  h1: 'Get new Central Oregon listings and price cuts by email',
  eyebrow: 'Listing alerts',
  whatYouGet:
    "Pick a town and we'll email you each new listing that hits the MLS, one email per home. If a home you were sent cuts its price, you hear about that too. It's free, and the data comes straight from Oregon Data Share MLS.",
  inboxHeading: 'What lands in your inbox',
  inboxNew: 'One email per new listing in the towns you pick.',
  inboxDrops: "Price changes on the homes you've been sent.",
  inboxCalls: 'No agent calls unless you ask for one.',
  inboxUnsub: 'One-click unsubscribe in every email.',
  whyHeading: "Why it's worth it right now",
  source: 'Single-family homes, Oregon Data Share MLS.',
  leverage: 'Buyers have leverage in Bend on price, not supply, so the cut is often the moment to look.',
  seeWhy: 'See why',
  leverageMos:
    'Bend still has {mos} months of supply as of {asOf}, under the 4-month line, so the leverage is in pricing, not in inventory.',
  volume:
    "{count} detached houses came on the market in Bend in the last 30 days (as of {asOf}). That's a lot to keep up with by refreshing a search.",
  dropsCount: '{count} Bend homes cut their asking price in the last 7 days',
  dropsMedian: 'with a median drop of {pct}%.',
  pickTownsHeading: 'Pick your town',
  saveSearchBefore: 'Already searching? Use Save this search on',
  saveSearchLink: 'homes for sale',
  saveSearchAfter: 'to get alerts on exactly those filters.',
  formTowns: 'Towns',
  formTownHint: 'Central Oregon covers every town on this list.',
  formPriceFrom: 'Price from',
  formPriceTo: 'Price to',
  formBeds: 'Bedrooms',
  formEmail: 'Email',
  formEmailPlaceholder: 'you@email.com',
  formSubmit: 'Start my alerts',
  formCadence: 'Free. One email per new listing. Unsubscribe any time.',
  formConfirmHeading: 'Alert saved',
  formConfirmBody: 'New listings and price changes that match your search will come to that inbox.',
  formSending: 'Saving your alert.',
  formFailed: 'That did not save. Check the connection and try again.',
  formTownRequired: 'Pick at least one town, or Central Oregon.',
  formEmailRequired: 'An email is required so the alert has somewhere to land.',
  signupEyebrow: 'Your alert',
  signupHeading: 'Get listing alerts',
  questionsHeading: 'Questions',
  sourcesHeading: 'Sources',
  nextHeading: 'Keep looking',
  breadcrumbHome: 'Home',
  breadcrumbHomes: 'Homes for sale',
  breadcrumbHere: 'Listing alerts',
  faqSpeedQ: 'How fast do alerts arrive?',
  faqSpeedA: 'Alerts go out as new listings come into the MLS feed, about once an hour.',
  faqDropsQ: 'Do alerts include price drops?',
  faqDropsA:
    "Yes, for homes you've been alerted on. If a home you were sent cuts its price, you'll get an email. For every cut this week, see Bend price drops.",
  faqFreeQ: 'Is it free? Will an agent call me?',
  faqFreeA: "It's free. Nobody calls unless you ask. Book a time if you want to talk.",
  faqTownsQ: 'Can I pick neighborhoods?',
  faqTownsA: "You can pick towns today. Neighborhood alerts aren't available yet.",
  faqUnsubQ: 'How do I unsubscribe?',
  faqUnsubA: 'One click, at the bottom of every email.',
  faqSourceQ: 'Where does the data come from?',
  faqSourceA: 'Oregon Data Share MLS, the same feed local brokers use.',
  linkHomes: 'Browse homes for sale',
  linkBendHomes: 'Bend homes for sale',
  linkRedmondHomes: 'Redmond homes for sale',
  linkSistersHomes: 'Sisters homes for sale',
  linkLaPineHomes: 'La Pine homes for sale',
  linkPrinevilleHomes: 'Prineville homes for sale',
  linkSunriver: 'Sunriver homes',
  linkPriceDrops: "See this week's price drops",
  linkBendDrops: 'Bend price drops',
  linkOpenHouses: 'Open houses',
  linkNewConstruction: 'New construction',
  linkLeverage: 'Where buyers have leverage',
  linkBendCity: 'Bend city page',
  linkBook: 'Book a time',
  linkFairHousing: 'Fair housing',
  linkPrivacy: 'Privacy',
  sourceVolume: 'Bend new listings, last 30 days',
  sourceDrops: 'Bend asking-price cuts, last 7 days',
  sourceMos: 'Bend months of supply',
} as const
