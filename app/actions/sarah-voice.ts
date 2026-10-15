'use server'

import { mintGrokRealtimeClientSecret } from '@/lib/grok/realtime'
import { getSarahDeskBroker } from '@/app/actions/sarah-desk'

export type SarahVoiceTokenResult = {
  data: {
    secret: string
    expiresAt: string | null
    model: string
    voice: string
    brokerFirstName: string
  } | null
  error: string | null
}

export async function mintSarahVoiceToken(): Promise<SarahVoiceTokenResult> {
  try {
    const [secret, desk] = await Promise.all([mintGrokRealtimeClientSecret(), getSarahDeskBroker()])
    return {
      data: {
        secret: secret.value,
        expiresAt: secret.expiresAt,
        model: secret.model,
        voice: secret.voice,
        brokerFirstName: desk.data.firstName,
      },
      error: null,
    }
  } catch (err) {
    console.error('[mintSarahVoiceToken]', err)
    return { data: null, error: 'Voice is unavailable right now. You can keep typing.' }
  }
}
