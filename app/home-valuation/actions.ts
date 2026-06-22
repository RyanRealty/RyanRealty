'use server'

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { sendEvent, findPersonByEmail } from '@/lib/followupboss'
import { sendEmail } from '@/lib/resend'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { createServiceClient } from '@/lib/supabase/service'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { headers } from 'next/headers'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.RESEND_ADMIN_EMAIL ?? ''

export type ValuationFormState = { error?: string; success?: boolean; cmaSent?: boolean; eventId?: string }

/** Try to find a property in DB by address components (for auto-CMA). */
async function findPropertyByAddress(params: {
  street?: string | null
  city: string
  state?: string | null
  postalCode?: string | null
}): Promise<string | null> {
  const city = params.city?.trim()
  if (!city) return null

  const { findPropertiesByAddressFilter } = await import('@/lib/data')
  const rows = await findPropertiesByAddressFilter({
    city,
    state: params.state ?? null,
    postalCode: params.postalCode ?? null,
    limit: 20,
  })
  if (!rows?.length) return null

  const streetParts = (params.street ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
  if (streetParts.length === 0) {
    return rows.length === 1 ? (rows[0] as { id: string }).id : null
  }

  for (const row of rows as { id: string; unparsed_address?: string }[]) {
    const addr = (row.unparsed_address ?? '').toLowerCase()
    if (streetParts.every((p) => addr.includes(p))) return row.id
  }
  return rows.length === 1 ? (rows[0] as { id: string }).id : null
}

export async function submitValuationRequest(formData: FormData): Promise<ValuationFormState> {
  const rawAddress = formData.get('address')?.toString()?.trim() ?? ''
  const name = formData.get('name')?.toString()?.trim() ?? ''
  const email = formData.get('email')?.toString()?.trim() ?? ''
  const phone = formData.get('phone')?.toString()?.trim() ?? ''

  if (!email) return { error: 'Email is required' }
  if (!rawAddress) return { error: 'Property address is required' }

  // Parse combined address into components (best-effort)
  const parts = rawAddress.split(',').map((s) => s.trim()).filter(Boolean)
  const street = parts[0] ?? ''
  const city = parts[1] ?? ''
  const stateZip = parts[2] ?? ''
  const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/)
  const state = stateZipMatch?.[1] ?? stateZip.replace(/\d/g, '').trim()
  const postalCode = stateZipMatch?.[2] ?? parts[3]?.trim() ?? ''

  const { insertValuationRequest } = await import('@/lib/data')
  const insertRes = await insertValuationRequest({
    address_street: street || null,
    address_city: city,
    address_state: state || null,
    address_postal_code: postalCode || null,
    name: name || null,
    email,
    phone: phone || null,
    source_url: `${siteUrl}/home-valuation`,
  })
  if (!insertRes.ok) return { error: insertRes.error ?? 'insert failed' }

  const fullAddress = [street, city, state, postalCode].filter(Boolean).join(', ')

  let originUtmSource: string | undefined
  let originUtmMedium: string | undefined
  let originUtmCampaign: string | undefined
  let originUtmContent: string | undefined
  try {
    const referer = (await headers()).get('referer') ?? ''
    if (referer) {
      const refUrl = new URL(referer)
      originUtmSource = refUrl.searchParams.get('utm_source') ?? undefined
      originUtmMedium = refUrl.searchParams.get('utm_medium') ?? undefined
      originUtmCampaign = refUrl.searchParams.get('utm_campaign') ?? undefined
      originUtmContent = refUrl.searchParams.get('utm_content') ?? undefined
    }
  } catch {}

  const fubRes = await sendEvent({
    type: 'Seller Inquiry',
    person: {
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone && { phones: [{ value: phone }] }),
    },
    source,
    sourceUrl: `${siteUrl}/home-valuation`,
    message: `Home Valuation request: ${fullAddress || '(address not provided)'}`,
    property: {
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      code: postalCode || undefined,
    },
    campaign: originUtmSource
      ? {
          source: originUtmSource,
          ...(originUtmMedium && { medium: originUtmMedium }),
          ...(originUtmCampaign && { campaign: originUtmCampaign }),
          ...(originUtmContent && { content: originUtmContent }),
        }
      : undefined,
  })
  if (!fubRes.ok) {
    // Lead is saved; log but don't fail
    console.warn('[valuation] FUB send failed:', fubRes.error)
  }

  // Canonical tagging — apply audience:seller + source:home-valuation +
  // broker:matt + write to marketing_assignments so this lead surfaces in
  // the same dashboards as /lp/seller-home-value submissions. Fire-and-forget
  // so a tagging failure never blocks lead capture.
  void (async () => {
    try {
      const found = await findPersonByEmail(email)
      if (found?.id) {
        await canonicallyTagLead({
          fubPersonId: found.id,
          audience: 'seller',
          source: 'cma-request',
          tier: 'warm',
          address: fullAddress,
          state: state || undefined,
        })
      }
    } catch (err) {
      console.warn('[valuation] canonical tagging failed (non-blocking):', err)
    }
  })()

  if (ADMIN_EMAIL) {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Home Valuation request from ${name || email}`,
      text: [
        `Name: ${name || '—'}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : '',
        `Address: ${fullAddress || '—'}`,
        `Source: ${siteUrl}/home-valuation`,
      ].filter(Boolean).join('\n'),
      replyTo: email,
    }).catch(() => {})
  }

  let cmaSent = false
  try {
    const propertyId = await findPropertyByAddress({ street: street || null, city, state: state || null, postalCode: postalCode || null })
    if (propertyId) {
      let cma = await getCachedCMA(propertyId)
      if (!cma) cma = await computeCMA(propertyId)
      if (cma) {
        void createServiceClient
        const { getPropertyById, getCityListings: getCityListingsDAL } = await import('@/lib/data')
        const pAddr = await getPropertyById(propertyId)

        // Find listing by matching address via listing_tile_mv.
        type ValListingRow = { ListingKey?: string; BedroomsTotal?: number; BathroomsTotal?: number; TotalLivingAreaSqFt?: number; PhotoURL?: string; ListAgentName?: string }
        let listingRow: ValListingRow | null = null
        if (pAddr?.city) {
          const tiles = await getCityListingsDAL(pAddr.city, {
            status: 'all',
            sort: 'newest',
            limit: 500,
            postalCode: pAddr.postal_code && /^\d{5}$/.test(pAddr.postal_code) ? pAddr.postal_code : undefined,
          })
          const match = pAddr.street_number
            ? tiles.find((t) => String(t.streetNumber ?? '') === String(pAddr.street_number))
            : tiles[0]
          if (match) {
            listingRow = {
              ListingKey: match.listingKey,
              BedroomsTotal: match.beds ?? undefined,
              BathroomsTotal: match.baths ?? undefined,
              TotalLivingAreaSqFt: match.sqft ?? undefined,
              PhotoURL: match.photoUrl ?? undefined,
            }
          }
        }

        const pdfData = {
          cma,
          address: pAddr?.unparsed_address ?? fullAddress,
          beds: listingRow?.BedroomsTotal ?? null,
          baths: listingRow?.BathroomsTotal ?? null,
          sqft: listingRow?.TotalLivingAreaSqFt ?? null,
          lotAcres: null,
          yearBuilt: null,
          heroPhotoUrl: listingRow?.PhotoURL ?? null,
          agentName: listingRow?.ListAgentName ?? null,
          agentEmail: null,
          agentPhone: null,
        }
        const doc = React.createElement(CMAPdfDocument, { data: pdfData })
        type DocElement = Parameters<typeof renderToBuffer>[0]
        const buffer = await renderToBuffer(doc as DocElement)
        const sent = await sendEmail({
          to: email,
          subject: `Your Home Valuation – ${fullAddress || 'Property'}`,
          text: `Hi${name ? ` ${name.split(/\s+/)[0]}` : ''},\n\nAttached is your Comparative Market Analysis for ${fullAddress || 'your property'}.\n\nIf you have questions or want to discuss next steps, reply to this email or give us a call.\n\nBest,\nRyan Realty`,
          attachments: [{ filename: 'home-valuation.pdf', content: Buffer.from(buffer) }],
        })
        cmaSent = !sent.error
      }
    }
  } catch (e) {
    console.warn('[valuation] Auto-CMA failed:', e)
  }

  // Every seller lead hears back immediately. Matched addresses got the CMA
  // above; everyone else (no property match, or CMA generation/send failed)
  // gets a same-second acknowledgment from the verified domain so no lead goes
  // cold on first contact. firstName is parsed from the submitted `name` (same
  // value used for the FUB person + the CMA greeting) — this is a transactional
  // Resend send, not a FUB merge tag, because FUB blocks integration emails.
  // reply-to is a monitored inbox so "reply to this email" actually reaches us.
  if (!cmaSent) {
    const firstName = name.split(/\s+/)[0] || ''
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
    await sendEmail({
      to: email,
      replyTo: 'matt@ryan-realty.com',
      subject: 'We have your home-value request',
      text: [
        greeting,
        '',
        'Thank you for requesting a value estimate on your home. We have it, and someone on our team is pulling the numbers now.',
        '',
        'We do these by hand. Instead of an automated guess, we look at recent comparable sales and what is actually happening in your neighborhood right now, so the figure you get is one you can use. You will hear back from us shortly.',
        '',
        'If there is anything we should know about the home, recent updates, your timeline, or any questions, just reply to this email.',
        '',
        'Thanks again,',
        'Matt Ryan',
        'Ryan Realty',
        '541.213.6706',
        'ryan-realty.com',
      ].join('\n'),
    }).catch((err) => console.warn('[valuation] acknowledgment email failed (non-blocking):', err))
  }

  // Send to Meta CAPI for deduplication with browser pixel.
  // Seller leads (valuation requests) are the highest-intent funnel entry,
  // so they carry the highest value per event. Meta's bid algorithm uses
  // this to push budget toward seller-acquisition campaigns.
  const eventId = generateEventId()
  await fetch(`${siteUrl}/api/meta-capi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName: 'Lead',
      email,
      phone,
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      eventId,
      customData: {
        property_address: fullAddress,
        lead_type: 'seller_valuation',
        value: 500,
        currency: 'USD',
      },
      eventSourceUrl: `${siteUrl}/home-valuation`,
    }),
  }).catch((err) => {
    console.warn('[Valuation Form] CAPI call failed:', err)
  })

  // GA4 Measurement Protocol mirror — server-side generate_lead so
  // attribution survives ad-blockers. Mirrors the gold-standard seller LP.
  await fireLeadGenerated({
    lp_variant: 'home-valuation',
    lead_type: 'seller',
    lead_classification: 'warm',
    value: 500,
    event_id: eventId,
    extra: {
      cma_sent: cmaSent,
      property_city: city || undefined,
      property_state: state || undefined,
    },
  })

  return { success: true, cmaSent, eventId }
}
