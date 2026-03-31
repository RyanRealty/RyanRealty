'use server'

import { createClient } from '@supabase/supabase-js'
import { sendEvent } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export type ContactFormState = { error?: string; success?: boolean }

export async function submitContactForm(formData: FormData): Promise<ContactFormState> {
  const name = formData.get('name')?.toString()?.trim() ?? ''
  const email = formData.get('email')?.toString()?.trim() ?? ''
  const phone = formData.get('phone')?.toString()?.trim() ?? ''
  const inquiryType = formData.get('inquiryType')?.toString()?.trim() ?? 'General Inquiry'
  const message = formData.get('message')?.toString()?.trim() ?? ''
  const listingKey = formData.get('listingKey')?.toString()?.trim() ?? null

  if (!email) return { error: 'Email is required' }

  // Always store in DB first so no lead is lost even if FUB is down
  if (listingKey) {
    try {
      const supabase = getServiceSupabase()
      if (supabase) {
        const dbType = listingKey && (inquiryType === 'Buying' || message?.toLowerCase().includes('showing'))
          ? 'showing'
          : 'question'
        await supabase.from('listing_inquiries').insert({
          listing_key: listingKey,
          type: dbType,
          name: name || null,
          email,
          phone: phone || null,
          message: `[${inquiryType}] ${message || '(no message)'}`,
        })
      }
    } catch (err) {
      console.error('[submitContactForm] DB insert error:', err)
      // Don't fail the form — still try FUB
    }
  }

  // Send to Follow Up Boss (CRM)
  const fubMessage = listingKey
    ? `[${inquiryType}] Re: listing ${listingKey} — ${message || '(no message)'}`
    : `[${inquiryType}] ${message || '(no message)'}`

  const res = await sendEvent({
    type: listingKey ? 'Property Inquiry' : 'General Inquiry',
    person: {
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone && { phones: [{ value: phone }] }),
    },
    source,
    sourceUrl: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/contact` : undefined,
    message: fubMessage,
  })

  // Even if FUB fails, the lead is stored in DB — don't show error to user
  if (!res.ok) {
    console.error('[submitContactForm] FUB error:', res.error)
  }

  await sendContactNotification({ name, email, phone, inquiryType, message }).catch(() => {})

  return { success: true }
}
