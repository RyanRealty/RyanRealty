'use server'

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { OFFICE_DAYS, parseHm } from '@/lib/crm/office-hours'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'

/**
 * Company Settings actions (spec §15 / §1) — all superuser (owner) gated.
 *
 * updateCompanySettingsAction saves the fields the §1.9 Save button covers.
 * The sections with their own flows each get a dedicated action below:
 * spam label (§1.4 modal), office hours (§1.5 editor), subdomain (§1.6 modal),
 * weekly report recipients (§1.7 chips). Block list has its own page + actions
 * (app/actions/crm-block.ts). Every write revalidates 'crm-company-settings'.
 */

async function requireOwner(): Promise<void> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') {
    throw new Error('Unauthorized: superuser role required')
  }
}

/** AC-2: accept a US phone in any common format, normalize to (NNN) NNN-NNNN. */
function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return null
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export async function updateCompanySettingsAction(formData: FormData): Promise<void> {
  await requireOwner()

  // Strip non-numeric chars from production_goal to handle "$1,000,000" input
  const rawGoal = String(formData.get('production_goal') ?? '').replace(/[^0-9.]/g, '')
  const productionGoal = rawGoal ? parseFloat(rawGoal) : 1000000

  // AC-2: fallback number must be a real US phone; reject non-phone strings.
  const rawFallback = String(formData.get('fallback_number') ?? '').trim()
  const fallback = rawFallback ? normalizeUsPhone(rawFallback) : ''
  if (fallback === null) {
    throw new Error('Fallback number must be a valid US phone number, e.g. (541) 213-6706')
  }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_company_settings').upsert(
    {
      id: 1,
      // §1.3 Basic company info
      company_name: String(formData.get('company_name') ?? '').trim() || 'Ryan Realty',
      industry: String(formData.get('industry') ?? '').trim() || 'Real Estate',
      franchise: String(formData.get('franchise') ?? '').trim() || 'Other',
      address_line_1: String(formData.get('address_line_1') ?? '').trim(),
      address_line_2: String(formData.get('address_line_2') ?? '').trim(),
      city: String(formData.get('city') ?? '').trim(),
      state: String(formData.get('state') ?? '').trim(),
      zipcode: String(formData.get('zipcode') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim() || 'United States',
      time_zone: String(formData.get('time_zone') ?? '').trim() || 'America/Los_Angeles',
      // §1.4 Virtual phone: fallback_number + the recording master switch. The
      // master switch is enforced live in the Twilio voice routes.
      fallback_number: fallback,
      call_recording_enabled: formData.get('call_recording_enabled') === 'true',
      // The recorded-call disclosure is LOCKED ON whenever recording is on:
      // out-of-state callers can be in two-party-consent states and the
      // ci:call-recording-consent gate requires the notice wherever a record
      // directive exists. The form renders this as a disabled always-on switch.
      legal_disclosure_auto_play: true,
      // §1.7 Business insights: production goal only; year is always current
      production_goal: isNaN(productionGoal) ? 1000000 : productionGoal,
      production_goal_year: new Date().getFullYear(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw new Error(`Failed to save company settings: ${error.message}`)
  }

  revalidateTag('crm-company-settings', 'max')
}

/** Shared column-update helper for the single-purpose flows below. */
async function updateSettingsColumns(patch: Record<string, unknown>): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_company_settings')
    .upsert({ id: 1, ...patch }, { onConflict: 'id' })
  if (error) throw new Error(`Failed to save company settings: ${error.message}`)
  revalidateTag('crm-company-settings', 'max')
}

/** §1.4 spam label (Change) modal — legal entity name, carrier-truncated to 15 chars (AC-6). */
export async function updateSpamLabelAction(label: string): Promise<void> {
  await requireOwner()
  const clean = String(label ?? '').trim().slice(0, 15)
  if (!clean) throw new Error('The legal entity name is required.')
  await updateSettingsColumns({ spam_label_entity: clean })
}

/** §1.5 office hours editor — replaces the full block list (AC-7). */
export async function updateOfficeHoursAction(blocks: OfficeHoursBlock[]): Promise<void> {
  await requireOwner()
  if (!Array.isArray(blocks) || blocks.length > 20) throw new Error('Invalid office hours payload.')
  const valid: OfficeHoursBlock[] = blocks.map((b) => {
    const days = Array.isArray(b?.days)
      ? b.days.filter((d): d is (typeof OFFICE_DAYS)[number] => (OFFICE_DAYS as readonly string[]).includes(d))
      : []
    const start = parseHm(b?.start_time)
    const end = parseHm(b?.end_time)
    if (days.length === 0) throw new Error('Each office-hours block needs at least one day.')
    if (start == null || end == null) throw new Error('Times must be in HH:MM 24-hour format.')
    if (start === end) throw new Error('Start and end time cannot be identical.')
    return { days, start_time: b.start_time.trim(), end_time: b.end_time.trim() }
  })
  await updateSettingsColumns({ office_hours: valid })
}

/** §1.6 subdomain (Change) modal — the stored account identifier (AC-8). */
export async function updateSubdomainAction(prefix: string): Promise<void> {
  await requireOwner()
  const clean = String(prefix ?? '').trim().toLowerCase()
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(clean)) {
    throw new Error('Subdomain must be lowercase letters, numbers, and hyphens.')
  }
  await updateSettingsColumns({ subdomain: clean })
}

/** §1.7 weekly report recipients chips — full-list set, auto-saved per add/remove (AC-10). */
export async function setWeeklyReportRecipientsAction(emails: string[]): Promise<void> {
  await requireOwner()
  if (!Array.isArray(emails) || emails.length > 25) throw new Error('Invalid recipients payload.')
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of emails) {
    const e = String(raw ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error(`Not a valid email address: ${raw}`)
    if (!seen.has(e)) {
      seen.add(e)
      clean.push(e)
    }
  }
  await updateSettingsColumns({ weekly_report_recipients: clean })
}
