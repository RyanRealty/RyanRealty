import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmNewsletterSegments — the cached read side of the crm_newsletter_segments
 * config table.
 *
 * Replaces the hardcoded SEGMENTS const (app/actions/newsletter.ts) as the source
 * of newsletter audience segments for any READ surface (the admin audience
 * picker). Returns the full set ordered by picker position (callers filter
 * is_active themselves for the picker vs. counts — a subscriber on a deactivated
 * segment still needs the label to render).
 *
 * DAL boundary (G1): the raw .from('crm_newsletter_segments') read lives here,
 * inside lib/data/. Cached because segments change rarely; the mutation actions
 * (app/actions/crm-newsletter-segments.ts) revalidate the affected pages on every
 * change.
 *
 * Fails SOFT (empty array) on an unreadable table so a segment-driven surface
 * degrades to "no segments" rather than crashing. The newsletter picker keeps the
 * hardcoded SEGMENTS list as its fallback during migration.
 */
export type CrmNewsletterSegment = {
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
}

export const getCrmNewsletterSegments = unstable_cache(
  async (): Promise<CrmNewsletterSegment[]> => {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_newsletter_segments')
      .select('key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('key', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmNewsletterSegments]', error.message)
      return []
    }
    return (
      data as Array<{ key: string; label: string; position: number; is_active: boolean; is_protected: boolean }>
    ).map((r) => ({
      key: r.key,
      label: r.label,
      position: r.position,
      isActive: r.is_active,
      isProtected: r.is_protected,
    }))
  },
  ['crm-newsletter-segments-v1'],
  { revalidate: 300, tags: ['crm-newsletter-segments'] },
)
