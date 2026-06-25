import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmTags — the cached read side of the crm_tags TAXONOMY plus the live usage
 * count per tag computed from crm_people.tags.
 *
 * crm_tags is the canonical key list (autocomplete source + protected compliance
 * tags). The actual tags live on crm_people.tags (text[]). This reader joins the
 * two: every taxonomy row, annotated with how many non-deleted people currently
 * carry that exact key. The count powers the tag manager (so an admin sees what a
 * rename/merge/delete will touch) and is what bulk-add-tag (Wave 3) + the contact
 * card tag autocomplete render against.
 *
 * DAL boundary (G1): the raw .from() reads live here. Two reads, one cache entry:
 *   1. crm_tags — the taxonomy rows.
 *   2. crm_people.tags — every non-deleted person's tag array, tallied in JS into
 *      a key -> count map. (18K rows of a small text[] column; cached 5 min.)
 *
 * Cached on the crm-tags tag (5-min window — usage drifts as people are tagged;
 * every mutation in app/actions/crm-tags.ts revalidates the tag on write).
 *
 * Fails SOFT (empty array) on an unreadable taxonomy table; usage falls back to
 * zero (never throws) when the people read fails, so the manager degrades to "no
 * counts" rather than crashing.
 */
export type CrmTag = {
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
  /** How many non-deleted crm_people currently carry this exact key. */
  usageCount: number
}

/** The cache tag the CRUD actions revalidate on write. */
export const CRM_TAGS_TAG = 'crm-tags' as const

type RawTaxonomyRow = {
  key: string
  label: string
  position: number
  is_active: boolean
  is_protected: boolean
}

/**
 * Tally a list of per-person tag arrays into a key -> count map. Pure — exported
 * for the test. Each key counted once per person even if it appears twice in that
 * person's array (a duplicate on one record is one person carrying the tag).
 */
export function tallyTagUsage(peopleTags: ReadonlyArray<readonly string[] | null | undefined>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const tags of peopleTags) {
    if (!Array.isArray(tags)) continue
    const distinct = new Set<string>()
    for (const t of tags) {
      if (typeof t === 'string' && t.length > 0) distinct.add(t)
    }
    for (const key of distinct) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

export const getCrmTags = unstable_cache(
  async (): Promise<CrmTag[]> => {
    const sb = supabaseAnon()
    if (!sb) return []

    const { data: taxonomy, error: taxErr } = await sb
      .from('crm_tags')
      .select('key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('key', { ascending: true })
    if (taxErr || !taxonomy) {
      if (taxErr) console.error('[getCrmTags] taxonomy', taxErr.message)
      return []
    }

    // Usage tally — one column read across non-deleted people, counted in JS.
    // A people-read failure must NOT take down the taxonomy: fall back to zero.
    let counts = new Map<string, number>()
    const { data: peopleRows, error: peopleErr } = await sb
      .from('crm_people')
      .select('tags')
      .eq('deleted', false)
    if (peopleErr) {
      console.error('[getCrmTags] usage', peopleErr.message)
    } else if (peopleRows) {
      counts = tallyTagUsage((peopleRows as Array<{ tags: string[] | null }>).map((r) => r.tags))
    }

    return (taxonomy as RawTaxonomyRow[]).map((r) => ({
      key: r.key,
      label: r.label,
      position: r.position,
      isActive: r.is_active,
      isProtected: r.is_protected,
      usageCount: counts.get(r.key) ?? 0,
    }))
  },
  ['crm-tags-v1'],
  { revalidate: 300, tags: [CRM_TAGS_TAG] },
)
