'use server'

import { sendEvent } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'

const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

export type ContactFormState = { error?: string; success?: boolean }

export async function submitContactForm(formData: FormData): Promise<ContactFormState> {
  const name = formData.get('name')?.toString()?.trim() ?? ''
  const email = formData.get('email')?.toString()?.trim() ?? ''
  const phone = formData.get('phone')?.toString()?.trim() ?? ''
  const inquiryType = formData.get('inquiryType')?.toString()?.trim() ?? 'General Inquiry'
  const message = formData.get('message')?.toString()?.trim() ?? ''

  if (!email) return { error: 'Email is required' }

  const res = await sendEvent({
    type: 'General Inquiry',
    person: {
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone && { phones: [{ value: phone }] }),
    },
    source,
    sourceUrl: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/contact` : undefined,
    message: `[${inquiryType}] ${message || '(no message)'}`,
  })

  if (!res.ok) return { error: res.error ?? 'Failed to send' }

  await sendContactNotification({ name, email, phone, inquiryType, message }).catch(() => {})

  return { success: true }
}
