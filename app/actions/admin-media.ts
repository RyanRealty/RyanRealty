'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'

const MEDIA_SCOPE_TO_BUCKET = {
  branding: 'branding',
  brokers: 'brokers',
  banners: 'banners',
  reports: 'reports',
} as const

const LIST_PAGE_SIZE = 100
const MAX_LIST_ITEMS = 1200

export type AdminMediaScope = keyof typeof MEDIA_SCOPE_TO_BUCKET

export type AdminMediaUsage = {
  source: string
  label: string
  targetId: string
}

export type AdminMediaAsset = {
  bucket: string
  path: string
  name: string
  sizeBytes: number | null
  updatedAt: string | null
  publicUrl: string
  usages: AdminMediaUsage[]
}

type BrokerageSettingsLite = {
  id: string
  logo_url: string | null
  hero_video_url: string | null
  hero_image_url: string | null
  team_image_url: string | null
}

type BrokerLite = {
  id: string
  slug: string
  display_name: string
  photo_url: string | null
  intro_video_url: string | null
  saved_headshot_urls: string[] | null
}

type BrokerGeneratedMediaLite = {
  id: string
  broker_id: string
  url: string
}

type BannerImageLite = {
  entity_type: string
  entity_key: string
  storage_path: string
}

type HeroVideoLite = {
  entity_type: string
  entity_key: string
  storage_path: string
}

type MarketReportLite = {
  slug: string
  image_storage_path: string | null
}

type StorageListItem = {
  id?: string | null
  name: string
  updated_at?: string | null
  metadata?: { size?: number } | null
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    throw new Error('Supabase service role is not configured.')
  }
  return createClient(url, serviceKey)
}

function getPublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
}

function getPublicStorageUrl(bucket: string, path: string) {
  return `${getPublicBaseUrl()}/storage/v1/object/public/${bucket}/${path}`
}

function normalizePath(input: string) {
  return input.replace(/^\/+/, '').replace(/\/+/g, '/').trim()
}

function getPublicPathFromUrl(url: string, bucket: string): string | null {
  const needle = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(needle)
  if (idx < 0) return null
  const raw = url.slice(idx + needle.length)
  if (!raw.trim()) return null
  return normalizePath(raw)
}

function inferScopeFromBucket(bucket: string): AdminMediaScope | null {
  const scopes = Object.entries(MEDIA_SCOPE_TO_BUCKET) as Array<[AdminMediaScope, string]>
  const match = scopes.find(([, b]) => b === bucket)
  return match?.[0] ?? null
}

async function requireAdminAccessForMedia() {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const adminRole = await getAdminRoleForEmail(email)
  if (!email || !adminRole) {
    return { ok: false as const, error: 'Admin access is required.', adminEmail: '', role: null as string | null }
  }
  return { ok: true as const, adminEmail: email, role: adminRole.role, brokerId: adminRole.brokerId }
}

async function listStoragePaths(bucket: string): Promise<AdminMediaAsset[]> {
  const supabase = getServiceSupabase()
  const queue: string[] = ['']
  const items: AdminMediaAsset[] = []

  while (queue.length > 0 && items.length < MAX_LIST_ITEMS) {
    const prefix = queue.shift() ?? ''
    let offset = 0

    while (items.length < MAX_LIST_ITEMS) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, {
          limit: LIST_PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

      if (error || !data || data.length === 0) break

      for (const entry of data as StorageListItem[]) {
        const fullPath = normalizePath(prefix ? `${prefix}/${entry.name}` : entry.name)
        const isDirectory = !entry.id
        if (isDirectory) {
          queue.push(fullPath)
          continue
        }
        items.push({
          bucket,
          path: fullPath,
          name: entry.name,
          sizeBytes: typeof entry.metadata?.size === 'number' ? entry.metadata.size : null,
          updatedAt: entry.updated_at ?? null,
          publicUrl: getPublicStorageUrl(bucket, fullPath),
          usages: [],
        })
        if (items.length >= MAX_LIST_ITEMS) break
      }

      if (data.length < LIST_PAGE_SIZE) break
      offset += LIST_PAGE_SIZE
    }
  }

  return items
}

