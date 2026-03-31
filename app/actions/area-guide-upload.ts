'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET_NAME = 'community-media'

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv'])

export const KNOWN_CITIES = new Set([
  'Bend', 'La Pine', 'Redmond', 'Sisters', 'Sunriver', 'Madras',
  'Prineville', 'Terrebonne', 'Tumalo', 'Powell Butte', 'Crooked River Ranch',
  'Camp Sherman', 'Culver', 'Metolius',
])

export const KNOWN_NEIGHBORHOODS = new Set([
  'Old Bend', 'Southwest Bend', 'Southeast Bend', 'Northwest Bend', 'Northeast Bend',
  'Boyd Acres', 'Old Farm District', 'Orchard District', 'Summit West',
  'Century West', 'River West', 'West Hills', 'Mountain View',
])

export const FOLDER_ALIASES: Record<string, string> = {
  'BBR': 'Black Butte Ranch',
  'Black Butte': 'Black Butte Ranch',
  'Eagle Crest': 'Eagle Crest Resort',
  'Brasada': 'Brasada Ranch',
  'NWX': 'Northwest Crossing',
  'NW Crossing': 'Northwest Crossing',
  'Mt Bachelor Village': 'Mt. Bachelor Village',
  'Mount Bachelor Village': 'Mt. Bachelor Village',
  'Caldera': 'Caldera Springs',
  'Whychus (Squaw Creek) Canyon Estates': 'Whychus Canyon Estates',
}

export const SKIP_FOLDERS = new Set([
  'For YouTube', 'WEBSITE LANDING',
])

export type AreaGuideEntityType = 'community' | 'city' | 'neighborhood'

interface EntityRow {
  id: string
  name: string
  slug: string
  type: AreaGuideEntityType
  hero_image_url: string | null
  hero_video_url: string | null
  city_id?: string | null
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function isPhoto(filename: string): boolean {
  return PHOTO_EXTENSIONS.has(filename.slice(filename.lastIndexOf('.')).toLowerCase())
}

function isVideo(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(filename.slice(filename.lastIndexOf('.')).toLowerCase())
}

function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.avif': 'image/avif', '.heic': 'image/heic',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

function classifyFolder(folderName: string): AreaGuideEntityType {
  const normalized = FOLDER_ALIASES[folderName] ?? folderName
  if (KNOWN_CITIES.has(normalized)) return 'city'
  if (KNOWN_NEIGHBORHOODS.has(normalized)) return 'neighborhood'
  return 'community'
}

type CommunityRow = { id: string; name: string; slug: string; hero_image_url: string | null; hero_video_url: string | null }
type CityRow = { id: string; name: string; slug: string; hero_image_url: string | null; hero_video_url: string | null }
type NeighborhoodRow = { id: string; name: string; slug: string; hero_image_url: string | null; city_id: string | null }

async function fetchAllEntities(supabase: SupabaseClient): Promise<EntityRow[]> {
  const entities: EntityRow[] = []
  const [communities, cities, neighborhoods] = await Promise.all([
    supabase.from('communities').select('id, name, slug, hero_image_url, hero_video_url'),
    supabase.from('cities').select('id, name, slug, hero_image_url, hero_video_url'),
    supabase.from('neighborhoods').select('id, name, slug, hero_image_url, city_id'),
  ])
  for (const c of (communities.data ?? []) as CommunityRow[]) {
    entities.push({ ...c, type: 'community' })
  }
  for (const c of (cities.data ?? []) as CityRow[]) {
    entities.push({ ...c, type: 'city' })
  }
  for (const n of (neighborhoods.data ?? []) as NeighborhoodRow[]) {
    entities.push({ ...n, type: 'neighborhood', hero_video_url: null })
  }
  return entities
}

function matchEntity(folderName: string, entities: EntityRow[]): EntityRow | null {
  const normalized = folderName.trim()
  const aliased = FOLDER_ALIASES[normalized] ?? normalized
  const exact = entities.find((e) => e.name.toLowerCase() === aliased.toLowerCase())
  if (exact) return exact
  const folderSlug = slugify(aliased)
  const slugMatch = entities.find((e) => e.slug === folderSlug)
  if (slugMatch) return slugMatch
  const fuzzy = entities.find((e) => {
    const eLower = e.name.toLowerCase()
    const fLower = aliased.toLowerCase()
    return eLower.includes(fLower) || fLower.includes(eLower)
  })
  return fuzzy ?? null
}

export type FolderMappingRow = {
  folderName: string
  entityType: AreaGuideEntityType
  entityId: string | null
  entityName: string
  entitySlug: string
  status: 'matched' | 'create'
  photoCount: number
  videoCount: number
}

/**
 * Returns how each folder name maps to a city, neighborhood, or subdivision,
 * and whether we'll use an existing record or create one.
 */
export async function getAreaGuideEntityMapping(
  folders: { name: string; photoCount: number; videoCount: number }[]
): Promise<{ ok: true; rows: FolderMappingRow[] } | { ok: false; error: string }> {
  const supabase = createServiceClient()
  const entities = await fetchAllEntities(supabase)
  const rows: FolderMappingRow[] = []
  for (const { name, photoCount, videoCount } of folders) {
    if (SKIP_FOLDERS.has(name)) continue
    const entityType = classifyFolder(name)
    const canonicalName = FOLDER_ALIASES[name] ?? name
    const entitySlug = slugify(canonicalName)
    const entity = matchEntity(name, entities)
    if (entity) {
      rows.push({
        folderName: name,
        entityType: entity.type,
        entityId: entity.id,
        entityName: entity.name,
        entitySlug: entity.slug,
        status: 'matched',
        photoCount,
        videoCount,
      })
    } else {
      rows.push({
        folderName: name,
        entityType,
        entityId: null,
        entityName: canonicalName,
        entitySlug,
        status: 'create',
        photoCount,
        videoCount,
      })
    }
  }
  return { ok: true, rows }
}

async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET_NAME)) return
  await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 500 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
    ],
  })
}

