// Shared by lib/identity/consent.test.ts and the client-document tracker tests
// (app/api/visitors/track/doc-tracker.*.test.ts): every shape the cookie banner
// writes, and the ways a consent cookie goes wrong, with the tier each one must
// record at (docs/TRACKING_POLICY.md, "What we collect at each consent tier").
// Lives in test/ rather than lib/ because a module only tests import is an
// orphan to ci:reachable-exports.
import type { TrackingConsentLevel } from '@/lib/identity/consent'

export const encodeConsent = (o: unknown): string => encodeURIComponent(JSON.stringify(o))

export const COOKIE_MATRIX: Array<{ label: string; raw: string | undefined; level: TrackingConsentLevel }> = [
  { label: 'no cookie', raw: undefined, level: 'essential' },
  { label: 'analytics + marketing', raw: encodeConsent({ analytics: true, marketing: true }), level: 'all' },
  { label: 'analytics only', raw: encodeConsent({ analytics: true, marketing: false }), level: 'analytics' },
  { label: 'marketing only', raw: encodeConsent({ analytics: false, marketing: true }), level: 'essential' },
  { label: 'both off (Essential only)', raw: encodeConsent({ analytics: false, marketing: false }), level: 'declined' },
  { label: 'legacy bare all', raw: 'all', level: 'all' },
  { label: 'unreadable', raw: '%%%not-json', level: 'declined' },
  { label: 'plain word', raw: 'yes', level: 'declined' },
  { label: 'json null', raw: 'null', level: 'declined' },
  { label: 'json array', raw: encodeConsent([]), level: 'declined' },
  { label: 'json string', raw: encodeConsent('all'), level: 'declined' },
  { label: 'empty object', raw: encodeConsent({}), level: 'declined' },
  { label: 'truthy strings', raw: encodeConsent({ analytics: 'yes', marketing: 'yes' }), level: 'all' },
]

/** Query strings the ad-traffic grant reads: campaign params and click ids, and things that look like them. */
export const SEARCH_MATRIX = [
  '',
  '?utm_source=cma&utm_campaign=1-main-st',
  '?UTM_Source=email',
  '?fbclid=abc',
  '?gclid=abc',
  '?msclkid=abc',
  '?ttclid=abc',
  '?agent=matt',
  '?agent=matt&_pid=tok',
  '?foo=utm_source',
] as const
