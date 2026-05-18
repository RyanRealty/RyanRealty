/**
 * Ryan Realty brand cards interspersed into the /pulse feed.
 *
 * Each card is a native ad — it lives in the scroll alongside MLS events,
 * styled to match the feed (9:16, full-bleed, overlaid copy) but visibly
 * marked "Ryan Realty" so a viewer knows it's our content, not someone
 * else's listing.
 *
 * Rotation order is fixed so a returning visitor sees a different card the
 * second time they scroll past the same feed position.
 */

export type BrandCardKind =
  | 'home_valuation'
  | 'meet_broker'
  | 'subscribe_report'
  | 'our_story'
  | 'featured_video'

export type BrandCardCta = {
  /** Visible label on the button. */
  label: string
  /** Internal destination — relative path or absolute URL. */
  href: string
  /** GA4 event name fired on click. */
  event:
    | 'click_cta'
    | 'valuation_requested'
    | 'newsletter_signup'
    | 'play_video'
    | 'contact_agent_click'
}

export type BrandCardDefinition = {
  id: string
  kind: BrandCardKind
  /** Top-of-card eyebrow text, uppercase. */
  kicker: string
  /** Big display headline. */
  headline: string
  /** One-line body copy under the headline. */
  body: string
  /** Optional second-line body (longer trust signal). */
  secondaryBody?: string
  /** Full-bleed background image (4:5 to 9:16 source recommended). */
  backgroundImage: string
  /** Alt for the background image. */
  backgroundAlt: string
  /**
   * Optional autoplaying video that replaces the background image. Used for
   * producer-rendered content (market reports, neighborhood tours, news
   * clips). Must be a direct MP4/WEBM URL — third-party tour embeds belong
   * elsewhere.
   */
  backgroundVideo?: string
  /** Optional cut-out portrait or mascot to layer over the background. */
  foregroundImage?: string
  /** Aria-friendly alt for the foreground cut-out. */
  foregroundAlt?: string
  /** Overlay tone bias — controls the gradient over the photo. */
  tone: 'navy' | 'cream'
  cta: BrandCardCta
  /** Optional inline email capture instead of a single CTA button. */
  inlineEmail?: {
    placeholder: string
    submitLabel: string
    /** Lead value for Meta CAPI (USD). */
    leadValue: number
    /** Meta CAPI content_name tag for the lead. */
    contentName: string
  }
}

const BEND_HERO = '/images/hero-poster.webp'
const BEND_ALPINE = '/images/lp/hero-bend-alpine.png'
const BEND_DOWNTOWN = '/images/lp/hero-bend-downtown.png'
const DESCHUTES = '/images/lp/hero-deschutes-clean.jpg'
const SCHOOLHOUSE = '/images/lp/schoolhouse-rd-hero.jpg'

const MATT_HEADSHOT = '/images/brokers/ryan-matt.png'
const JAX = '/images/lp/jax-blue-dog.png'

export const BRAND_CARDS: BrandCardDefinition[] = [
  {
    id: 'home-valuation',
    kind: 'home_valuation',
    kicker: 'For sellers',
    headline: 'What is your home worth this week?',
    body: 'A real number from a local broker. Not a third-party estimate.',
    secondaryBody: 'No spam. We text you a one-page valuation within a day.',
    backgroundImage: BEND_HERO,
    backgroundAlt: 'Deschutes River aerial in Bend, Oregon',
    tone: 'navy',
    cta: {
      label: 'Get my valuation',
      href: '/home-valuation',
      event: 'valuation_requested',
    },
  },
  {
    id: 'meet-matt',
    kind: 'meet_broker',
    kicker: 'Meet the team',
    headline: 'Matt Ryan',
    body: 'Principal broker · Lived in Bend eighteen years',
    secondaryBody: 'Honest, transparent, direct. We do not rush you to the finish line.',
    backgroundImage: MATT_HEADSHOT,
    backgroundAlt: 'Matt Ryan, principal broker at Ryan Realty',
    tone: 'navy',
    cta: {
      label: 'Talk to Matt',
      href: '/contact?source=pulse_feed',
      event: 'contact_agent_click',
    },
  },
  {
    id: 'subscribe-report',
    kind: 'subscribe_report',
    kicker: 'Monthly report',
    headline: 'Bend market report, every month.',
    body: 'What sold, what dropped, what to watch. Free.',
    secondaryBody: 'A short read from a working broker.',
    backgroundImage: BEND_DOWNTOWN,
    backgroundAlt: 'Downtown Bend, Oregon',
    tone: 'navy',
    cta: {
      label: 'Subscribe',
      href: '/contact?source=pulse_feed_newsletter',
      event: 'newsletter_signup',
    },
    inlineEmail: {
      placeholder: 'you@example.com',
      submitLabel: 'Send the report',
      leadValue: 80,
      contentName: 'Pulse Feed · Monthly Report Subscribe',
    },
  },
  {
    id: 'our-story',
    kind: 'our_story',
    kicker: 'About us',
    headline: 'A small business, built in Bend.',
    body: 'Three brokers. Family-owned. Real local data.',
    secondaryBody: 'No marketing team. We have time for you.',
    backgroundImage: BEND_ALPINE,
    backgroundAlt: 'Bend skyline with Cascade mountains',
    foregroundImage: JAX,
    foregroundAlt: 'Jax, the Ryan Realty blue lab mascot',
    tone: 'cream',
    cta: {
      label: 'Our story',
      href: '/about',
      event: 'click_cta',
    },
  },
  {
    id: 'featured-video',
    kind: 'featured_video',
    kicker: 'YTD market report',
    headline: 'Central Oregon · the numbers so far.',
    body: 'A short read on what sold and where the market is moving.',
    secondaryBody: 'Produced by Ryan Realty.',
    backgroundImage: DESCHUTES,
    backgroundAlt: 'Deschutes River near Bend, Oregon',
    backgroundVideo: '/v5_library/bend_market_report_ytd2026.mp4',
    tone: 'navy',
    cta: {
      label: 'Watch the latest',
      href: '/blog?tag=market-report',
      event: 'play_video',
    },
  },
]

export function pickBrandCard(index: number): BrandCardDefinition {
  const safe = ((index % BRAND_CARDS.length) + BRAND_CARDS.length) % BRAND_CARDS.length
  return BRAND_CARDS[safe]
}