/**
 * Create a city, neighborhood, or community if it doesn't exist. Returns entity id and slug.
 */
async function getOrCreateEntity(
  supabase: SupabaseClient,
  folderName: string,
  entityType: AreaGuideEntityType,
  bendCityId: string | null
): Promise<{ id: string; name: string; slug: string; type: AreaGuideEntityType } | null> {
  const canonicalName = FOLDER_ALIASES[folderName] ?? folderName
  const slug = slugify(canonicalName)
  type InsertRow = { id: string; name: string; slug: string }
  if (entityType === 'city') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('cities')
      .insert({ name: canonicalName, slug, state: 'OR' })
      .select('id, name, slug')
      .single()
    if (error) return null
    return { ...(data as InsertRow), type: 'city' }
  }
  if (entityType === 'neighborhood') {
    const insertData: { name: string; slug: string; city_id?: string } = { name: canonicalName, slug }
    if (bendCityId) insertData.city_id = bendCityId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('neighborhoods')
      .insert(insertData)
      .select('id, name, slug')
      .single()
    if (error) return null
    return { ...(data as InsertRow), type: 'neighborhood' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('communities')
    .insert({ name: canonicalName, slug })
    .select('id, name, slug')
    .single()
  if (error) return null
  return { ...(data as InsertRow), type: 'community' }
}

/**
 * Upload one folder's media and update hero URLs / page_images.
 * formData must contain: folderName, entityType, entityId (or empty to create), entitySlug, entityName;
 * and entries "files" (File[]) or individual file entries with paths in the key (e.g. "path:photos/1.jpg").
 * We use: formData.get('folderName'), formData.get('entityType'), formData.get('entityId'), formData.get('entitySlug'), formData.get('entityName'),
 * and formData.getAll('files') for File objects. Each file's name is the basename; we need relative path - so we'll use formData entries like "file:path/to/file.jpg" with the file as value... Actually File has .name which is just the name. We need to send path separately. So: for each file, append with key `file:${relativePath}` and value = File. Then we can iterate formData.entries() and for key.startsWith('file:') we get path and file.
 */
export async function uploadAreaGuideFolder(
  formData: FormData
): Promise<{ ok: true; photos: number; videos: number } | { ok: false; error: string }> {
  const supabase = createServiceClient()
  const folderName = String(formData.get('folderName') ?? '').trim()
  const entityType = String(formData.get('entityType') ?? '') as AreaGuideEntityType
  let entityId = String(formData.get('entityId') ?? '').trim() || null
  let entitySlug = String(formData.get('entitySlug') ?? '').trim()
  const entityName = String(formData.get('entityName') ?? folderName).trim()
  if (!folderName || !entityType || !entitySlug) {
    return { ok: false, error: 'Missing folderName, entityType, or entitySlug.' }
  }
  if (!['city', 'neighborhood', 'community'].includes(entityType)) {
    return { ok: false, error: 'Invalid entityType.' }
  }

  const files: { file: File; relativePath: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('file:') && value instanceof File) {
      const relativePath = key.slice(5).trim()
      if (relativePath && value.size > 0) files.push({ file: value, relativePath })
    }
  }
  const photos = files.filter((f) => isPhoto(f.relativePath))
  const videos = files.filter((f) => isVideo(f.relativePath))
  if (photos.length === 0 && videos.length === 0) {
    return { ok: false, error: 'No photo or video files in this folder.' }
  }

  if (!entityId) {
    const bendCity = (await supabase.from('cities').select('id').ilike('name', 'bend').limit(1).single()).data
    const bendCityId = bendCity?.id ?? null
    const created = await getOrCreateEntity(supabase, folderName, entityType, bendCityId)
    if (!created) return { ok: false, error: `Could not create ${entityType} "${entityName}".` }
    entityId = created.id
    entitySlug = created.slug
  }

  await ensureBucket(supabase)
  const storagePrefix = `${entityType}/${entitySlug}`
  let heroImageUrl: string | null = null
  let heroVideoUrl: string | null = null
  const additionalPhotoUrls: string[] = []

  const getStoragePath = (relativePath: string, isVideoFile: boolean) => {
    const base = relativePath.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '')
    const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase()
    const sub = isVideoFile ? 'videos' : 'photos'
    return `${storagePrefix}/${sub}/${slugify(base)}${ext}`
  }

  const existingPaths = new Set<string>()
  const [photosList, videosList] = await Promise.all([
    supabase.storage.from(BUCKET_NAME).list(`${storagePrefix}/photos`),
    supabase.storage.from(BUCKET_NAME).list(`${storagePrefix}/videos`),
  ])
  for (const item of photosList.data ?? []) {
    if (item.name) existingPaths.add(`${storagePrefix}/photos/${item.name}`)
  }
  for (const item of videosList.data ?? []) {
    if (item.name) existingPaths.add(`${storagePrefix}/videos/${item.name}`)
  }

  for (let i = 0; i < photos.length; i++) {
    const { file, relativePath } = photos[i]
    const storagePath = getStoragePath(relativePath, false)
    let url: string
    if (existingPaths.has(storagePath)) {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
      url = data.publicUrl
    } else {
      const buf = Buffer.from(await file.arrayBuffer())
      const contentType = getMimeType(relativePath)
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buf, { contentType, upsert: true })
      if (error) continue
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
      url = data.publicUrl
      existingPaths.add(storagePath)
    }
    if (i === 0) heroImageUrl = url
    else additionalPhotoUrls.push(url)
  }
  for (let i = 0; i < videos.length; i++) {
    const { file, relativePath } = videos[i]
    const storagePath = getStoragePath(relativePath, true)
    let url: string
    if (existingPaths.has(storagePath)) {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
      url = data.publicUrl
    } else {
      const buf = Buffer.from(await file.arrayBuffer())
      const contentType = getMimeType(relativePath)
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buf, { contentType, upsert: true })
      if (error) continue
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
      url = data.publicUrl
      existingPaths.add(storagePath)
    }
    if (i === 0 && entityType !== 'neighborhood') heroVideoUrl = url
  }

  const table = entityType === 'city' ? 'cities' : entityType === 'neighborhood' ? 'neighborhoods' : 'communities'
  const updates: Record<string, string> = {}
  if (heroImageUrl) updates.hero_image_url = heroImageUrl
  if (entityType !== 'neighborhood' && heroVideoUrl) updates.hero_video_url = heroVideoUrl
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    await supabase.from(table).update(updates).eq('id', entityId)
  }

  const { data: existingPageImages } = await supabase
    .from('page_images')
    .select('image_url')
    .eq('page_type', entityType)
    .eq('page_id', entitySlug)
  const existingUrls = new Set((existingPageImages ?? []).map((r) => r.image_url))
  for (const url of additionalPhotoUrls) {
    if (existingUrls.has(url)) continue
    await supabase.from('page_images').insert({
      page_type: entityType,
      page_id: entitySlug,
      image_url: url,
      source: 'upload',
    })
  }

  return { ok: true, photos: photos.length, videos: videos.length }
}
