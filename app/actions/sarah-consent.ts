'use server'

import { headers } from 'next/headers'
import {
  applySarahYesReply,
  insertSarahConsentEvent,
  queueSarahPostVoiceYes,
  type SarahConsentOutcome,
} from '@/lib/data/crm/sarah-consent'
import { decideSarahConsent, type SarahConsentChannel } from '@/lib/sarah/lead-consent'

async function requestMeta() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent') ?? null,
  }
}

export async function recordSarahConsent(input: {
  reply: string
  channel: SarahConsentChannel
  question: string
  phone?: string | null
  email?: string | null
  pageUrl?: string | null
  sessionId?: string | null
  personId?: number | null
}): Promise<{ data: { id: number | null; marketing: boolean } | null; error: string | null }> {
  try {
    const decision = decideSarahConsent(input.reply, input.channel)
    if (!decision) return { data: null, error: 'yes or no needed' }
    const meta = await requestMeta()
    let outcome: SarahConsentOutcome = 'declined'
    if (decision.granted && decision.marketing) outcome = 'granted-marketing'
    else if (decision.granted) outcome = 'granted-request'
    const logged = await insertSarahConsentEvent({
      outcome,
      marketing: decision.marketing,
      channel: input.channel,
      question: input.question,
      reply: input.reply,
      phone: input.phone,
      email: input.email,
      pageUrl: input.pageUrl,
      sessionId: input.sessionId,
      personId: input.personId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    if (decision.needsPostVoiceYes && input.phone) {
      await queueSarahPostVoiceYes({
        phone: input.phone,
        sessionId: input.sessionId,
        personId: input.personId,
        pageUrl: input.pageUrl,
      })
    }
    return { data: { id: logged.id, marketing: decision.marketing }, error: logged.error }
  } catch (err) {
    console.error('[recordSarahConsent]', err)
    return { data: null, error: 'Could not save consent' }
  }
}

export async function recordSarahYesReply(input: {
  phone: string
  reply: string
  personId?: number | null
  sessionId?: string | null
}): Promise<{ data: { id: number | null } | null; error: string | null }> {
  try {
    const logged = await applySarahYesReply(input)
    return { data: { id: logged.id }, error: logged.error }
  } catch (err) {
    console.error('[recordSarahYesReply]', err)
    return { data: null, error: 'Could not save YES' }
  }
}
