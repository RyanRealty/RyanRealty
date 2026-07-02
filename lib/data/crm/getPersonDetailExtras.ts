import 'server-only'

/**
 * getPersonDetailExtras — §07 person-detail-desktop right-rail + timeline data
 * (spec docs/fub-crm-spec/07b §9, 07c §7c.8). One call fans out to:
 *
 *   - appointments  crm_appointments for the person (upcoming first)
 *   - deals         crm_deals rows linked to the person
 *   - files         crm_person_files (private-bucket files get 1h signed URLs)
 *   - kindCounts    exact per-kind crm_timeline counts for the §07b filter tabs
 *                   (count:'exact' head queries — never rows.length, per the
 *                   1000-row-cap lesson in CRM_BUILD_MISSION)
 *   - starredCount  exact count of starred timeline rows (Starred Items tab)
 *
 * Tables: crm_appointments, crm_deals, crm_person_files, crm_timeline.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type PersonAppointment = {
  id: number
  title: string
  startAt: string
  endAt: string | null
  location: string | null
  typeName: string | null
  outcomeName: string | null
  brokerSlug: string
}

export type PersonDeal = {
  id: number
  name: string | null
  pipeline: string | null
  stage: string | null
  value: number | null
  closeDate: string | null
  propertyAddress: string | null
}

export type PersonFile = {
  id: number
  name: string
  kind: 'file' | 'link'
  url: string | null
  sizeBytes: number | null
  uploadedBy: string | null
  createdAt: string
}

export type PersonDetailExtras = {
  appointments: PersonAppointment[]
  deals: PersonDeal[]
  files: PersonFile[]
  kindCounts: Record<string, number>
  starredCount: number
  /** §7c.8.2 Activity summary widget — exact direction counts. */
  activitySummary: Array<{ label: string; value: number }>
  /** All tag labels for the §07a 5.6 add-tag autocomplete. */
  tagOptions: string[]
  /** Ponds for the §07a 5.2 Assigned-to dropdown PONDS group. */
  pondOptions: Array<{ id: number; name: string }>
}

/** Timeline kinds that feed each §07b filter tab. */
export const TIMELINE_TAB_KINDS: Record<string, string[]> = {
  emails: ['email_in', 'email_out'],
  texts: ['text_in', 'text_out', 'sms_in', 'sms_out'],
  calls: ['call', 'voicemail'],
  notes: ['note'],
  activity: ['web_event', 'stage_change', 'system', 'lead_created', 'task'],
}

export async function getPersonDetailExtras(personId: number): Promise<PersonDetailExtras> {
  const sb = createServiceClient()

  const countFor = async (kinds: string[]) => {
    const { count } = await sb
      .from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .in('kind', kinds)
    return count ?? 0
  }

  const [apptsRes, dealsRes, filesRes, starredRes, marketingRes, tagsRes, pondsRes, emailsSent, emailsReceived, textsSent, callsMade, ...tabCounts] = await Promise.all([
    sb
      .from('crm_appointments')
      .select('id, title, start_at, end_at, location, broker_slug, crm_appointment_types(name), crm_appointment_outcomes(name)')
      .eq('person_id', personId)
      .order('start_at', { ascending: false })
      .limit(20),
    sb
      .from('crm_deals')
      .select('id, name, pipeline, stage, value, close_date, property_address')
      .eq('person_id', personId)
      .order('updated_at', { ascending: false })
      .limit(20),
    sb
      .from('crm_person_files')
      .select('id, name, kind, url, storage_path, size_bytes, uploaded_by, created_at')
      .eq('person_id', personId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .eq('starred', true),
    // Marketing Emails tab (§07b tab 7): automation/sequence-sent emails.
    sb
      .from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .eq('kind', 'email_out')
      .eq('source', 'sequence'),
    sb.from('crm_tags').select('label').eq('is_active', true).order('label').limit(500),
    sb.from('crm_ponds').select('id, name').order('name'),
    countFor(['email_out']),
    countFor(['email_in']),
    countFor(['text_out', 'sms_out']),
    countFor(['call']),
    ...Object.values(TIMELINE_TAB_KINDS).map((kinds) => countFor(kinds)),
  ])

  const tabKeys = Object.keys(TIMELINE_TAB_KINDS)
  const kindCounts: Record<string, number> = {}
  tabKeys.forEach((key, i) => {
    kindCounts[key] = Number(tabCounts[i] ?? 0)
  })
  kindCounts.marketing = (marketingRes as { count?: number | null }).count ?? 0

  const files: PersonFile[] = []
  for (const f of filesRes.data ?? []) {
    let url = (f.url as string | null) ?? null
    const path = (f as { storage_path?: string | null }).storage_path ?? null
    if (!url && path) {
      const { data: signed } = await sb.storage.from('crm-files').createSignedUrl(path, 3600)
      url = signed?.signedUrl ?? null
    }
    files.push({
      id: Number(f.id),
      name: String(f.name),
      kind: f.kind === 'link' ? 'link' : 'file',
      url,
      sizeBytes: (f as { size_bytes?: number | null }).size_bytes ?? null,
      uploadedBy: (f as { uploaded_by?: string | null }).uploaded_by ?? null,
      createdAt: String(f.created_at),
    })
  }

  return {
    appointments: (apptsRes.data ?? []).map((a) => ({
      id: Number(a.id),
      title: String(a.title),
      startAt: String(a.start_at),
      endAt: a.end_at ? String(a.end_at) : null,
      location: (a.location as string | null) ?? null,
      typeName: ((a as { crm_appointment_types?: { name?: string } | null }).crm_appointment_types?.name as string | undefined) ?? null,
      outcomeName:
        ((a as { crm_appointment_outcomes?: { name?: string } | null }).crm_appointment_outcomes?.name as string | undefined) ?? null,
      brokerSlug: String(a.broker_slug),
    })),
    deals: (dealsRes.data ?? []).map((d) => ({
      id: Number(d.id),
      name: (d.name as string | null) ?? null,
      pipeline: (d.pipeline as string | null) ?? null,
      stage: (d.stage as string | null) ?? null,
      value: d.value === null || d.value === undefined ? null : Number(d.value),
      closeDate: (d.close_date as string | null) ?? null,
      propertyAddress: (d.property_address as string | null) ?? null,
    })),
    files,
    kindCounts,
    starredCount: starredRes.count ?? 0,
    activitySummary: [
      { label: 'Emails sent', value: Number(emailsSent) },
      { label: 'Emails received', value: Number(emailsReceived) },
      { label: 'Texts sent', value: Number(textsSent) },
      { label: 'Calls made', value: Number(callsMade) },
    ],
    tagOptions: ((tagsRes as { data?: Array<{ label: string }> | null }).data ?? []).map((t) => String(t.label)),
    pondOptions: ((pondsRes as { data?: Array<{ id: number; name: string }> | null }).data ?? []).map((p) => ({
      id: Number(p.id),
      name: String(p.name),
    })),
  }
}
