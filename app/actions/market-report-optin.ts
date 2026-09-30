'use server'

/**
 * Market report self-subscribe actions (saved-search master goal, W3).
 *
 * A SIGNED-IN site user opts themselves in or out of market report emails per
 * area from /account/notifications. Identity chain: session email → crm_people
 * (jsonb emails containment, deleted=false) → crm_report_subscriptions (one row
 * per person). When no CRM person exists yet, ensureNativeLead find-or-creates
 * a minimal native lead so the subscription has a person to hang off — the same
 * fallback the LP capture paths use.
 *
 * All reads/writes go through lib/data/crm/reportSubscriptionSelf (DAL boundary
 * G1). Actions return { data, error } and never throw.
 */
import { getSession } from '@/app/actions/auth'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import {
  buildMarketReportAreas,
  type ContactReportSubscription,
  type MarketReportArea,
} from '@/lib/data/crm/getContactReportSubscriptions'
import {
  findPersonIdByEmail,
  getSelfEmailStatus,
  getSelfReportSubscription,
  upsertSelfReportSubscription,
} from '@/lib/data/crm/reportSubscriptionSelf'
import { removeSoftEmailUnsubscribeByEmailValue } from '@/lib/data/newsletter/perLead'
import { logReportTimeline } from '@/lib/data/crm/marketReportSubscription'
import { removeSuppression } from '@/lib/crm/suppressions'

export type MyReportSubscriptionData = {
  /** Null when the user has never been subscribed (render the off default). */
  subscription: ContactReportSubscription | null
  /** The valid area options for the picker (registry cities + resort communities). */
  areas: MarketReportArea[]
  /** All email from Ryan Realty is off for this address, so no report arrives. */
  emailOff: boolean
  /** Only her own unsubscribe is in the way: she can turn email back on herself. */
  emailRestartable: boolean
}

export type SetMyReportSubscriptionInput = {
  areas: string[]
  frequency: string
  isActive: boolean
}

/** The signed-in user's market report subscription plus the valid area options. */
export async function getMyReportSubscriptionAction(): Promise<{
  data: MyReportSubscriptionData | null
  error: string | null
}> {
  try {
    const session = await getSession()
    if (!session?.user) return { data: null, error: 'Sign in to manage market report emails.' }
    const email = session.user.email?.trim()
    const areas = buildMarketReportAreas()
    if (!email) return { data: { subscription: null, areas, emailOff: false, emailRestartable: false }, error: null }

    const personId = await findPersonIdByEmail(email)
    const [subscription, status] = await Promise.all([
      personId ? getSelfReportSubscription(personId) : Promise.resolve(null),
      getSelfEmailStatus(personId, email),
    ])
    return {
      data: { subscription, areas, emailOff: status.off, emailRestartable: status.restartable },
      error: null,
    }
  } catch (err) {
    console.error('[getMyReportSubscriptionAction]', err)
    return { data: null, error: 'We could not load your market report preferences.' }
  }
}

/**
 * Save the signed-in user's market report subscription. Creates a minimal CRM
 * person (native lead) when none exists for the account email yet.
 */
export async function setMyReportSubscriptionAction(
  input: SetMyReportSubscriptionInput,
): Promise<{ data: ContactReportSubscription | null, error: string | null }> {
  try {
    const session = await getSession()
    if (!session?.user) return { data: null, error: 'Sign in to manage market report emails.' }
    const email = session.user.email?.trim()
    if (!email) {
      return { data: null, error: 'Add an email to your account to get market reports.' }
    }

    let personId = await findPersonIdByEmail(email)
    if (!personId) {
      const meta = session.user.user_metadata as Record<string, unknown> | undefined
      const name =
        typeof meta?.full_name === 'string' && meta.full_name.trim()
          ? meta.full_name.trim()
          : typeof meta?.name === 'string' && meta.name.trim()
            ? meta.name.trim()
            : null
      const ensured = await ensureNativeLead({
        name,
        email,
        source: 'market-report-optin',
        tags: ['source:market-report-optin'],
      })
      personId = ensured.personId > 0 ? ensured.personId : null
    }
    if (!personId) {
      return { data: null, error: 'We could not set up your subscription. Reach out and we will handle it.' }
    }

    return await upsertSelfReportSubscription(personId, {
      areas: Array.isArray(input.areas) ? input.areas : [],
      frequency: String(input.frequency ?? ''),
      isActive: input.isActive === true,
    })
  } catch (err) {
    console.error('[setMyReportSubscriptionAction]', err)
    return { data: null, error: 'We could not save your market report preferences. Try again.' }
  }
}

/**
 * "Start receiving Ryan Realty email again" on the account page: the signed-in
 * person's own consent, which lifts ONLY her own soft `unsubscribe`
 * suppression (her person row and her address). A bounce, a complaint, a
 * do-not-email tag or a compliance hard stop stays, and the answer says so.
 * Writes a crm_timeline row naming the account page.
 */
export async function restartMyEmailAction(): Promise<{ data: { emailOff: boolean } | null; error: string | null }> {
  try {
    const session = await getSession()
    if (!session?.user) return { data: null, error: 'Sign in to manage your email.' }
    const email = session.user.email?.trim()
    if (!email) return { data: null, error: 'Add an email to your account first.' }
    const personId = await findPersonIdByEmail(email)
    const status = await getSelfEmailStatus(personId, email)
    if (!status.off) return { data: { emailOff: false }, error: null }
    if (!status.restartable) {
      return {
        data: null,
        error: 'Email to this address is off for a reason we cannot clear here. Reply to any of our emails and we will sort it out.',
      }
    }
    if (personId) await removeSuppression({ personId, channel: 'email', reason: 'unsubscribe' })
    await removeSoftEmailUnsubscribeByEmailValue(email)
    if (personId) {
      await logReportTimeline(personId, {
        title: "Email turned back on from the account page (the contact's own request)",
        payload: { via: 'self-serve', change: 'restart-all-email' },
        source: 'self-serve',
      })
    }
    const after = await getSelfEmailStatus(personId, email)
    return { data: { emailOff: after.off }, error: null }
  } catch (err) {
    console.error('[restartMyEmailAction]', err)
    return { data: null, error: 'We could not turn email back on. Try again.' }
  }
}
