/**
 * Arrival identity planning for /api/visitors/track (P7 identity loop).
 *
 * Pure. The route gathers the evidence (a verified link token, the session's
 * current owner, a carried-over identity-map person, the signed rr_pid cookie,
 * the automation class) and this decides what to do. Kept pure so the
 * precedence rules are unit-tested rather than buried in a 700-line route.
 *
 * Precedence, strongest first:
 *   1. A signed token on the link just clicked. It is an explicit, current
 *      statement of who this is (the same rule lib/crm/submitted-identity.ts
 *      applies to a typed email beating a stale cookie).
 *        - session unowned            -> identify the session + browser
 *        - session owned by them       -> nothing to do
 *        - session owned by SOMEONE ELSE (a shared laptop, a forwarded email)
 *                                      -> rotate: the client starts a fresh
 *                                         session so this visit is recorded
 *                                         under the person who clicked, and the
 *                                         earlier person's history stays theirs
 *   2. The durable rr_vid already mapped to a person (identity map), at session birth.
 *   3. The signed rr_pid cookie from an earlier identification on this browser.
 * Automation never identifies anyone: an email security scanner or crawler that
 * opens a tracked link must not show up as the contact browsing the site.
 */
import type { VerifiedPersonToken } from '@/lib/identity/link-token'
import { identifiedViaForChannel } from '@/lib/identity/link-token'

export type SessionOwner = { crmPersonId: number | null } | null

export type ArrivalDecision =
  | { kind: 'none' }
  | { kind: 'already'; personId: number }
  | { kind: 'identify'; personId: number; via: string }
  | { kind: 'rotate'; personId: number }

export function planArrivalIdentity(args: {
  token: VerifiedPersonToken | null
  /** Whether the token's person still exists in crm_people (not deleted). */
  tokenPersonExists?: boolean
  session: SessionOwner
  carryoverPersonId?: number | null
  cookiePersonId?: number | null
  automated?: boolean
}): ArrivalDecision {
  if (args.automated) return { kind: 'none' }
  const owner = args.session?.crmPersonId ?? null

  if (args.token && args.tokenPersonExists !== false) {
    const pid = args.token.personId
    if (owner === pid) return { kind: 'already', personId: pid }
    if (owner != null) return { kind: 'rotate', personId: pid }
    return { kind: 'identify', personId: pid, via: identifiedViaForChannel(args.token.channel) }
  }

  if (owner != null) return { kind: 'already', personId: owner }
  if (args.carryoverPersonId) return { kind: 'identify', personId: args.carryoverPersonId, via: 'rr_vid_carryover' }
  if (args.cookiePersonId) return { kind: 'identify', personId: args.cookiePersonId, via: 'rr_pid_cookie' }
  return { kind: 'none' }
}

/**
 * The raw token a track post carries: the explicit `identityToken` field (the
 * tracker forwards a token PersonIdentityBridge stashed before cleaning the
 * address bar), else the `_pid` param on the page URL itself.
 */
export function arrivalTokenFrom(args: { identityToken?: unknown; pageUrl?: string | null }): string | null {
  if (typeof args.identityToken === 'string' && args.identityToken.trim()) return args.identityToken.trim().slice(0, 120)
  const raw = typeof args.pageUrl === 'string' ? args.pageUrl : ''
  if (!raw.includes('_pid=')) return null
  try {
    return new URL(raw).searchParams.get('_pid')?.trim().slice(0, 120) || null
  } catch {
    return null
  }
}
