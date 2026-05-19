/**
 * POST /api/listing-alerts/edit
 *
 * Admin-only endpoint for editing a subscriber's saved criteria (and / or
 * status) from the admin queue at /admin/listing-alerts. Mirrors the
 * existing admin-actions pattern: requires an authenticated admin session
 * (validated via the same getSession + getAdminRoleForEmail check used by
 * /admin/(protected)/layout.tsx).
 *
 * Request shape (JSON):
 *   {
 *     "id":              uuid,        // required — listing_alerts.id
 *     "criteria":        Partial<ListingAlertCriteria>,
 *     "name":            string,
 *     "community_slug":  string | null,
 *     "city_slug":       string | null,
 *     "status":          'active' | 'paused' | 'unsubscribed',
 *     "paused_until":    iso8601 | null,
 *     "consent_marketing": boolean
 *   }
 *
 * All update fields are optional — only those present in the request body
 * are applied. Returns 401 for unauthenticated, 403 for non-admin.
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §1 + §4.1
 */
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import type { ListingAlertCriteria } from '@/lib/listing-alerts/types'

export const dynamic = 'force-dynamic'

function pickNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t || undefined
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (body.community_slug === null) update.community_slug = null
  else if (typeof body.community_slug === 'string') update.community_slug = body.community_slug.trim() || null
  if (body.city_slug === null) update.city_slug = null
  else if (typeof body.city_slug === 'string') update.city_slug = body.city_slug.trim() || null

  if (typeof body.status === 'string') {
    const s = body.status.trim().toLowerCase()
    if (['active', 'paused', 'unsubscribed'].includes(s)) {
      update.status = s
      if (s === 'active') {
        update.paused_until = null
        update.pause_reason = null
        update.unsubscribed_at = null
      } else if (s === 'unsubscribed') {
        update.unsubscribed_at = new Date().toISOString()
      }
    }
  }
  if (body.paused_until === null) update.paused_until = null
  else if (typeof body.paused_until === 'string') update.paused_until = body.paused_until

  if (typeof body.consent_marketing === 'boolean') update.consent_marketing = body.consent_marketing
  if (typeof body.consent_sms === 'boolean') update.consent_sms = body.consent_sms

  if (body.criteria && typeof body.criteria === 'object') {
    const c = body.criteria as Record<string, unknown>
    const criteria: ListingAlertCriteria = {
      price_min: pickNumber(c.price_min) ?? 0,
      price_max: pickNumber(c.price_max) ?? 0,
      beds_min: pickNumber(c.beds_min) ?? 0,
      baths_min: pickNumber(c.baths_min),
      sqft_min: pickNumber(c.sqft_min),
      property_type: pickString(c.property_type) ?? 'A',
      subdivision: pickString(c.subdivision),
    }
    update.criteria = criteria
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listing_alerts')
    .update(update)
    .eq('id', id)
    .select('id, email, status, criteria, name, community_slug, city_slug, paused_until')
    .single()

  if (error || !data) {
    console.error('[listing-alerts/edit] update failed:', error)
    return NextResponse.json({ ok: false, error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, row: data })
}
