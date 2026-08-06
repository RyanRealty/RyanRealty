'use server'

/**
 * Self-serve newsletter membership WRITE for the signed-in user
 * (/account/notifications 'Monthly newsletter' toggle).
 *
 * The READ lives in the DAL (lib/data/newsletter/perLead
 * getNewsletterMembershipForUserEmail) so the page imports it from @/lib/data/*
 * per the page→action import gate. This file owns only the mutation:
 *
 *   - OFF: routes through unsubscribeNewsletterByToken — the EXACT status flip
 *     the public token unsubscribe page uses, including its global
 *     email-suppression mirror, so "off" here stops every marketing email, not
 *     just the newsletter row.
 *   - ON: consent-gated by the same canSubscribe('email') hard-stop semantics
 *     the CRM toggle uses (app/actions/crm-membership.ts), composed in the pure
 *     canUserResubscribe(): the OWNER of the address may clear only their own
 *     soft 'unsubscribe' suppression. A hard bounce, spam complaint,
 *     do_not_email, compliance hard-stop, or any tag-derived suppression is
 *     NEVER re-enabled from here — fail closed.
 *
 * This file sends nothing. Subscribing only writes the subscriber row; issues
 * go out solely through the approve-then-drain newsletter queue.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { subscribeToNewsletter, unsubscribeNewsletterByToken } from '@/lib/data/newsletter'
import {
  canUserResubscribe,
  collectEmailChannelSignals,
  getSubscriberForUserEmail,
  removeSoftEmailUnsubscribeByEmailValue,
} from '@/lib/data/newsletter/perLead'
import { getPersonIdsByEmail } from '@/lib/data/crm/getPersonIdsByEmail'
import { removeSuppression } from '@/lib/crm/suppressions'

export type SetMyNewsletterResult = { ok: true; subscribed: boolean } | { ok: false; error: string }

/** Flip the signed-in user's own newsletter membership. */
export async function setMyNewsletterMembership(subscribed: boolean): Promise<SetMyNewsletterResult> {
  const session = await getSession()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Sign in to manage your newsletter subscription.' }

  const sub = await getSubscriberForUserEmail(email)

  if (!subscribed) {
    // OFF: the same status flip the public token page performs (status ->
    // unsubscribed + the durable global email-suppression mirror).
    if (sub?.status === 'active') {
      const r = await unsubscribeNewsletterByToken(sub.unsubscribeToken)
      if (!r.ok) return { ok: false, error: 'Could not update your subscription. Try again.' }
    }
    revalidatePath('/account/notifications')
    return { ok: true, subscribed: false }
  }

  // ON: consent gate FIRST — never re-enable over a hard stop. The signal
  // collection fails closed (a read error surfaces as an 'all' blocker).
  const signals = await collectEmailChannelSignals(email)
  const decision = canUserResubscribe(signals, sub?.status ?? null)
  if (!decision.allowed) {
    return { ok: false, error: 'Email to this address is paused and cannot be turned back on here. Reply to any of our emails to turn it back on.' }
  }

  const name =
    session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? null
  const r = await subscribeToNewsletter({ email, name, source: 'account-notifications' })
  if (!r.ok) return { ok: false, error: 'Could not update your subscription. Try again.' }

  // The owner re-opting-in clears ONLY the soft email 'unsubscribe' suppression
  // (scoped by reason at both keys — person-keyed via the chokepoint, and the
  // email-keyed value row the token path writes). Never a bounce, complaint,
  // do-not-email, or hard-stop — the decision above already refused those.
  const personIds = await getPersonIdsByEmail(email)
  for (const pid of personIds) {
    await removeSuppression({ personId: pid, channel: 'email', reason: 'unsubscribe' })
  }
  await removeSoftEmailUnsubscribeByEmailValue(email)

  revalidatePath('/account/notifications')
  return { ok: true, subscribed: true }
}
