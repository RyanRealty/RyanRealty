'use server'

/**
 * Days a broker is not bookable on /book.
 *
 * Exists because booking availability deliberately SKIPS all-day calendar
 * events: the TC system writes transaction milestones as all-day entries
 * ("Contract accepted · …"), and counting those as busy showed 4 bookable days
 * out of 15. The cost is that an all-day "Vacation" does not hold time either,
 * so a day off is stated here rather than guessed from an event title.
 *
 * Scope: a broker manages their own days off; a superuser may manage anyone's.
 * Mirrors the rule in app/actions/broker-settings.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import {
  addBookingBlackout,
  deleteBookingBlackout,
} from '@/lib/data/crm/bookingBlackouts'

export type BlackoutResult = { ok: true } | { ok: false; error: string }

const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')

const BlackoutInput = z.object({
  brokerSlug: z.string().trim().min(1),
  startsOn: DateKey,
  /** INCLUSIVE last day off. The DAL converts to the stored exclusive bound. */
  endsOn: DateKey,
  reason: z.string().trim().max(200).optional(),
})

/**
 * Which broker may this caller act on? Returns null when the answer is "none",
 * so every entry point fails closed rather than defaulting to the principal.
 */
async function resolveScope(requested: string): Promise<string | null> {
  const access = await getCrmAccess()
  if (!access) return null
  const own = CRM_BROKER_BY_EMAIL[String(access.email ?? '').trim().toLowerCase()] ?? null
  if (access.role === 'superuser') return requested || own
  if (access.role !== 'broker' || !own) return null
  // A broker may only ever touch their own calendar.
  return requested === own || !requested ? own : null
}

export async function addBookingBlackoutAction(raw: unknown): Promise<BlackoutResult> {
  const parsed = BlackoutInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the dates' }
  }
  const slug = await resolveScope(parsed.data.brokerSlug)
  if (!slug) return { ok: false, error: 'Not authorized' }

  if (parsed.data.endsOn < parsed.data.startsOn) {
    return { ok: false, error: 'The last day cannot be before the first day' }
  }

  const saved = await addBookingBlackout({
    brokerSlug: slug,
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    reason: parsed.data.reason ?? null,
  })
  if (!saved.ok) return { ok: false, error: saved.error ?? 'Could not save that day off' }

  revalidatePath('/book')
  revalidatePath('/admin/settings/booking')
  return { ok: true }
}

export async function deleteBookingBlackoutAction(
  id: number,
  brokerSlug: string,
): Promise<BlackoutResult> {
  const slug = await resolveScope(brokerSlug)
  if (!slug) return { ok: false, error: 'Not authorized' }
  const done = await deleteBookingBlackout(id, slug)
  if (!done.ok) return { ok: false, error: 'Could not remove that day off' }
  revalidatePath('/book')
  revalidatePath('/admin/settings/booking')
  return { ok: true }
}
