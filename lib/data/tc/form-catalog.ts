import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import {
  catalogBlanksToPull,
  diffLibraryCatalog,
  parseCatalogPayload,
  parseFormNumber,
  parseVersionLabel,
  type FormDisposition,
  type HeldForm,
  type LibrarySnapshot,
} from '@/lib/tc/form-catalog-diff'
import { formBlankStorageBucket } from '@/lib/tc/form-blank'
import { ingestLicensedBlankPdf } from '@/lib/data/tc/ingest-licensed-blank'

type Row = Record<string, unknown>

export type FormFreshness = FormDisposition | 'unchecked'

export type TcFormBoardRow = {
  id: string
  libraryCode: string
  form_number: string | null
  name: string
  effective_date: string | null
  page_count: number | null
  field_map_source: string
  fieldCount: number
  signatureFieldCount: number
  signer_profile: string | null
  isSample: boolean
  blankUrl: string | null
  freshness: FormFreshness
  version_label: string | null
  pending_version_label: string | null
  held: boolean
}

export type TcFormLibraryBoard = {
  id: string
  code: string
  name: string
  license_note: string | null
  source_library_id: string | null
  last_catalog_at: string | null
  last_catalog_published_count: number | null
  forms: TcFormBoardRow[]
  counts: { current: number; updated: number; new: number; retired: number; unchecked: number }
}

export type CatalogApplyLibraryResult = {
  libraryCode: string
  published: number
  current: number
  updated: number
  new: number
  retired: number
  pulled: number
  pullFailed: number
}

export type CatalogApplyResult = {
  libraries: CatalogApplyLibraryResult[]
  checkedAt: string
}

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

function client() {
  return createServiceClient()
}

async function signedUrlsForBlankPaths(
  paths: string[],
  ttlSeconds: number,
): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>()
  if (!paths.length) return urlByPath
  const sb = client()
  const byBucket = new Map<'tc-forms' | 'tc-documents', string[]>()
  for (const path of paths) {
    const bucket = formBlankStorageBucket(path)
    const list = byBucket.get(bucket) ?? []
    list.push(path)
    byBucket.set(bucket, list)
  }
  for (const [bucket, list] of byBucket) {
    for (let i = 0; i < list.length; i += 80) {
      const chunk = list.slice(i, i + 80)
      const { data: signed } = await sb.storage.from(bucket).createSignedUrls(chunk, ttlSeconds)
      for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
    }
  }
  const missed = paths.filter((p) => !urlByPath.has(p))
  if (missed.length) {
    const other: Array<'tc-forms' | 'tc-documents'> = ['tc-forms', 'tc-documents']
    for (const bucket of other) {
      const still = missed.filter((p) => !urlByPath.has(p))
      if (!still.length) break
      for (let i = 0; i < still.length; i += 80) {
        const chunk = still.slice(i, i + 80)
        const { data: signed } = await sb.storage.from(bucket).createSignedUrls(chunk, ttlSeconds)
        for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
      }
    }
  }
  return urlByPath
}

function fieldStats(fieldMap: unknown): { fieldCount: number; signatureFieldCount: number } {
  const fields = Array.isArray(fieldMap) ? fieldMap : []
  return {
    fieldCount: fields.length,
    signatureFieldCount: fields.filter((f) => {
      const t = f && typeof f === 'object' ? String((f as { type?: string }).type ?? '') : ''
      return t === 'signature' || t === 'initials' || t === 'date_signed'
    }).length,
  }
}

