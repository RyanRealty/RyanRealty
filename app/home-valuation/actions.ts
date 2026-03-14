'use server'

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { sendEvent } from '@/lib/followupboss'
import { sendEmail } from '@/lib/resend'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import { createServiceClient } from '@/lib/supabase/service'
import { CMAPdfDocument } from '@/lib/pdf/cma-pdf'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.RESEND_ADMIN_EMAIL ?? ''

export type ValuationFormState = { error?: string; success?: boolean; cmaSent?: boolean }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Server not configured')
  return createClient(url, key)
}

/** Try to find a property in DB by address components (for auto-CMA). */
async function findPropertyByAddress(params: {
  street?: string | null
  city: string
  state?: string | null
  postalCode?: string | null
}): Promise<string | null> {
  const supabase = getServiceSupabase()
  const city = params.city?.trim()
  if (!city) return null

  let query = supabase
    .from('properties')
    .select('id, unparsed_address, city, state, postal_code')
    .ilike('city', city)

  if (params.state?.trim()) query = query.ilike('state', params.state.trim())
  if (params.postalCode?.trim()) query = query.eq('postal_code', params.postalCode.trim().slice(0, 20))

  const { data: rows } = await query.limit(20)
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

  const supabase = getServiceSupabase()
  const { error: insertError } = await supabase.from('valuation_requests').insert({
    address_street: street || null,
    address_city: city,
    address_state: state || null,
    address_postal_code: postalCode || null,
    name: name || null,
    email,
    phone: phone || null,
    source_url: `${siteUrl}/home-valuation`,
  })
  if (insertError) return { error: insertError.message }

  const fullAddress = [street, city, state, postalCode].filter(Boolean).join(', ')
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
  })
  if (!fubRes.ok) {
    // Lead is saved; log but don't fail
    console.warn('[valuation] FUB send failed:', fubRes.error)
  }

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
        const sb = createServiceClient()
        const { data: prop } = await sb.from('properties').select('unparsed_address').eq('id', propertyId).single()
        const { data: listing } = await sb
          .from('listings')
          .select('beds_total, baths_full, living_area, lot_size_acres, year_built, listing_key')
          .eq('property_id', propertyId)
          .order('modification_timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()
        const { data: photo } = await sb
          .from('listing_photos')
          .select('photo_url')
          .eq('listing_key', (listing as { listing_key?: string } | null)?.listing_key ?? '')
          .eq('is_hero', true)
          .limit(1)
          .maybeSingle()
        const { data: agent } = await sb
          .from('listing_agents')
          .select('agent_name, agent_email, agent_phone')
          .eq('listing_key', (listing as { listing_key?: string } | null)?.listing_key ?? '')
          .in('agent_role', ['list', 'listing'])
          .limit(1)
          .maybeSingle()
        const listingRow = listing as { beds_total?: number; baths_full?: number; living_area?: number; lot_size_acres?: number; year_built?: number } | null
        const pdfData = {
          cma,
          address: (prop as { unparsed_address?: string } | null)?.unparsed_address ?? fullAddress,
          beds: listingRow?.beds_total ?? null,
          baths: listingRow?.baths_full ?? null,
          sqft: listingRow?.living_area ?? null,
          lotAcres: listingRow?.lot_size_acres ?? null,
          yearBuilt: listingRow?.year_built ?? null,
          heroPhotoUrl: (photo as { photo_url?: string } | null)?.photo_url ?? null,
          agentName: (agent as { agent_name?: string } | null)?.agent_name ?? null,
          agentEmail: (agent as { agent_email?: string } | null)?.agent_email ?? null,
          agentPhone: (agent as { agent_phone?: string } | null)?.agent_phone ?? null,
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

  return { success: true, cmaSent }
}
