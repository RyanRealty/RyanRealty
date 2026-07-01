'use server'

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

/**
 * updateCompanySettingsAction -- saves the CRM company settings form.
 *
 * Upserts the singleton row (id = 1) in crm_company_settings and revalidates
 * the 'crm-company-settings' cache tag so the page reflects new values on the
 * next request. Superuser-only -- same access gate as the settings page.
 *
 * Fields covered by this action (per spec §1.9 -- what the Save button commits):
 *   §1.3 Basic info: company_name, industry, franchise, address, city, state,
 *         zipcode, country, time_zone
 *   §1.4 Virtual phone: fallback_number, call_recording_enabled,
 *         legal_disclosure_auto_play
 *   §1.7 Business insights: production_goal
 *
 * NOT saved here (each has its own management flow per spec §1.9):
 *   office_hours, subdomain, spam_label_entity, weekly_report_recipients,
 *   block_list
 */
export async function updateCompanySettingsAction(formData: FormData): Promise<void> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') {
    throw new Error('Unauthorized: superuser role required')
  }

  // Strip non-numeric chars from production_goal to handle "$1,000,000" input
  const rawGoal = String(formData.get('production_goal') ?? '').replace(/[^0-9.]/g, '')
  const productionGoal = rawGoal ? parseFloat(rawGoal) : 1000000

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
      // §1.4 Virtual phone: fallback_number + call recording toggles
      fallback_number: String(formData.get('fallback_number') ?? '').trim(),
      call_recording_enabled: formData.get('call_recording_enabled') === 'true',
      legal_disclosure_auto_play: formData.get('legal_disclosure_auto_play') === 'true',
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
