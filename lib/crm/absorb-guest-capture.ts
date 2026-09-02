/**
 * Guest listing-save absorb — the sign-in half of guest home-saving
 * (funnel 2026-09-01; the public half is submitListingSaveCapture).
 *
 * A logged-out visitor saves a home by typing an email into the guest save
 * sheet (which creates a crm person for that email), then taps "Save with
 * Google instead" and signs in under a DIFFERENT email. Same human, two crm
 * people. On sign-in, absorb the minutes-old guest capture into the verified
 * account person — fail-closed, same posture as the P12 high-confidence
 * auto-merge (lib/crm/high-confidence-merge.ts).
 *
 * MUST run BEFORE the sign-in's own stitchVisitorIdentity call:
 * visitor_identity_map keeps ONE row per rr_vid (upsert), so the guest
 * form_submit stitch this reads is overwritten by the sign-in stitch.
 *
 * High confidence requires ALL of:
 *  - this browser's identity-map row was stitched via form_submit within the
 *    last hour, to a different email than the sign-in email
 *  - that guest email uniquely resolves to ONE living person (B) whose only
 *    email is the guest email, whose row was created within the last hour,
 *    and who carries the guest capture's source:idx-registration tag
 *  - B has no protected tags, is not stage Trash, not already merged
 *  - the sign-in email resolves to a living account person (A), A ≠ B
 *
 * The survivor is ALWAYS the account person: a verified auth identity beats
 * an unverified typed email. mergePeopleCore unions B's email, tags, and
 * timeline onto A, so the guest email survives as a secondary on A.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mergePeopleCore } from '@/lib/crm/merge-people'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

const PROTECTED = new Set([
  'compliance:hard-stop',
  'contact:do-not-text',
  'contact:do-not-call',
])

const FRESH_WINDOW_MS = 60 * 60 * 1000 // guest capture and its stitch: past hour only

export type GuestAbsorbResult =
  | { merged: false; reason: string }
  | { merged: true; survivorId: number; mergedId: number }

function withinWindow(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && Date.now() - t <= FRESH_WINDOW_MS
}

export async function absorbGuestCaptureOnSignIn(
  sb: SupabaseClient,
  input: { rrVid: string | null | undefined; accountEmail: string; accountPersonId: number | null },
): Promise<GuestAbsorbResult> {
  const accountEmail = input.accountEmail.trim().toLowerCase()
  if (!input.rrVid) return { merged: false, reason: 'no_rr_vid' }
  if (!accountEmail) return { merged: false, reason: 'no_account_email' }
  const accountPersonId = input.accountPersonId
  if (!accountPersonId || accountPersonId <= 0) return { merged: false, reason: 'no_account_person' }

  const { data: prior, error: mapErr } = await sb
    .from('visitor_identity_map')
    .select('email, crm_person_id, identify_source, identified_at')
    .eq('rr_vid', input.rrVid)
    .maybeSingle()
  if (mapErr) return { merged: false, reason: 'identity_map_read_failed:' + mapErr.message }
  if (!prior) return { merged: false, reason: 'no_prior_stitch' }

  const guestEmail = String(prior.email ?? '').trim().toLowerCase()
  if (!guestEmail) return { merged: false, reason: 'prior_stitch_has_no_email' }
  if (guestEmail === accountEmail) return { merged: false, reason: 'same_email' } // claim-by-email covers it
  if (prior.identify_source !== 'form_submit') return { merged: false, reason: 'prior_stitch_not_form_submit' }
  if (!withinWindow(prior.identified_at as string | null)) return { merged: false, reason: 'prior_stitch_stale' }

  let guestIds: number[]
  try {
    guestIds = await personIdsByEmailCi(sb, guestEmail)
  } catch (e) {
    return { merged: false, reason: 'guest_email_lookup_failed:' + (e as Error).message }
  }
  if (guestIds.length !== 1) return { merged: false, reason: `guest_email_not_unique:${guestIds.length}` }
  const guestId = guestIds[0]
  const stitchedId = Number(prior.crm_person_id ?? 0)
  if (stitchedId > 0 && stitchedId !== guestId) return { merged: false, reason: 'stitched_person_mismatch' }
  if (guestId === accountPersonId) return { merged: false, reason: 'already_same_person' }

  const { data: guest, error: guestErr } = await sb
    .from('crm_people')
    .select('id, name, first_name, last_name, emails, tags, custom, deleted, stage, created_at')
    .eq('id', guestId)
    .maybeSingle()
  if (guestErr || !guest) return { merged: false, reason: 'guest_person_read_failed' }
  if (guest.deleted) return { merged: false, reason: 'guest_deleted' }
  if (guest.stage === 'Trash') return { merged: false, reason: 'guest_in_trash' }
  const custom = (guest.custom ?? {}) as Record<string, unknown>
  if (custom.merged_into) return { merged: false, reason: 'guest_already_merged' }
  if (!withinWindow(guest.created_at as string | null)) return { merged: false, reason: 'guest_not_fresh' }
  const tags = (guest.tags ?? []) as string[]
  if (tags.some((t) => PROTECTED.has(t))) return { merged: false, reason: 'guest_protected_tags' }
  if (!tags.includes('source:idx-registration')) return { merged: false, reason: 'guest_not_idx_capture' }
  const guestEmails = ((guest.emails ?? []) as Array<{ value?: string }>)
    .map((e) => String(e?.value ?? '').trim().toLowerCase())
    .filter(Boolean)
  if (guestEmails.length !== 1 || guestEmails[0] !== guestEmail) {
    return { merged: false, reason: 'guest_has_other_emails' }
  }

  const { data: account, error: acctErr } = await sb
    .from('crm_people')
    .select('id, deleted, stage')
    .eq('id', accountPersonId)
    .maybeSingle()
  if (acctErr || !account) return { merged: false, reason: 'account_person_read_failed' }
  if (account.deleted || account.stage === 'Trash') return { merged: false, reason: 'account_person_dead' }

  const mergedName =
    String(guest.name ?? '').trim() ||
    [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim() ||
    guestEmail
  try {
    const res = await mergePeopleCore(sb, {
      survivorId: accountPersonId,
      mergedId: guestId,
      mergedName,
      actor: { email: 'guest-save-absorb@system', brokerSlug: null },
    })
    return { merged: true, survivorId: res.survivorId, mergedId: res.mergedId }
  } catch (e) {
    return { merged: false, reason: 'merge_failed:' + (e as Error).message }
  }
}