async function getUsageMap(scope: AdminMediaScope) {
  const supabase = getServiceSupabase()
  const usageMap = new Map<string, AdminMediaUsage[]>()

  const addUsage = (path: string | null, usage: AdminMediaUsage) => {
    if (!path) return
    const normalized = normalizePath(path)
    if (!normalized) return
    const current = usageMap.get(normalized) ?? []
    current.push(usage)
    usageMap.set(normalized, current)
  }

  if (scope === 'branding') {
    const { data: rows } = await supabase
      .from('brokerage_settings')
      .select('id, logo_url, hero_video_url, hero_image_url, team_image_url')

    for (const row of (rows ?? []) as BrokerageSettingsLite[]) {
      addUsage(getPublicPathFromUrl(row.logo_url ?? '', 'branding'), {
        source: 'brokerage_settings',
        label: 'Logo',
        targetId: row.id,
      })
      addUsage(getPublicPathFromUrl(row.hero_video_url ?? '', 'branding'), {
        source: 'brokerage_settings',
        label: 'Hero video',
        targetId: row.id,
      })
      addUsage(getPublicPathFromUrl(row.hero_image_url ?? '', 'branding'), {
        source: 'brokerage_settings',
        label: 'Hero image',
        targetId: row.id,
      })
      addUsage(getPublicPathFromUrl(row.team_image_url ?? '', 'branding'), {
        source: 'brokerage_settings',
        label: 'Team image',
        targetId: row.id,
      })
    }
  }

  if (scope === 'brokers') {
    const [brokersRes, mediaRes] = await Promise.all([
      supabase.from('brokers').select('id, slug, display_name, photo_url, intro_video_url, saved_headshot_urls'),
      supabase.from('broker_generated_media').select('id, broker_id, url'),
    ])
    if (brokersRes.error) console.error('[admin-media] brokers query failed:', brokersRes.error.message)
    if (mediaRes.error) console.error('[admin-media] broker_generated_media query failed:', mediaRes.error.message)
    const { data: brokersRows } = brokersRes
    const { data: mediaRows } = mediaRes

    for (const row of (brokersRows ?? []) as BrokerLite[]) {
      const brokerLabel = row.display_name || row.slug || row.id
      addUsage(getPublicPathFromUrl(row.photo_url ?? '', 'brokers'), {
        source: 'brokers',
        label: `Profile photo (${brokerLabel})`,
        targetId: row.id,
      })
      addUsage(getPublicPathFromUrl(row.intro_video_url ?? '', 'brokers'), {
        source: 'brokers',
        label: `Intro video (${brokerLabel})`,
        targetId: row.id,
      })
      for (const url of row.saved_headshot_urls ?? []) {
        addUsage(getPublicPathFromUrl(url, 'brokers'), {
          source: 'brokers',
          label: `Saved headshot (${brokerLabel})`,
          targetId: row.id,
        })
      }
    }

    for (const media of (mediaRows ?? []) as BrokerGeneratedMediaLite[]) {
      addUsage(getPublicPathFromUrl(media.url, 'brokers'), {
        source: 'broker_generated_media',
        label: 'Generated broker media',
        targetId: media.id,
      })
    }
  }

  if (scope === 'banners') {
    const [bannerRes, heroRes, reportRes] = await Promise.all([
      supabase.from('banner_images').select('entity_type, entity_key, storage_path'),
      supabase.from('hero_videos').select('entity_type, entity_key, storage_path'),
      supabase.from('market_reports').select('slug, image_storage_path'),
    ])
    if (bannerRes.error) console.error('[admin-media] banner_images query failed:', bannerRes.error.message)
    if (heroRes.error) console.error('[admin-media] hero_videos query failed:', heroRes.error.message)
    if (reportRes.error) console.error('[admin-media] market_reports query failed:', reportRes.error.message)
    const { data: bannerRows } = bannerRes
    const { data: heroRows } = heroRes
    const { data: reportRows } = reportRes

    for (const row of (bannerRows ?? []) as BannerImageLite[]) {
      addUsage(row.storage_path, {
        source: 'banner_images',
        label: `${row.entity_type}: ${row.entity_key}`,
        targetId: `${row.entity_type}:${row.entity_key}`,
      })
    }
    for (const row of (heroRows ?? []) as HeroVideoLite[]) {
      addUsage(row.storage_path, {
        source: 'hero_videos',
        label: `${row.entity_type}: ${row.entity_key}`,
        targetId: `${row.entity_type}:${row.entity_key}`,
      })
    }
    for (const row of (reportRows ?? []) as MarketReportLite[]) {
      addUsage(row.image_storage_path, {
        source: 'market_reports',
        label: `Report image (${row.slug})`,
        targetId: row.slug,
      })
    }
  }

  return usageMap
}

