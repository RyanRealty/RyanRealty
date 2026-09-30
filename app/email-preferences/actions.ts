'use server'

/**
 * The one server action behind every button on /email-preferences.
 *
 * Every form posts the signed link (`t`) and one operation (`op`); the signed
 * link is the authorization, and lib/crm/market-report-preferences.ts decides
 * everything else (it re-verifies the link, loads her record, validates areas
 * against the live registry, writes the timeline). This file only reads the
 * form and sends her back to the page with a result CODE, never a sentence,
 * so a crafted URL cannot put words on our domain.
 *
 * "Stop all Ryan Realty email" takes two posts on purpose: the first
 * (`op=confirm-all-email`) changes nothing and opens the confirmation, the
 * second carries `confirm=yes`.
 */
import { redirect } from 'next/navigation'
import { applyReportPreference, type PreferenceAction } from '@/lib/crm/market-report-preferences'
import { REPORT_PREFERENCES_PATH } from '@/lib/email/report-link-token'
import type { ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

const FREQUENCIES: ReadonlySet<string> = new Set(['weekly', 'monthly', 'quarterly'])

function field(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

function pageUrl(token: string, params: Record<string, string>, hash?: string): string {
  const q = new URLSearchParams({ t: token, ...params })
  return `${REPORT_PREFERENCES_PATH}?${q.toString()}${hash ? `#${hash}` : ''}`
}

/** The operation a form posted, as an action, or null when the post is malformed. */
function readAction(formData: FormData): PreferenceAction | null {
  const op = field(formData, 'op')
  switch (op) {
    case 'pause':
    case 'resume':
    case 'stop':
      return { kind: op }
    case 'frequency': {
      const frequency = field(formData, 'frequency')
      return FREQUENCIES.has(frequency) ? { kind: 'frequency', frequency: frequency as ReportFrequency } : null
    }
    case 'add-area':
    case 'remove-area': {
      const slug = field(formData, 'area')
      return slug && slug.length <= 120 ? { kind: op, slug } : null
    }
    case 'stop-all-email':
      // The confirmation's own button carries confirm=yes. Anything else is
      // not a confirmed choice and changes nothing.
      return field(formData, 'confirm') === 'yes' ? { kind: 'stop-all-email' } : null
    case 'restart-all-email':
      return { kind: 'restart-all-email' }
    default:
      return null
  }
}

export async function updateReportPreference(formData: FormData): Promise<void> {
  const token = field(formData, 't')
  if (!token || token.length > 2048) redirect(`${REPORT_PREFERENCES_PATH}?error=link`)

  if (field(formData, 'op') === 'confirm-all-email') {
    redirect(pageUrl(token, { confirm: 'all-email' }, 'all-email'))
  }

  const action = readAction(formData)
  if (!action) redirect(pageUrl(token, { error: 'input' }, 'report'))

  const result = await applyReportPreference(token, action, 'email-link')
  if (!result.ok) {
    if (result.error === 'link' || result.error === 'unavailable') {
      redirect(`${REPORT_PREFERENCES_PATH}?error=${result.error}`)
    }
    redirect(pageUrl(token, { error: result.error }, 'report'))
  }
  redirect(pageUrl(token, { done: result.done }, 'report'))
}
