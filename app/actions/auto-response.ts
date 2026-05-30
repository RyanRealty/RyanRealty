'use server'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Send an automated response email within minutes of a listing inquiry.
 *
 * Called after a listing inquiry is submitted. Uses Resend for delivery.
 * The email acknowledges the specific listing and introduces the assigned agent.
 *
 * Best practice: contact leads within 5 minutes for 10x higher conversion.
 */
export async function sendAutoResponse(input: {
  recipientEmail: string
  recipientName?: string
  listingAddress?: string
  listingPrice?: string
  listingUrl?: string
  agentName?: string
  agentEmail?: string
  agentPhone?: string
  inquiryType?: 'schedule_showing' | 'ask_question' | 'general'
}): Promise<{ error: string | null }> {
  try {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    if (!resendKey) {
      console.error('[autoResponse] RESEND_API_KEY not configured')
      return { error: null } // Silently skip — don't block the inquiry
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
    const siteName = process.env.NEXT_PUBLIC_SITE_OWNER_NAME ?? 'Ryan Realty'
    const fromEmail = process.env.RESEND_ADMIN_EMAIL ?? `noreply@${siteUrl.replace(/^https?:\/\//, '')}`

    const recipientName = input.recipientName || 'there'
    const agentName = input.agentName || 'our team'
    const inquiryLabel = input.inquiryType === 'schedule_showing'
      ? 'showing request'
      : input.inquiryType === 'ask_question'
        ? 'question'
        : 'inquiry'

    const subject = input.listingAddress
      ? `Re: Your ${inquiryLabel} about ${input.listingAddress}`
      : `Thanks for reaching out to ${siteName}`

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #102742; margin-bottom: 16px;">Thanks for your interest!</h2>
        <p>Hi ${recipientName},</p>
        <p>Thank you for your ${inquiryLabel}${input.listingAddress ? ` about <strong>${input.listingAddress}</strong>` : ''}. We received your message and ${agentName} will be in touch shortly.</p>
        ${input.listingPrice ? `<p style="font-size: 18px; font-weight: bold; color: #102742;">Listed at ${input.listingPrice}</p>` : ''}
        ${input.listingUrl ? `<p><a href="${input.listingUrl}" style="color: #102742; text-decoration: underline;">View the listing</a></p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        ${input.agentName ? `<p><strong>${input.agentName}</strong></p>` : ''}
        ${input.agentEmail ? `<p>Email: <a href="mailto:${input.agentEmail}">${input.agentEmail}</a></p>` : ''}
        ${input.agentPhone ? `<p>Phone: <a href="tel:${input.agentPhone}">${input.agentPhone}</a></p>` : ''}
        <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
          ${siteName} — Central Oregon Real Estate<br/>
          <a href="${siteUrl}" style="color: #102742;">${siteUrl.replace(/^https?:\/\//, '')}</a>
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${siteName} <${fromEmail}>`,
        to: [input.recipientEmail],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[autoResponse] Resend error:', res.status, text)
      return { error: null } // Don't surface email errors to the user
    }

    // Log the auto-response
    const supabase = createServiceClient()
    if (supabase) {
      await supabase.from('audit_log').insert({
        action: 'auto_response_sent',
        details: { to: input.recipientEmail, listing: input.listingAddress, type: input.inquiryType },
      }).then(() => {}) // Fire and forget
    }

    return { error: null }
  } catch (err) {
    console.error('[autoResponse]', err)
    return { error: null } // Don't block inquiry on auto-response failure
  }
}
