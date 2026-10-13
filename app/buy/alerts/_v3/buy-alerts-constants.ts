/**
 * /buy/alerts copy, links, and tracking tokens in one object so Writing Bot
 * can swap visible words in one edit. Live figures are interpolated in
 * buy-alerts-copy.ts from the same leftover HUD and price-drop helpers the
 * published city and price-drop pages use. No figure lives here.
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
  fairHousing: '/fair-housing',
  privacy: '/privacy',
} as const

/**
 * Every visitor-facing line on this page. Live numbers are tokens filled by
 * buyAlertsCopy(). Consent checkbox and US notice lines come from
 * components/site/FormAdConsent (PR #465) and are listed in the ship summary.
 */
export const BUY_ALERTS_COPY = {
  title: 'Bend & Central Oregon New Listing Alerts',
  meta: 'Get every new Bend and Central Oregon listing and price cut by email, straight from the MLS. Pick your towns, price and beds. Unsubscribe anytime.',
  h1: 'Get new Central Oregon listings and price cuts by email',
  eyebrow: 'Listing alerts',
  whatYouGet:
    'One email per new listing that matches the towns, price and beds you pick, plus price changes on those homes. Unsubscribe any time.',
  source: 'Figures are Oregon Data Share MLS, single-family homes.',
  leverage: 'Buyers have leverage in Bend on price cuts and first asks.',
  leverageMos:
    'Bend still has {mos} months of supply as of {asOf}, under the 4-month line, so the leverage is in pricing, not in inventory.',
  volume: '{count} detached houses came on the market in Bend in the last 30 days, as of {asOf}.',
  dropsCount: '{count} Bend homes cut their asking price in the last 7 days, as of {asOf}.',
  dropsMedian: 'The median cut was {pct}%, after dropping typo-sized cuts over 50 percent.',
  formTowns: 'Towns',
  formTownHint: 'Central Oregon covers every town on this list.',
  formPriceFrom: 'Price from',
  formPriceTo: 'Price to',
  formBeds: 'Bedrooms',
  formEmail: 'Email',
  formEmailPlaceholder: 'you@email.com',
  formSubmit: 'Get listing alerts',
  formCadence: 'One email per new listing. Unsubscribe any time.',
  formConfirmHeading: 'Alert saved',
  formConfirmBody: 'New listings and price changes that match your search will come to that inbox.',
  formSending: 'Saving your alert.',
  formFailed: 'That did not save. Check the connection and try again.',
  formTownRequired: 'Pick at least one town, or Central Oregon.',
  formEmailRequired: 'An email is required so the alert has somewhere to land.',
  signupEyebrow: 'Your alert',
  signupHeading: 'Email me matching homes',
  questionsHeading: 'Questions',
  sourcesHeading: 'Sources',
  nextHeading: 'Keep looking',
  breadcrumbHome: 'Home',
  breadcrumbHomes: 'Homes for sale',
  breadcrumbHere: 'Listing alerts',
  faqSpeedQ: 'How fast do alerts arrive?',
  faqSpeedA:
    'We check for matching homes about once an hour and email you when we find a new listing or a price change on a home you already heard about.',
  faqDropsQ: 'Do alerts include price drops?',
  faqDropsA:
    'Yes. When a home you were already alerted on cuts its price, we email you. This is not a cuts-only feed of every reduced listing in town.',
  faqFreeQ: 'Is it free, and will an agent call me?',
  faqFreeA: 'Yes, it is free. A broker writes only if you ask.',
  faqTownsQ: 'Can I pick neighborhoods?',
  faqTownsA:
    'You can pick towns now: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, or all of Central Oregon. Neighborhood filters are not on this form.',
  faqUnsubQ: 'How do I unsubscribe?',
  faqUnsubA: 'Every alert email has an unsubscribe link. One click ends the alerts.',
  faqSourceQ: 'Where does the data come from?',
  faqSourceA: 'Listings come from Oregon Data Share MLS.',
  linkHomes: 'Search homes for sale',
  linkBendHomes: 'Bend homes for sale',
  linkRedmondHomes: 'Redmond homes for sale',
  linkSistersHomes: 'Sisters homes for sale',
  linkLaPineHomes: 'La Pine homes for sale',
  linkPrinevilleHomes: 'Prineville homes for sale',
  linkSunriver: 'Sunriver homes',
  linkPriceDrops: 'Price drops this week',
  linkBendDrops: 'Bend price drops',
  linkOpenHouses: 'Open houses',
  linkNewConstruction: 'New construction in Bend',
  linkLeverage: 'Buyers have leverage in Bend',
  linkBendCity: 'Bend city page',
  linkFairHousing: 'Fair housing',
  linkPrivacy: 'Privacy',
  sourceVolume: 'Bend new listings, last 30 days',
  sourceDrops: 'Bend asking-price cuts, last 7 days',
  sourceMos: 'Bend months of supply',
} as const
