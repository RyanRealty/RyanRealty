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
  getSelfReportSubscription,
  upsertSelfReportSubscription,
} from '@/lib/data/crm/reportSubscriptionSelf'

export type MyReportSubscriptionData = {
  /** Null when the user has never been subscribed (render the off default). */
  subscription: ContactReportSubscription | null
  /** The valid area options for the picker (registry cities + resort communities). */
  areas: MarketReportArea[]
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
    if (!email) return { data: { subscription: null, areas }, error: null }

    const personId = await findPersonIdByEmail(email)
    const subscription = personId ? await getSelfReportSubscription(personId) : null
    return { data: { subscription, areas }, error: null }
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
