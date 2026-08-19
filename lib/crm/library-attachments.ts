import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { putAttachmentBytes } from '@/lib/crm/attachments'
import { buildBrokerVcard } from '@/lib/crm/broker-vcard'
import type { CrmAttachmentChannel, CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import { AGENCY_PAMPHLET_URL } from '@/lib/crm/email-signature'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { getBrokers } from '@/lib/data/brokers/getBrokers'

export type LibraryAttachmentKind = 'disclosure' | 'cma' | 'vcard'

const DISCLOSURE_FILE = 'oregon-initial-agency-disclosure-pamphlet.pdf'
const DISCLOSURE_NAME = 'Oregon-Agency-Disclosure.pdf'

async function disclosureBytes(): Promise<Buffer> {
  const disk = path.join(process.cwd(), 'public/docs', DISCLOSURE_FILE)
  try {
    return await fs.readFile(disk)
  } catch {
    const res = await fetch(AGENCY_PAMPHLET_URL)
    if (!res.ok) throw new Error('Could not load the agency disclosure PDF.')
    return Buffer.from(await res.arrayBuffer())
  }
}

export async function stageLibraryAttachment(params: {
  personId: number
  channel: CrmAttachmentChannel
  kind: LibraryAttachmentKind
  cmaSlug?: string
  brokerSlug: string | null
  brokerEmail?: string | null
}): Promise<{ ok: true; ref: CrmAttachmentRef } | { ok: false; error: string }> {
  if (params.kind === 'vcard' && params.channel === 'mms') {
    return { ok: false, error: 'Switch to Email to attach a vCard.' }
  }

  if (params.kind === 'disclosure') {
    const bytes = await disclosureBytes()
    return putAttachmentBytes({
      channel: params.channel,
      personId: params.personId,
      filename: DISCLOSURE_NAME,
      contentType: 'application/pdf',
      bytes,
    })
  }

  if (params.kind === 'cma') {
    const slug = String(params.cmaSlug ?? '').trim().toLowerCase()
    if (!slug) return { ok: false, error: 'Missing CMA.' }
    const { renderCmaPdfBuffer } = await import('@/lib/cma-pdf')
    const rendered = await renderCmaPdfBuffer(slug)
    return putAttachmentBytes({
      channel: params.channel,
      personId: params.personId,
      filename: `CMA-${slug}.pdf`,
      contentType: 'application/pdf',
      bytes: rendered.buffer,
    })
  }

  const brokers = await getBrokers()
  const email = (params.brokerEmail ?? '').trim().toLowerCase()
  const row =
    brokers.find((b) => (b.email ?? '').toLowerCase() === email) ??
    brokers.find((b) => b.slug === params.brokerSlug) ??
    brokers[0]
  const name = row?.fullName || CRM_BROKER_DISPLAY[params.brokerSlug ?? ''] || 'Ryan Realty'
  const vcf = buildBrokerVcard({
    name,
    email: row?.email ?? (email || null),
    phone: row?.phoneDirect ?? null,
  })
  const safeName = name.replace(/[^\w.\-]+/g, '-').replace(/^-|-$/g, '') || 'broker'
  return putAttachmentBytes({
    channel: params.channel,
    personId: params.personId,
    filename: `${safeName}.vcf`,
    contentType: 'text/vcard',
    bytes: Buffer.from(vcf, 'utf8'),
  })
}
