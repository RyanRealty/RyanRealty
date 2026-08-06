/**
 * deliverable-share — which finished deliverables a broker may share to social,
 * and the caption they share with (W10.6, interim share-to-social).
 *
 * THE SAFETY PROPERTY (the reason this is its own module with a gate):
 * the broker content library holds 361 content:cma rows — each a CLIENT'S
 * CONFIDENTIAL valuation — plus internal comms:matt_summary/alert, analyze:*,
 * ops:* and site:* rows. None of those may ever reach a public social feed.
 * Sharing a CMA to Instagram would expose a client's pricing to the world.
 *
 * So sharing is DEFAULT-DENY: a deliverable is shareable only if its type is on
 * an explicit allowlist of public content AND not on an explicit denylist, and
 * an unknown type is never shareable. The listing surface keys off the archived
 * filename (which encodes the action type), so the check works without opening
 * the object.
 *
 * ci:deliverable-share-safety holds: content:cma / comms:* / bpo can never be
 * shareable, and the surface renders the share affordance only behind this
 * check.
 */

/**
 * Public content types a broker may share to social. Normalized to the archived
 * filename form (action_type with every non-alphanumeric run collapsed to `-`,
 * matching persistDeliverable's `filename`).
 */
export const SHAREABLE_TYPE_KEYS: readonly string[] = [
  'content-blog-post',
  'content-market-report-blog',
  'content-market-data-short',
  'content-ig-carousel',
  'content-linkedin-doc-carousel',
  'content-listing-reel',
  'content-listing-image',
  'content-just-listed-flyer',
  'content-news-clip',
  'content-sold-deal-summary',
  'content-newsletter',
  'content-gbp-post',
  'content-list-kit',
]

/**
 * Explicit denylist — defense in depth. Even if one of these were mistakenly
 * added to the allowlist, this set refuses it. A CMA/BPO is a private client
 * document; comms/analyze/ops/site are internal.
 */
export const NEVER_SHAREABLE_PREFIXES: readonly string[] = [
  'content-cma',
  'content-bpo',
  'content-test',
  'comms-',
  'analyze-',
  'ops-',
  'site-',
]

/** Normalize an action type or filename to the archived key form. */
export function shareKeyOf(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\.json$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * True only if this deliverable may be shared to a public social feed.
 * DEFAULT DENY: unknown types, and anything matching a NEVER prefix, are false.
 */
export function isShareableToSocial(actionTypeOrFilename: string): boolean {
  const key = shareKeyOf(actionTypeOrFilename)
  if (!key) return false
  // Denylist match is PREFIX, not exact: `content-cma` blocks not only itself
  // but `content-cma-v2` and `content-cma-expired` — a versioned relabel of a
  // CMA cannot slip past defense-in-depth. Entries already ending in `-`
  // (comms-, ops-, ...) are prefixes as written.
  const denied = NEVER_SHAREABLE_PREFIXES.some((p) =>
    p.endsWith('-') ? key.startsWith(p) : key === p || key.startsWith(`${p}-`),
  )
  if (denied) return false
  return SHAREABLE_TYPE_KEYS.includes(key)
}

/**
 * A pre-written share caption for a shareable deliverable type.
 *
 * Deliberately QUALITATIVE — no numbers. The caption is composed from the
 * deliverable TYPE, not its contents, so it can never carry an unverified figure
 * (CLAUDE.md section 0): a broker adds the specifics. Every template is written
 * to the brand voice (no em-dashes, no banned words, sentence case, "you/your"),
 * and the test asserts each one passes checkBrandVoice. Never returns a caption
 * for a non-shareable type — callers must gate on isShareableToSocial first, but
 * this returns '' for a private type as a second line of defense.
 */
export function captionFor(actionTypeOrFilename: string): string {
  if (!isShareableToSocial(actionTypeOrFilename)) return ''
  const key = shareKeyOf(actionTypeOrFilename)
  const templates: Record<string, string> = {
    'content-blog-post': 'New on the blog. A closer look at what is happening in the Central Oregon market.',
    'content-market-report-blog': 'The latest Central Oregon market report is up. See where prices, inventory, and days on market stand right now.',
    'content-market-data-short': 'A quick read on the Central Oregon market this month. Save this for when you are ready to make a move.',
    'content-ig-carousel': 'Swipe through the latest from Central Oregon. Questions about your own home or a move. Send a message.',
    'content-linkedin-doc-carousel': 'A data-backed look at the Central Oregon market. Worth a scroll if you are watching the area.',
    'content-listing-reel': 'Take the tour. Reach out for a private showing or the full details.',
    'content-listing-image': 'Now on the market in Central Oregon. Message for the full details and a showing.',
    'content-just-listed-flyer': 'Just listed in Central Oregon. Ask for the details or book a showing.',
    'content-news-clip': 'The Central Oregon market this week, in under a minute.',
    'content-sold-deal-summary': 'Another one closed in Central Oregon. Thinking about your own move. Let us talk.',
    'content-newsletter': 'This month from Ryan Realty. The Central Oregon market, the numbers that matter, and what to watch.',
    'content-gbp-post': 'The latest from Ryan Realty in Bend. Reach out any time.',
    'content-list-kit': 'Everything on this listing in one place. Message for a private showing.',
  }
  return templates[key] ?? 'The latest from Ryan Realty in Central Oregon.'
}

/**
 * A short, human label for a shareable deliverable type, for the caption + UI.
 */
export function shareableTypeLabel(key: string): string {
  const map: Record<string, string> = {
    'content-blog-post': 'blog post',
    'content-market-report-blog': 'market report',
    'content-market-data-short': 'market update',
    'content-ig-carousel': 'Instagram carousel',
    'content-linkedin-doc-carousel': 'LinkedIn carousel',
    'content-listing-reel': 'listing reel',
    'content-listing-image': 'listing graphic',
    'content-just-listed-flyer': 'just-listed flyer',
    'content-news-clip': 'news clip',
    'content-sold-deal-summary': 'sold announcement',
    'content-newsletter': 'newsletter',
    'content-gbp-post': 'Google post',
    'content-list-kit': 'listing kit',
  }
  return map[shareKeyOf(key)] ?? 'post'
}
