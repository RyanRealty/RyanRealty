/**
 * DAL for an immediate broker-to-self SMS (CMA "text me this draft").
 * person_id stays null so the row is never a lead/homeowner send.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export async function insertBrokerSelfAlert(params: {
  broker: string
  toPhone: string
  body: string
  status: 'sent' | 'failed'
  error?: string | null
}): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb.from('crm_broker_alerts').insert({
    broker: params.broker,
    to_phone: params.toPhone,
    body: params.body.slice(0, 600),
    person_id: null,
    status: params.status,
    channel: params.status === 'sent' ? 'twilio-sms' : null,
    sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    error: params.error ? params.error.slice(0, 300) : null,
  })
  if (error) {
    console.error('[insertBrokerSelfAlert]', error.message)
  }
}
