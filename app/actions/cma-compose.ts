'use server'

/**
 * Stage a CMA PDF into CRM compose attachments.
 * Drafts are attachable. This does not publish or send.
 */

import { requireCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getCmaComposeTarget } from '@/lib/data/cma/compose-target'
import { getRecipientOptionsForContact } from '@/lib/data/crm/getRecipientOptionsForContact'
import { getBrokerSelfRecordByEmail } from '@/lib/data/brokers/getBrokers'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import {
  cmaComposeEmailBody,
  cmaComposeEmailSubject,
  cmaComposePdfFilename,
  cmaComposeSmsBody,
} from '@/lib/cma/crm-compose-copy'
import { renderCmaPdfBuffer } from '@/lib/cma-pdf'
import { uploadAttachmentBytes } from '@/lib/crm/attachments'
import { MMS_ATTACHMENT_LIMITS, type CrmAttachmentRef } from '@/lib/crm/attachment-limits'

export type CmaComposeStage = {
  attachment: CrmAttachmentRef
  subject: string
  emailBody: string
  smsBody: string
  householdEmails: string[]
  mmsOk: boolean
  textMePhone: string | null
}

export async function stageCmaPdfForComposeAction(input: {
  personId: number
  slug: string
  channel: 'email' | 'mms'
}): Promise<{ ok: true; data: CmaComposeStage } | { ok: false; error: string }> {
  try {
    const access = await requireCrmAccess()
    if (!access.ok) return access
    const personId = Number(input.personId)
    const slug = String(input.slug ?? '').trim().toLowerCase()
    const channel = input.channel === 'mms' ? 'mms' : 'email'
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Bad person id' }
    if (!slug) return { ok: false, error: 'Pick a CMA' }

    const scoped = await requirePersonInScope(personId, access.access)
    if (!scoped.ok) return scoped

    const target = await getCmaComposeTarget({ personId, slug })
    if (!target) return { ok: false, error: 'This CMA is not on this contact' }
    if (target.status === 'archived') return { ok: false, error: 'Restore the CMA before attaching it' }

    const address = applySlugStreetDirectional(target.subjectAddress || slug, slug)
    const pdf = await renderCmaPdfBuffer(slug)
    const filename = cmaComposePdfFilename(slug)
    const mmsOk = pdf.buffer.byteLength <= MMS_ATTACHMENT_LIMITS.maxFileBytes
    if (channel === 'mms' && !mmsOk) {
      return { ok: false, error: 'This PDF is too large for a text. Attach it on the email draft.' }
    }

    const uploaded = await uploadAttachmentBytes({
      channel,
      personId,
      filename,
      contentType: 'application/pdf',
      bytes: pdf.buffer,
    })
    if (!uploaded.ok) return uploaded

    const household = await getRecipientOptionsForContact(personId)
    const self = access.access.email ? await getBrokerSelfRecordByEmail(access.access.email) : null
    const textMePhone = typeof self?.phone === 'string' && self.phone.trim() ? self.phone.trim() : null

    return {
      ok: true,
      data: {
        attachment: uploaded.ref,
        subject: cmaComposeEmailSubject(address),
        emailBody: cmaComposeEmailBody(address),
        smsBody: cmaComposeSmsBody(address),
        householdEmails: household.map((o) => o.email),
        mmsOk,
        textMePhone,
      },
    }
  } catch (err) {
    console.error('[stageCmaPdfForComposeAction]', err)
    return { ok: false, error: 'Could not attach the CMA PDF' }
  }
}
