/**
 * Visitor marketing-sharing fields for Meta CAPI. Server actions fetch
 * /api/meta-capi without the browser's Cookie header, so they must forward
 * the consent cookie and Sec-GPC. Fail closed: no marketing grant, no send.
 */
import { cookies, headers } from 'next/headers'
import { CONSENT_COOKIE, marketingSharingAllowed } from '@/lib/identity/consent'

export async function visitorCapiConsent(): Promise<{
  allowed: boolean
  consentCookie?: string
  secGpc?: string
}> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()])
  const consentCookie = cookieStore.get(CONSENT_COOKIE)?.value
  const secGpc = hdrs.get('sec-gpc') ?? undefined
  return {
    allowed: marketingSharingAllowed({ consentCookie, secGpc }),
    consentCookie,
    secGpc,
  }
}
