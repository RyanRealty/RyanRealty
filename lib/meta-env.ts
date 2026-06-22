/**
 * Canonical Meta (Facebook/Instagram) Graph credentials accessor (audit p3.3).
 *
 * The Meta page access token is read under TWO env names across the repo
 * (META_PAGE_ACCESS_TOKEN and META_PAGE_TOKEN), and the read is inconsistent:
 * the live publishers (publish / publish-instagram / publish-facebook /
 * token-heartbeat) read ONLY META_PAGE_ACCESS_TOKEN, so a token set under only
 * META_PAGE_TOKEN silently disables publishing while the dual-reading diagnostics
 * still work (a confusing half-broken state). This is the single accessor: it
 * reads BOTH (preferring META_PAGE_ACCESS_TOKEN), so either env name works
 * everywhere. Mirrors lib/crm/fub-env.ts (the FOLLOWUPBOSS/FUB collapse).
 *
 * The `ci:meta-token` ratchet gate bans NEW direct env reads outside this file;
 * existing readers are a baselined backlog that may only shrink.
 */
export function getMetaPageToken(): string | undefined {
  return process.env.META_PAGE_ACCESS_TOKEN ?? process.env.META_PAGE_TOKEN
}
