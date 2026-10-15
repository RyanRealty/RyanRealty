'use server'

import { cookies } from 'next/headers'
import { getSession } from '@/app/actions/auth'
import { lookupSarahWebIntroBroker } from '@/lib/data/sarah/web-intro-broker'
import { WEB_GREETING_DEFAULT_BROKER, webGreetingBrokerFirstName } from '@/lib/sarah/scripts'

export type SarahWebIntroBrokerResult = { data: string; error: string | null }

export async function getSarahWebIntroBrokerFirstName(): Promise<SarahWebIntroBrokerResult> {
  try {
    const session = await getSession()
    const jar = await cookies()
    const assigned = await lookupSarahWebIntroBroker({
      authEmail: session?.user.email ?? null,
      authUserId: session?.user.id ?? null,
      rrVid: jar.get('rr_vid')?.value ?? null,
    })
    return { data: webGreetingBrokerFirstName(assigned), error: null }
  } catch (err) {
    console.error('[getSarahWebIntroBrokerFirstName]', err)
    return { data: WEB_GREETING_DEFAULT_BROKER, error: null }
  }
}
