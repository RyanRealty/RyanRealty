#!/usr/bin/env npx tsx
/**
 * Flag clear broker / industry contacts and mark their import tcpa-hard-stop
 * suppressions cleared with reason "broker reclass".
 *
 * NOT run by CI or ship. Matt runs this after merge + after the cleared_*
 * migration is applied.
 *
 *   npx tsx scripts/crm-reclass-import-hard-stops.ts            # dry-run counts
 *   npx tsx scripts/crm-reclass-import-hard-stops.ts --apply    # write
 *
 * Leaves ambiguous rows untouched. Never clears STOP / bounce / complaint / GPC.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  classifyIndustryReclass,
  withIndustryContactTag,
} from '../lib/crm/industry-contact'
import { BROKER_RECLASS_CLEARED_REASON, isTrueOptOutSuppression } from '../lib/crm/suppression-lifecycle'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const APPLY = process.argv.includes('--apply')
const PAGE = 500

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return env
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

type PersonRow = {
  id: number
  tags: unknown
  stage: string | null
  source: string | null
}

type SuppRow = {
  id: number
  person_id: number | null
  reason: string | null
  source: string | null
  channel: string | null
}

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return rows
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const hardStops = await pageAll<SuppRow>((from, to) =>
    sb
      .from('crm_suppressions')
      .select('id,person_id,reason,source,channel')
      .eq('source', 'import')
      .eq('reason', 'tcpa-hard-stop')
      .is('cleared_at', null)
      .range(from, to),
  )

  const personIds = [...new Set(hardStops.map((r) => r.person_id).filter((n): n is number => typeof n === 'number'))]
  const people = new Map<number, PersonRow>()
  for (let i = 0; i < personIds.length; i += 200) {
    const chunk = personIds.slice(i, i + 200)
    const { data, error } = await sb.from('crm_people').select('id,tags,stage,source').in('id', chunk)
    if (error) throw new Error(error.message)
    for (const p of (data ?? []) as PersonRow[]) people.set(Number(p.id), p)
  }

  const flagPersonIds = new Set<number>()
  const ambiguousPersonIds = new Set<number>()
  const suppressionsToClear: SuppRow[] = []

  for (const row of hardStops) {
    if (isTrueOptOutSuppression(row)) continue
    const pid = row.person_id
    if (pid == null) {
      ambiguousPersonIds.add(-1)
      continue
    }
    const person = people.get(pid)
    const decision = classifyIndustryReclass({
      tags: person?.tags,
      stage: person?.stage ?? null,
      source: person?.source ?? null,
    })
    if (decision === 'flag') {
      flagPersonIds.add(pid)
      suppressionsToClear.push(row)
    } else {
      ambiguousPersonIds.add(pid)
    }
  }

  const alreadyFlagged = [...flagPersonIds].filter((id) => {
    const tags = people.get(id)?.tags
    return Array.isArray(tags) && tags.some((t) => typeof t === 'string' && t.trim().toLowerCase() === 'industry:contact')
  }).length

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    import_hard_stops_active: hardStops.length,
    people_with_those_rows: personIds.length,
    flag_and_clear_people: flagPersonIds.size,
    suppressions_to_clear: suppressionsToClear.length,
    already_had_industry_contact_tag: alreadyFlagged,
    ambiguous_people_untouched: ambiguousPersonIds.size,
    cleared_reason: BROKER_RECLASS_CLEARED_REASON,
  }
  console.log(JSON.stringify(summary, null, 2))

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply after reviewing the counts.')
    return
  }

  const now = new Date().toISOString()
  let tagsUpdated = 0
  for (const id of flagPersonIds) {
    const person = people.get(id)
    const next = withIndustryContactTag(person?.tags)
    const { error } = await sb.from('crm_people').update({ tags: next, updated_at: now }).eq('id', id)
    if (error) throw new Error(`tag update ${id}: ${error.message}`)
    tagsUpdated += 1
  }

  const suppIds = suppressionsToClear.map((r) => r.id)
  let cleared = 0
  for (let i = 0; i < suppIds.length; i += 200) {
    const chunk = suppIds.slice(i, i + 200)
    const { error, count } = await sb
      .from('crm_suppressions')
      .update({
        cleared_at: now,
        cleared_by: 'script:broker-reclass',
        cleared_reason: BROKER_RECLASS_CLEARED_REASON,
      })
      .in('id', chunk)
      .is('cleared_at', null)
    if (error) throw new Error(`clear chunk: ${error.message}`)
    cleared += count ?? chunk.length
  }

  console.log(JSON.stringify({ applied: true, tags_updated: tagsUpdated, suppressions_cleared: cleared }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