export async function listAdminMedia(scope: AdminMediaScope, search?: string): Promise<{
  ok: true
  bucket: string
  assets: AdminMediaAsset[]
} | {
  ok: false
  error: string
}> {
  const access = await requireAdminAccessForMedia()
  if (!access.ok) return { ok: false, error: access.error }

  const bucket = MEDIA_SCOPE_TO_BUCKET[scope]
  try {
    const [assets, usageMap] = await Promise.all([listStoragePaths(bucket), getUsageMap(scope)])
    const query = (search ?? '').trim().toLowerCase()

    const withUsage = assets
      .map((asset) => ({ ...asset, usages: usageMap.get(asset.path) ?? [] }))
      .filter((asset) => {
        if (!query) return true
        const haystack = `${asset.path} ${asset.name} ${asset.usages.map((u) => u.label).join(' ')}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })

    return { ok: true, bucket, assets: withUsage }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load media.'
    return { ok: false, error: message }
  }
}

export async function uploadAdminMedia(params: {
  scope: AdminMediaScope
  pathPrefix?: string
  fileNameOverride?: string
  formData: FormData
}): Promise<{ ok: true; path: string; publicUrl: string } | { ok: false; error: string }> {
  const access = await requireAdminAccessForMedia()
  if (!access.ok) return { ok: false, error: access.error }

  const file = params.formData.get('file') as File | null
  if (!file || !file.size) return { ok: false, error: 'Select a file to upload.' }

  const bucket = MEDIA_SCOPE_TO_BUCKET[params.scope]
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : ''
  const safeExt = ext.replace(/[^a-z0-9]/g, '')
  const baseName = (params.fileNameOverride?.trim() || file.name.replace(/\.[^/.]+$/, '') || `asset-${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const fileName = safeExt ? `${baseName}.${safeExt}` : baseName

  const pathPrefix = normalizePath(params.pathPrefix ?? '')
  const path = normalizePath(pathPrefix ? `${pathPrefix}/${fileName}` : fileName)
  if (!path) return { ok: false, error: 'Invalid storage path.' }

  try {
    const supabase = getServiceSupabase()
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type || undefined,
      })
    if (error) return { ok: false, error: error.message }

    const publicUrl = getPublicStorageUrl(bucket, path)
    await logAdminAction({
      adminEmail: access.adminEmail,
      role: access.role,
      actionType: 'upload',
      resourceType: 'media_asset',
      resourceId: `${bucket}/${path}`,
      details: {
        bucket,
        path,
        fileSize: file.size,
        fileType: file.type || null,
      },
    })

    return { ok: true, path, publicUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return { ok: false, error: message }
  }
}

export async function deleteAdminMediaAsset(params: {
  bucket: string
  path: string
  forceUnlink?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireAdminAccessForMedia()
  if (!access.ok) return { ok: false, error: access.error }
  if (access.role !== 'superuser') return { ok: false, error: 'Only superuser can delete media.' }

  const scope = inferScopeFromBucket(params.bucket)
  if (!scope) return { ok: false, error: 'Unsupported bucket.' }

  const bucket = params.bucket
  const path = normalizePath(params.path)
  if (!path) return { ok: false, error: 'Invalid asset path.' }

  try {
    const supabase = getServiceSupabase()
    const usages = (await getUsageMap(scope)).get(path) ?? []
    if (usages.length > 0 && !params.forceUnlink) {
      return {
        ok: false,
        error: `Asset is still referenced in ${usages.length} place(s). Use force unlink to remove references first.`,
      }
    }

    if (params.forceUnlink && usages.length > 0) {
      const publicUrl = getPublicStorageUrl(bucket, path)

      if (scope === 'branding') {
        const { data: rows } = await supabase
          .from('brokerage_settings')
          .select('id, logo_url, hero_video_url, hero_image_url, team_image_url')

        for (const row of (rows ?? []) as BrokerageSettingsLite[]) {
          const updates: Partial<BrokerageSettingsLite> = {}
          if (row.logo_url === publicUrl) updates.logo_url = null
          if (row.hero_video_url === publicUrl) updates.hero_video_url = null
          if (row.hero_image_url === publicUrl) updates.hero_image_url = null
          if (row.team_image_url === publicUrl) updates.team_image_url = null
          if (Object.keys(updates).length > 0) {
            await supabase.from('brokerage_settings').update(updates).eq('id', row.id)
          }
        }
      }

      if (scope === 'brokers') {
        const { data: brokerRows } = await supabase
          .from('brokers')
          .select('id, photo_url, intro_video_url, saved_headshot_urls')

        for (const row of (brokerRows ?? []) as Array<Pick<BrokerLite, 'id' | 'photo_url' | 'intro_video_url' | 'saved_headshot_urls'>>) {
          const updates: Partial<Pick<BrokerLite, 'photo_url' | 'intro_video_url' | 'saved_headshot_urls'>> = {}
          if (row.photo_url === publicUrl) updates.photo_url = null
          if (row.intro_video_url === publicUrl) updates.intro_video_url = null
          const currentHeadshots = row.saved_headshot_urls ?? []
          if (currentHeadshots.includes(publicUrl)) {
            updates.saved_headshot_urls = currentHeadshots.filter((url) => url !== publicUrl)
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('brokers').update(updates).eq('id', row.id)
          }
        }

        await supabase.from('broker_generated_media').delete().eq('url', publicUrl)
      }

      if (scope === 'banners') {
        await supabase.from('banner_images').delete().eq('storage_path', path)
        await supabase.from('hero_videos').delete().eq('storage_path', path)
        await supabase.from('market_reports').update({ image_storage_path: null }).eq('image_storage_path', path)
      }
    }

    const { error: removeError } = await supabase.storage.from(bucket).remove([path])
    if (removeError) return { ok: false, error: removeError.message }

    await logAdminAction({
      adminEmail: access.adminEmail,
      role: access.role,
      actionType: 'delete',
      resourceType: 'media_asset',
      resourceId: `${bucket}/${path}`,
      details: {
        bucket,
        path,
        forceUnlink: !!params.forceUnlink,
      },
    })

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed.'
    return { ok: false, error: message }
  }
}
