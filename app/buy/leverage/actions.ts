'use server'

import { submitLeadLandingForm } from '@/app/actions/lead-landing'
import {
  LEVERAGE_FORM_ID,
  LEVERAGE_LEAD_TYPE,
  LEVERAGE_LP_VARIANT,
  LEVERAGE_TITLE,
  ROUTE_PATH,
} from './_v3/leverage-constants'

export type LeverageLeadKind = 'report' | 'consult'

type LpContextInput = {
  lp_variant?: string
  lp_source?: string
  lp_medium?: string
  lp_campaign?: string
  lp_content?: string
  lp_term?: string
  fbclid?: string
  gclid?: string
}

export type SubmitLeverageLeadInput = {
  kind: LeverageLeadKind
  name: string
  email: string
  phone?: string
  message?: string
  adMatchConsent?: boolean
  sessionId?: string
  company?: string
  lpContext?: LpContextInput
}

export async function submitLeverageLead(
  input: SubmitLeverageLeadInput,
): Promise<{ error: string | null }> {
  if (input.company?.trim()) return { error: null }

  const kind = input.kind === 'consult' ? 'consult' : 'report'
  return submitLeadLandingForm({
    audience: 'buyer',
    pageTitle: LEVERAGE_TITLE,
    pagePath: ROUTE_PATH,
    leadIntent: kind === 'consult' ? 'buyer-consult' : 'weekly-deal-report',
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    lpContext: {
      ...input.lpContext,
      lp_variant: input.lpContext?.lp_variant ?? LEVERAGE_LP_VARIANT,
    },
    sessionId: input.sessionId,
    formId: LEVERAGE_FORM_ID,
    leadType: LEVERAGE_LEAD_TYPE,
    lpVariant: LEVERAGE_LP_VARIANT,
    omitCapiValue: true,
    adMatchConsent: input.adMatchConsent,
  })
}
