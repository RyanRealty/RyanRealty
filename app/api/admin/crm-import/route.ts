/**
 * POST /api/admin/crm-import
 *
 * Chunked upsert engine for the CSV import wizard (§8.8).
 *
 * Schema notes for crm_people:
 *   - No top-level `email` column — emails live in crm_contact_points (kind='email')
 *     AND are mirrored into crm_people.emails (jsonb array of {value, type}).
 *   - Similarly for phones: crm_contact_points (kind='phone') + crm_people.phones jsonb.
 *   - Dedup: match existing contacts by email via crm_contact_points.
 *   - Tags: crm_people.tags (text[]).
 *
 * Auth: superuser session required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuserOr403 } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { parseCsv, mapRowToContact } from '@/lib/crm/import'
import type { FieldMapping } from '@/lib/crm/import'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_SIZE = 100
const MAX_ERROR_ROWS = 500

export async function POST(req: NextRequest) {
  const ctx = await requireSuperuserOr403()
  if (ctx instanceof Response) return ctx

  let body: { jobId?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const jobId = Number(body.jobId ?? 0)
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const sb = createServiceClient()

  // Load the job
  const { data: job, error: jobErr } = await sb
    .from('crm_imports')
    .select('id,status,field_mapping,row_count,cursor')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Import job not found' }, { status: 404 })
  }
  if (job.status !== 'running') {
    return NextResponse.json({ error: `Job is in status '${job.status}', expected 'running'` }, { status: 409 })
  }

  const mapping = (job.field_mapping ?? {}) as FieldMapping
  const rawText = (job.cursor as { csv_text?: string })?.csv_text ?? ''
  const { rows } = parseCsv(rawText)

  let imported = 0
  let skipped = 0
  const errorRows: Array<{ rowIndex: number; row: Record<string, string>; error: string }> = []

  // Process in chunks
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE)
    const contacts = chunk.map((r) => mapRowToContact(r, mapping))

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i]
      const rowIndex = offset + i + 1

      // Skip rows with no name and no email
      if (!c.name && !c.email) {
        skipped++
        continue
      }

      try {
        const emailLower = c.email ? c.email.toLowerCase().trim() : null

        // Try to find existing person by email via crm_contact_points
        let existingPersonId: number | null = null
        if (emailLower) {
          const { data: cp } = await sb
            .from('crm_contact_points')
            .select('person_id')
            .eq('kind', 'email')
            .eq('value', emailLower)
            .maybeSingle()
          existingPersonId = cp?.person_id ?? null
        }

        if (existingPersonId) {
          // Update existing person — merge, never overwrite with blanks
          const { data: existing } = await sb
            .from('crm_people')
            .select('tags,emails,phones')
            .eq('id', existingPersonId)
            .single()

          const mergedTags = Array.from(
            new Set([...((existing?.tags as string[]) ?? []), ...c.tags]),
          )
          const update: Record<string, unknown> = {}
          if (c.name) update.name = c.name
          if (c.first_name) update.first_name = c.first_name
          if (c.last_name) update.last_name = c.last_name
          if (c.stage) update.stage = c.stage
          if (c.source) update.source = c.source
          if (mergedTags.length > 0) update.tags = mergedTags

          const { error: upErr } = await sb
            .from('crm_people')
            .update(update)
            .eq('id', existingPersonId)
          if (upErr) throw new Error(upErr.message)

          // Add phone contact point if missing
          if (c.phone) {
            const phoneNorm = c.phone.replace(/\D/g, '')
            const { data: existingPhone } = await sb
              .from('crm_contact_points')
              .select('id')
              .eq('person_id', existingPersonId)
              .eq('kind', 'phone')
              .eq('value', phoneNorm)
              .maybeSingle()
            if (!existingPhone) {
              await sb.from('crm_contact_points').insert({
                person_id: existingPersonId,
                kind: 'phone',
                value: phoneNorm,
                label: 'mobile',
                is_primary: false,
              })
            }
          }
        } else {
          // Insert new person
          const emailsJsonb = emailLower ? [{ value: emailLower, type: 'personal' }] : []
          const phonesJsonb = c.phone
            ? [{ value: c.phone.replace(/\D/g, ''), type: 'mobile' }]
            : []

          const payload: Record<string, unknown> = {
            name: c.name || null,
            first_name: c.first_name || null,
            last_name: c.last_name || null,
            emails: emailsJsonb,
            phones: phonesJsonb,
            tags: c.tags,
          }
          if (c.stage) payload.stage = c.stage
          if (c.source) payload.source = c.source

          const { data: newPerson, error: insErr } = await sb
            .from('crm_people')
            .insert(payload)
            .select('id')
            .single()
          if (insErr || !newPerson) throw new Error(insErr?.message ?? 'Insert failed')

          // Write contact points
          const cps: Array<{ person_id: number; kind: string; value: string; label: string; is_primary: boolean }> = []
          if (emailLower) {
            cps.push({ person_id: newPerson.id, kind: 'email', value: emailLower, label: 'personal', is_primary: true })
          }
          if (c.phone) {
            cps.push({ person_id: newPerson.id, kind: 'phone', value: c.phone.replace(/\D/g, ''), label: 'mobile', is_primary: !emailLower })
          }
          if (cps.length > 0) {
            const { error: cpErr } = await sb.from('crm_contact_points').insert(cps)
            if (cpErr) throw new Error(`contact_points: ${cpErr.message}`)
          }
        }

        imported++
      } catch (e) {
        if (errorRows.length < MAX_ERROR_ROWS) {
          errorRows.push({
            rowIndex,
            row: chunk[i] as Record<string, string>,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }

    // Write progress after each chunk
    await sb.from('crm_imports').update({
      counts: { total: rows.length, imported, skipped, errors: errorRows.length },
      error_rows: errorRows,
    }).eq('id', jobId)
  }

  // Mark done
  await sb.from('crm_imports').update({
    status: errorRows.length > 0 && imported === 0 ? 'error' : 'done',
    finished_at: new Date().toISOString(),
    counts: { total: rows.length, imported, skipped, errors: errorRows.length },
    error_rows: errorRows,
    // Clear the stored CSV text to save space
    cursor: {},
  }).eq('id', jobId)

  return NextResponse.json({ ok: true, imported, skipped, errors: errorRows.length })
}
