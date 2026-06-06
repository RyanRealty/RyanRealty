/**
 * Canonical email-brand tokens (Design System v2).
 *
 * Why this module exists: email clients do NOT load web fonts. Geist and
 * Amboqia never render in Gmail, Outlook, or Apple Mail, so a declared
 * `font-family: 'Geist'` falls through to whatever comes next. Each email
 * generator had drifted to its own ad-hoc stack ('Inter', 'system-ui',
 * 'Helvetica Neue', Arial), all of which are RETIRED on the web surface and
 * caught by the design-token gate there but invisible to it here (the gate
 * scans only app/ + components/). This is the one stack every email/HTML
 * deliverable uses so the brand stays consistent across the CMA, the broker
 * digests, and the alert emails.
 *
 * The stack LEADS with Geist (for the rare local install / forward to a brand
 * machine), then the OS UI font, then the generic `sans-serif` keyword. It
 * contains NO retired font names — `sans-serif` covers the deep fallback that
 * Helvetica/Arial used to provide, without naming them.
 *
 * Colors: the locked two-color v2 palette. Generic UI grays in email chrome
 * (table hairlines, muted captions) are fine. The RETIRED brand tokens
 * (gold #D4AF37 / #C8A864, sand #e8e2d4, old cream #F2EBDD, navy-deep #0a1a2e)
 * are not — replace them with the exports below.
 */
export const EMAIL_FONT_STACK =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

/** Primary navy. Logo, headings, CTAs, header backgrounds. */
export const EMAIL_NAVY = '#102742'

/** Warm off-white. Header text on navy, light backgrounds. */
export const EMAIL_CREAM = '#faf8f4'

/** Warm-stone hairline for borders/dividers (replaces retired sand #e8e2d4). */
export const EMAIL_BORDER = 'rgba(16,39,66,0.08)'
