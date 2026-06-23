'use server'

/**
 * Server actions for housing-market routes.
 *
 * submitMarketPageInquiry — broker inquiry from the housing-market flagship
 * page (app/housing-market/[...slug]/page.tsx). Captures the lead through the
 * shared submitPageCTA path (FUB person + event, Meta CAPI, canonical tagging,
 * GA4 mirror) so a market-page lead is never dropped. Signature matches
 * LeadCaptureBlock's `onSubmit` contract:
 *   (payload: LeadCapturePayload) => Promise<{ ok: boolean; message?: string }>
 *
 * The form is framed as an inquiry (a broker follows up), NOT a "monthly
 * report" — there is no monthly-report email automation, and promising one we
 * cannot send would violate the §0 honesty rule. If a real market-report
 * newsletter cadence is built later, switch leadType to 'newsletter' and wire
 * the action plan.
 */

import type { LeadCapturePayload } from '@/components/site/LeadCaptureBlock'
import { submitPageCTA } from '@/app/actions/lead-capture'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'

export async function submitMarketPageInquiry(
  payload: LeadCapturePayload,
): Promise<{ ok: boolean; message?: string }> {
  if (payload.variant !== 'inquiry') {
    return { ok: false, message: 'Unexpected form variant.' }
  }

  const name = payload.name?.trim()
  const email = payload.email?.trim()
  const message = payload.message?.trim()

  if (!name || !email) {
    return { ok: false, message: 'Name and email are required.' }
  }

  const contextParts = ['Housing-market page inquiry']
  if (name) contextParts.push(`from ${name}`)
  if (message) contextParts.push(message.slice(0, 180))

  const { error } = await submitPageCTA({
    email,
    leadType: 'general',
    context: contextParts.join(' — '),
  })

  if (error) {
    // FUB push failed — capture natively so a FUB outage/cutover never loses the
    // inquiry. Only surface an error if the native capture also fails.
    try {
      const native = await ensureNativeLead({
        name,
        email,
        source: 'housing-market-inquiry',
        tags: ['source:housing-market', 'fub-fallback'],
      })
      if (!native.created && native.personId === 0) {
        return { ok: false, message: error }
      }
      console.warn(`[housing-market] FUB push failed; native fallback lead ${native.created ? 'created' : 'reused'} crm person ${native.personId}`)
    } catch (e) {
      console.warn('[housing-market] native fallback failed:', e)
      return { ok: false, message: error }
    }
  }

  return { ok: true, message: 'Got it. A local broker will follow up.' }
}
