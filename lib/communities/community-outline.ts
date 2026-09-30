/**
 * community-outline: which stored outline a community page reads, and whether
 * that outline may be used at all. ONE decision for every outline read.
 *
 * THE OUTLINE is the `boundaries` row geo_type='neighborhood' keyed by the
 * registry entry's DURABLE slug (data/resort-communities.json `slug`). Those
 * rows are the source of truth: rebuilt from the Deschutes and Crook County
 * plat records on 2026-08-23 with the curated exclusions (see each entry's
 * `verification.corrected_2026_08_26`).
 *
 * KEYED BY THE REGISTRY, NEVER BY THE URL. The visitor URL of a rebrand is not
 * the durable key: /communities/juniper-preserve reads the row stored as
 * 'pronghorn' (11a2dbc8). Before 2026-09-25 the page read
 * boundaries(neighborhood, 'juniper-preserve'), found nothing, and drew no
 * map. A slug that is not a registry community has no community outline.
 *
 * TRUSTED unless data/boundary-sanity-baseline.json `allowed` lists the slug
 * (an oversized or otherwise wrong polygon awaiting correction, gated by
 * ci:boundary-sanity). An untrusted outline is not read by anything on the
 * page: not the map, not the homes list, not the child plats, not the schools.
 * Before 2026-09-25 the map honoured the baseline and the homes list did not,
 * so an outline the map refused still put its listings in the homes list.
 *
 * Isomorphic: committed JSON and string work only.
 */

import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import registry from '@/data/resort-communities.json' assert { type: 'json' }
import { publicCommunitySlug, type CommunityNamingEntry } from '@/lib/communities/community-public-pair'

type RegistryFile = { communities: CommunityNamingEntry[] }

const ENTRIES = (registry as unknown as RegistryFile).communities

/** Outlines awaiting correction. Nothing on a page reads one of these. */
const UNTRUSTED_OUTLINES: ReadonlySet<string> = new Set(
  ((boundarySanityBaseline as { allowed?: string[] }).allowed ?? []).map((slug) => slug.trim().toLowerCase()),
)

export type CommunityOutlineRef = {
  /** boundaries.geo_slug of the stored neighborhood row: the registry's durable slug. */
  outlineSlug: string
  /** False when the stored outline awaits correction; every outline read then stands down. */
  trusted: boolean
}

/**
 * The registry entry a community URL names: its durable slug or its public
 * (visitor) slug. Aliases and labels are not URLs and do not resolve here.
 */
function registryEntryForUrl(slug: string): CommunityNamingEntry | null {
  const key = slug.trim().toLowerCase()
  if (!key) return null
  return ENTRIES.find((entry) => entry.slug === key || publicCommunitySlug(entry) === key) ?? null
}

/**
 * The rule itself, over any baseline: an outline is trusted unless the
 * baseline lists it as awaiting correction. Pure, so it is tested on fixtures.
 */
export function outlineTrustedUnder(untrusted: ReadonlySet<string>, outlineSlug: string): boolean {
  return !untrusted.has(outlineSlug.trim().toLowerCase())
}

/** THE trust rule. One answer for the map, the homes list and every other outline read. */
export function isCommunityOutlineTrusted(outlineSlug: string): boolean {
  return outlineTrustedUnder(UNTRUSTED_OUTLINES, outlineSlug)
}

/**
 * Where a community page's outline lives and whether it may be read. Null for
 * a URL that is not a registry community (it has no stored outline).
 */
export function communityOutlineRef(slug: string): CommunityOutlineRef | null {
  const entry = registryEntryForUrl(slug)
  if (!entry) return null
  const outlineSlug = entry.slug.trim().toLowerCase()
  return { outlineSlug, trusted: isCommunityOutlineTrusted(outlineSlug) }
}

/** The outline slug to read, or null when there is none or it is not trusted. */
export function trustedCommunityOutlineSlug(slug: string): string | null {
  const ref = communityOutlineRef(slug)
  return ref?.trusted ? ref.outlineSlug : null
}
