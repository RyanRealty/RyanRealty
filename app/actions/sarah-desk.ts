'use server'

import { cookies } from 'next/headers'
import { getSession } from '@/app/actions/auth'
import { lookupSarahAssignedBroker } from '@/lib/data/sarah/desk-broker'
import {
  deskBrokerFromAssigned,
  type SarahDeskBroker,
} from '@/lib/sarah/desk-broker'

export type SarahDeskResult = { data: SarahDeskBroker; error: string | null }

export async function getSarahDeskBroker(): Promise<SarahDeskResult> {
  try {
    const session = await getSession()
    const jar = await cookies()
    const assigned = await lookupSarahAssignedBroker({
      authEmail: session?.user.email ?? null,
      authUserId: session?.user.id ?? null,
      rrVid: jar.get('rr_vid')?.value ?? null,
    })
    return { data: deskBrokerFromAssigned(assigned), error: null }
  } catch (err) {
    console.error('[getSarahDeskBroker]', err)
    return { data: deskBrokerFromAssigned(null), error: null }
  }
}