export async function getTcFormLibraryBoard(search?: string): Promise<TcFormLibraryBoard[]> {
  const sb = client()
  const [{ data: libs, error: libErr }, { data: versions, error: verErr }, { data: catalog, error: catErr }] =
    await Promise.all([
      sb.from('tc_form_libraries').select('*').order('code'),
      sb
        .from('tc_form_versions')
        .select(
          'id, library_id, form_number, name, effective_date, page_count, field_map, field_map_source, signer_profile, blank_pdf_storage_path, source_form_id, source_version_id, version_label, update_available, pending_version_label, retired_at',
        )
        .is('retired_at', null)
        .order('form_number', { ascending: true }),
      sb
        .from('tc_form_catalog_items')
        .select(
          'id, library_id, source_form_id, source_version_id, name, form_number, page_count, version_label, disposition, held_form_version_id',
        ),
    ])

  if (libErr) {
    console.error('[getTcFormLibraryBoard] libraries', libErr)
    return []
  }
  if (verErr) {
    console.error('[getTcFormLibraryBoard] versions', verErr)
    return []
  }
  if (catErr) {
    console.error('[getTcFormLibraryBoard] catalog', catErr)
  }

  const term = (search ?? '').trim().toLowerCase()
  const matches = (number: string | null, name: string) =>
    !term || `${number ?? ''} ${name}`.toLowerCase().includes(term)

  const liveVersions = ((versions ?? []) as Row[]).filter((v) => !v.retired_at)
  const paths = liveVersions.map((v) => v.blank_pdf_storage_path).filter(Boolean) as string[]
  const urlByPath = await signedUrlsForBlankPaths(paths, 600)

  const catalogByLibrary = new Map<string, Row[]>()
  for (const item of (catalog ?? []) as Row[]) {
    const libId = asString(item.library_id)
    const list = catalogByLibrary.get(libId) ?? []
    list.push(item)
    catalogByLibrary.set(libId, list)
  }

  return ((libs ?? []) as Row[]).map((l) => {
    const libId = asString(l.id)
    const code = asString(l.code)
    const held = liveVersions.filter((v) => asString(v.library_id) === libId)
    const items = catalogByLibrary.get(libId) ?? []
    const heldIdsInCatalog = new Set(
      items.map((i) => asString(i.held_form_version_id)).filter(Boolean),
    )
    const rows: TcFormBoardRow[] = []

    for (const v of held) {
      const name = asString(v.name)
      const formNumber = v.form_number == null ? null : asString(v.form_number)
      if (!matches(formNumber, name)) continue
      const catalogHit = items.find((i) => asString(i.held_form_version_id) === asString(v.id))
      const freshness: FormFreshness = catalogHit
        ? (asString(catalogHit.disposition) as FormDisposition)
        : v.update_available
          ? 'updated'
          : 'unchecked'
      const stats = fieldStats(v.field_map)
      rows.push({
        id: asString(v.id),
        libraryCode: code,
        form_number: formNumber,
        name,
        effective_date: v.effective_date == null ? null : asString(v.effective_date),
        page_count: typeof v.page_count === 'number' ? v.page_count : null,
        field_map_source: asString(v.field_map_source) || 'manual',
        fieldCount: stats.fieldCount,
        signatureFieldCount: stats.signatureFieldCount,
        signer_profile: v.signer_profile == null ? null : asString(v.signer_profile),
        isSample: /\(SAMPLE/i.test(name),
        blankUrl: v.blank_pdf_storage_path
          ? (urlByPath.get(asString(v.blank_pdf_storage_path)) ?? null)
          : null,
        freshness,
        version_label:
          (v.version_label == null ? null : asString(v.version_label)) || parseVersionLabel(name),
        pending_version_label:
          v.pending_version_label == null ? null : asString(v.pending_version_label),
        held: true,
      })
    }

    for (const item of items) {
      const disposition = asString(item.disposition)
      if (disposition !== 'new' && disposition !== 'retired') continue
      if (heldIdsInCatalog.has(asString(item.held_form_version_id))) continue
      const name = asString(item.name)
      const formNumber = item.form_number == null ? null : asString(item.form_number)
      if (!matches(formNumber, name)) continue
      rows.push({
        id: `catalog:${asString(item.id)}`,
        libraryCode: code,
        form_number: formNumber,
        name,
        effective_date: null,
        page_count: typeof item.page_count === 'number' ? item.page_count : null,
        field_map_source: 'none',
        fieldCount: 0,
        signatureFieldCount: 0,
        signer_profile: null,
        isSample: false,
        blankUrl: null,
        freshness: disposition as FormDisposition,
        version_label: item.version_label == null ? null : asString(item.version_label),
        pending_version_label:
          disposition === 'new'
            ? item.version_label == null
              ? null
              : asString(item.version_label)
            : null,
        held: false,
      })
    }

    const counts = { current: 0, updated: 0, new: 0, retired: 0, unchecked: 0 }
    for (const r of rows) counts[r.freshness] += 1

    return {
      id: libId,
      code,
      name: asString(l.name),
      license_note: l.license_note == null ? null : asString(l.license_note),
      source_library_id: l.source_library_id == null ? null : asString(l.source_library_id),
      last_catalog_at: l.last_catalog_at == null ? null : asString(l.last_catalog_at),
      last_catalog_published_count:
        typeof l.last_catalog_published_count === 'number' ? l.last_catalog_published_count : null,
      forms: rows,
      counts,
    }
  })
}

async function ensureLibrary(
  code: string,
  name: string | null | undefined,
  sourceLibraryId: string | null | undefined,
): Promise<{ id: string; error: string | null }> {
  const sb = client()
  const { data: existing, error: readErr } = await sb
    .from('tc_form_libraries')
    .select('id')
    .eq('code', code)
    .maybeSingle()
  if (readErr) return { id: '', error: readErr.message }
  if (existing?.id) {
    const patch: Record<string, unknown> = {}
    if (sourceLibraryId) patch.source_library_id = sourceLibraryId
    if (name) patch.name = name
    if (Object.keys(patch).length) {
      await sb.from('tc_form_libraries').update(patch).eq('id', existing.id)
    }
    return { id: asString(existing.id), error: null }
  }
  const { data: created, error: insErr } = await sb
    .from('tc_form_libraries')
    .insert({
      code,
      name: name ?? code,
      region: 'US-OR',
      source_library_id: sourceLibraryId ?? null,
    })
    .select('id')
    .single()
  if (insErr || !created) return { id: '', error: insErr?.message ?? 'Could not create the library.' }
  return { id: asString(created.id), error: null }
}

async function applyOneLibrary(
  snapshot: LibrarySnapshot,
  actor: string,
  checkedAt: string,
): Promise<{ data: CatalogApplyLibraryResult | null; error: string | null }> {
  const sb = client()
  const lib = await ensureLibrary(snapshot.libraryCode, snapshot.libraryName, snapshot.sourceLibraryId)
  if (lib.error) return { data: null, error: lib.error }

  const { data: versionRows, error: verErr } = await sb
    .from('tc_form_versions')
    .select('id, source_form_id, source_version_id, form_number, name')
    .eq('library_id', lib.id)
    .is('retired_at', null)
  if (verErr) return { data: null, error: verErr.message }

  const held: HeldForm[] = ((versionRows ?? []) as Row[]).map((v) => ({
    id: asString(v.id),
    sourceFormId: v.source_form_id == null ? null : asString(v.source_form_id),
    sourceVersionId: v.source_version_id == null ? null : asString(v.source_version_id),
    formNumber: v.form_number == null ? null : asString(v.form_number),
    name: asString(v.name),
  }))

  const { items, counts } = diffLibraryCatalog(snapshot.forms, held)
  const incomingIds = new Set(snapshot.forms.map((f) => f.sourceFormId))

  for (const item of items) {
    const { error } = await sb.from('tc_form_catalog_items').upsert(
      {
        library_id: lib.id,
        source_form_id: item.sourceFormId,
        source_version_id: item.sourceVersionId,
        name: item.name,
        form_number: item.formNumber,
        page_count: item.pageCount,
        version_label: item.versionLabel,
        disposition: item.disposition,
        held_form_version_id: item.heldFormVersionId,
        last_seen_at: checkedAt,
      },
      { onConflict: 'library_id,source_form_id' },
    )
    if (error) return { data: null, error: error.message }
  }

  const { data: existingItems, error: existErr } = await sb
    .from('tc_form_catalog_items')
    .select('id, source_form_id')
    .eq('library_id', lib.id)
  if (existErr) return { data: null, error: existErr.message }

  const staleIds = ((existingItems ?? []) as Row[])
    .filter((row) => !incomingIds.has(asString(row.source_form_id)))
    .map((row) => asString(row.id))
    .filter(Boolean)
  if (staleIds.length) {
    const { error } = await sb
      .from('tc_form_catalog_items')
      .update({ disposition: 'retired' })
      .in('id', staleIds)
    if (error) return { data: null, error: error.message }
  }

  for (const item of items) {
    if (!item.heldFormVersionId) continue
    const heldRow = held.find((h) => h.id === item.heldFormVersionId)
    const stamp: Record<string, unknown> = { source_checked_at: checkedAt }
    const formNumber = item.formNumber || parseFormNumber(item.name)
    const versionLabel =
      item.versionLabel || parseVersionLabel(item.name) || parseVersionLabel(heldRow?.name ?? '')
    if (formNumber) stamp.form_number = formNumber
    if (versionLabel) stamp.version_label = versionLabel
    if (item.disposition === 'updated') {
      stamp.update_available = true
      stamp.pending_source_version_id = item.sourceVersionId
      stamp.pending_version_label = item.versionLabel
    } else if (item.disposition === 'current') {
      stamp.update_available = false
      stamp.pending_source_version_id = null
      stamp.pending_version_label = null
    }
    const { error } = await sb.from('tc_form_versions').update(stamp).eq('id', item.heldFormVersionId)
    if (error) return { data: null, error: error.message }
  }

  const { error: libStampErr } = await sb
    .from('tc_form_libraries')
    .update({
      last_catalog_at: checkedAt,
      last_catalog_published_count: snapshot.forms.length,
      source_library_id: snapshot.sourceLibraryId ?? undefined,
    })
    .eq('id', lib.id)
  if (libStampErr) return { data: null, error: libStampErr.message }

  const { error: checkErr } = await sb.from('tc_form_catalog_checks').insert({
    library_id: lib.id,
    source_library_id: snapshot.sourceLibraryId ?? null,
    checked_at: checkedAt,
    published_count: snapshot.forms.length,
    held_count: held.length,
    new_count: counts.new,
    updated_count: counts.updated,
    retired_count: counts.retired,
    current_count: counts.current,
    created_by: actor,
  })
  if (checkErr) return { data: null, error: checkErr.message }

  let pulled = 0
  let pullFailed = 0
  const toPull = catalogBlanksToPull(items, snapshot.forms)
  for (const blank of toPull) {
    if (!blank.previewUrl) continue
    try {
      const pdfRes = await fetch(blank.previewUrl)
      if (!pdfRes.ok) {
        pullFailed += 1
        continue
      }
      const pdf = Buffer.from(await pdfRes.arrayBuffer())
      const ingested = await ingestLicensedBlankPdf({
        libraryCode: snapshot.libraryCode,
        libraryName: snapshot.libraryName ?? undefined,
        formNumber: blank.formNumber,
        name: blank.name,
        sourceFormId: blank.sourceFormId,
        sourceVersionId: blank.sourceVersionId,
        versionLabel: blank.versionLabel,
        pageCount: blank.pageCount,
        pdf,
      })
      if (ingested.ok) pulled += 1
      else pullFailed += 1
    } catch {
      pullFailed += 1
    }
  }

  return {
    data: {
      libraryCode: snapshot.libraryCode,
      published: snapshot.forms.length,
      current: counts.current,
      updated: counts.updated,
      new: counts.new,
      retired: counts.retired,
      pulled,
      pullFailed,
    },
    error: null,
  }
}

export async function applyFormCatalogSnapshots(
  raw: unknown,
  actor: string,
): Promise<{ data: CatalogApplyResult | null; error: string | null }> {
  const parsed = parseCatalogPayload(raw)
  if ('error' in parsed) return { data: null, error: parsed.error }

  const checkedAt = new Date().toISOString()
  const libraries: CatalogApplyLibraryResult[] = []
  for (const snapshot of parsed.libraries) {
    const one = await applyOneLibrary(snapshot, actor, checkedAt)
    if (one.error || !one.data) return { data: null, error: one.error ?? 'Catalog apply failed.' }
    libraries.push(one.data)
  }
  return { data: { libraries, checkedAt }, error: null }
}
