/**
 * CRM helpers that used to dual-write against a retired vendor.
 * Native capture writes crm_people directly. These remain as:
 *   - phone normalize (shared)
 *   - OAuth avatar stamp
 *   - site-event timeline rows
 * Pull-from-vendor functions no-op.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { mirrorHealthStatus } from './mirror-health'

let killSwitchWarned = false

function mirrorEnabled(): boolean {
  const health = mirrorHealthStatus({ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED })
  if (health.level === 'alarm' && !killSwitchWarned) {
    killSwitchWarned = true
    console.warn(health.message)
  }
  return health.enabled
}

export function normalizeCrmPhone(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return d || null
}

/** Retired vendor pull — no-op. */
export async function mirrorPersonFromLegacy(_personId: number): Promise<void> {
  return
}

/**
 * Save the OAuth profile photo (Google/Facebook sign-in) onto the CRM person.
 */
export async function saveOauthAvatarByEmail(email: string | null | undefined, avatarUrl: string | null | undefined): Promise<void> {
  const cleanedEmail = String(email ?? '').trim().toLowerCase()
  const url = String(avatarUrl ?? '').trim()
  if (!cleanedEmail || !/^https:\/\//.test(url)) return
  try {
    const sb = createServiceClient()
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', cleanedEmail)
      .limit(1)
      .maybeSingle()
    if (!pt?.person_id) return
    await sb.from('crm_people').update({ picture_url: url.slice(0, 1024), updated_at: new Date().toISOString() }).eq('id', pt.person_id)
  } catch (err) {
    console.warn('[crm-mirror] saveOauthAvatarByEmail error:', err)
  }
}

/** Retired vendor pull — no-op. */
export async function mirrorPersonByEmail(_email: string | null | undefined): Promise<void> {
  return
}

/**
 * Site behavioral event → CRM timeline, in real time.
 * One chokepoint: listing views, searches, saves, inquiries, and return visits
 * land on the contact's CRM timeline the moment they happen.
 */
export async function mirrorSiteEvent(params: {
  email: string | null | undefined
  type: string
  source?: string
  pageUrl?: string
  pageTitle?: string
  message?: string
  propertyStreet?: string
}): Promise<void> {
  if (!mirrorEnabled()) return
  const email = String(params.email ?? '').trim().toLowerCase()
  if (!email) return
  try {
    const sb = createServiceClient()
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', email)
      .limit(1)
      .maybeSingle()
    if (pt?.person_id) {
      await sb.from('crm_timeline').insert({
        person_id: pt.person_id,
        kind: 'web_event',
        title: [params.type, params.propertyStreet ?? params.pageTitle].filter(Boolean).join(' · ').slice(0, 180),
        body: params.message ?? params.pageUrl ?? null,
        payload: {
          type: params.type,
          source: params.source ?? null,
          pageUrl: params.pageUrl ?? null,
          property: params.propertyStreet ?? null,
        },
        source: 'site',
      })
    }
  } catch (err) {
    console.warn('[crm-mirror] mirrorSiteEvent error:', err)
  }
}

/** Retired vendor dual-write — no-op. */
export async function mirrorNoteToCrm(
  _personId: number,
  _body: string,
  _opts: { fubNoteId?: number; broker?: string } = {},
): Promise<void> {
  return
}

/** Retired vendor dual-write — no-op. */
export async function mirrorTaskToCrm(
  _personId: number,
  _task: { name: string; type?: string; dueAt?: string | null; fubTaskId?: number },
): Promise<void> {
  return
}

/** Retired vendor dual-write — no-op. */
export async function mirrorEnrollmentToCrm(_personId: number, _legacyPlanId: number): Promise<void> {
  return
}
