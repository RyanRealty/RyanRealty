import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmCompanySettings — cached reader for the CRM company settings singleton.
 *
 * Reads from `crm_company_settings` (migration 20260701100000_crm_company_settings.sql).
 * Falls back to the canonical Ryan Realty defaults if the table is empty or
 * unreachable, so the settings page renders even before a first save.
 *
 * Uses the service client (bypasses RLS) because:
 * (a) unstable_cache doesn't carry per-user sessions and
 * (b) the calling route is already gated by getCrmAccess() / role='superuser'.
 *
 * Revalidated on every updateCompanySettingsAction call via the
 * 'crm-company-settings' cache tag.
 *
 * DAL boundary (G1): the raw .from() call lives here, inside lib/data/.
 */

export type OfficeHoursBlock = {
  days: string[]
  start_time: string
  end_time: string
}

export type CrmCompanySettings = {
  id: number
  // §1.3 Basic company info
  company_name: string
  industry: string
  franchise: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  zipcode: string
  country: string
  time_zone: string
  // §1.4 Virtual phone
  fallback_number: string
  spam_label_entity: string
  call_recording_enabled: boolean
  legal_disclosure_auto_play: boolean
  legal_disclosure_audio_url: string | null
  // §1.5 Office hours
  office_hours: OfficeHoursBlock[]
  // §1.6 Subdomain
  subdomain: string
  // §1.7 Business insights
  production_goal: number
  production_goal_year: number
  weekly_report_recipients: string[]
  // Timestamps
  updated_at: string | null
}

/** Canonical defaults — real Ryan Realty values from FUB API export + shot-40.md. */
export const DEFAULT_COMPANY_SETTINGS: CrmCompanySettings = {
  id: 1,
  company_name: 'Ryan Realty',
  industry: 'Real Estate',
  franchise: 'Other',
  address_line_1: '115 NW Oregon Ave.',
  address_line_2: '#2',
  city: 'Bend',
  state: 'Oregon',
  zipcode: '97703',
  country: 'United States',
  time_zone: 'America/Los_Angeles',
  fallback_number: '(541) 213-6706',
  spam_label_entity: 'Ryan Realty LLC',
  call_recording_enabled: true,
  legal_disclosure_auto_play: false,
  legal_disclosure_audio_url: null,
  office_hours: [],
  subdomain: 'ryan-realty',
  production_goal: 1000000,
  production_goal_year: new Date().getFullYear(),
  weekly_report_recipients: [],
  updated_at: null,
}

type RawRow = Record<string, unknown>

function mapRow(data: RawRow): CrmCompanySettings {
  return {
    id: Number(data.id ?? 1),
    company_name: String(data.company_name ?? ''),
    industry: String(data.industry ?? ''),
    franchise: String(data.franchise ?? ''),
    address_line_1: String(data.address_line_1 ?? ''),
    address_line_2: String(data.address_line_2 ?? ''),
    city: String(data.city ?? ''),
    state: String(data.state ?? ''),
    zipcode: String(data.zipcode ?? ''),
    country: String(data.country ?? ''),
    time_zone: String(data.time_zone ?? ''),
    fallback_number: String(data.fallback_number ?? ''),
    spam_label_entity: String(data.spam_label_entity ?? ''),
    call_recording_enabled: Boolean(data.call_recording_enabled),
    legal_disclosure_auto_play: Boolean(data.legal_disclosure_auto_play),
    legal_disclosure_audio_url: (data.legal_disclosure_audio_url as string | null) ?? null,
    office_hours: Array.isArray(data.office_hours)
      ? (data.office_hours as OfficeHoursBlock[])
      : [],
    subdomain: String(data.subdomain ?? ''),
    production_goal: Number(data.production_goal ?? 0),
    production_goal_year: Number(data.production_goal_year ?? new Date().getFullYear()),
    weekly_report_recipients: Array.isArray(data.weekly_report_recipients)
      ? (data.weekly_report_recipients as string[])
      : [],
    updated_at: (data.updated_at as string | null) ?? null,
  }
}

export const getCrmCompanySettings = unstable_cache(
  async (): Promise<CrmCompanySettings> => {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_company_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      console.error('[getCrmCompanySettings]', error.message)
      return DEFAULT_COMPANY_SETTINGS
    }
    if (!data) return DEFAULT_COMPANY_SETTINGS

    return mapRow(data as RawRow)
  },
  ['crm-company-settings-v1'],
  { revalidate: 300, tags: ['crm-company-settings'] },
)
