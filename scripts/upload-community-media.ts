/**
 * Bulk Upload Area Guide Media to Supabase
 * =========================================
 * Scans a local folder structured as:
 *
 *   Area Guides/
 *   ├── Tetherow/          → community (subdivision)
 *   ├── Old Bend/          → neighborhood
 *   ├── La Pine/           → city
 *   ├── Broken Top/        → community
 *   └── ...
 *
 * For each subfolder it:
 *   1. Matches the folder name to a community, city, or neighborhood in Supabase
 *   2. If no match, auto-creates the record (community by default, or city/neighborhood if known)
 *   3. Uploads all photos/videos to the `community-media` storage bucket
 *   4. Sets the first photo as hero_image_url and first video as hero_video_url
 *   5. Creates `page_images` records for additional photos
 *
 * Setup (one-time):
 *   npm install -D tsx
 *
 * Usage:
 *   npx tsx scripts/upload-community-media.ts "H:\My Drive\Ryan Realty\Marketing\Media\Web Site\Area Guides"
 *   npx tsx scripts/upload-community-media.ts "H:\My Drive\...\Area Guides" --dry-run
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - The `community-media` storage bucket will be created automatically if missing
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Load environment from .env.local ────────────────────────────────
function loadEnv(envPath: string): void {
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

loadEnv(path.resolve(__dirname, '../.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Config ──────────────────────────────────────────────────────────
const BUCKET_NAME = 'community-media'
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv'])
const DRY_RUN = process.argv.includes('--dry-run')

// ─── Known entity classifications ────────────────────────────────────
// Folder names we KNOW are cities (not communities or neighborhoods)
const KNOWN_CITIES = new Set([
  'Bend', 'La Pine', 'Redmond', 'Sisters', 'Sunriver', 'Madras',
  'Prineville', 'Terrebonne', 'Tumalo', 'Powell Butte', 'Crooked River Ranch',
  'Camp Sherman', 'Culver', 'Metolius',
])

// Folder names we KNOW are neighborhoods (groups of subdivisions)
const KNOWN_NEIGHBORHOODS = new Set([
  'Old Bend', 'Southwest Bend', 'Southeast Bend', 'Northwest Bend', 'Northeast Bend',
  'Boyd Acres', 'Old Farm District', 'Orchard District', 'Summit West',
  'Century West', 'River West', 'West Hills', 'Mountain View',
])

// Folder name → canonical name overrides
const FOLDER_ALIASES: Record<string, string> = {
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

// Folders to skip entirely (not a geographic entity)
const SKIP_FOLDERS = new Set([
  'For YouTube', 'WEBSITE LANDING',
])

// ─── Helpers ─────────────────────────────────────────────────────────

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
  return PHOTO_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function isVideo(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.avif': 'image/avif', '.heic': 'image/heic',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

// ─── Types ───────────────────────────────────────────────────────────

type EntityType = 'community' | 'city' | 'neighborhood'

interface Entity {
  id: string
  name: string
  slug: string
  type: EntityType
  hero_image_url: string | null
  hero_video_url: string | null // neighborhoods don't have this
  city_id?: string | null       // neighborhoods have a city_id FK
}

// ─── Fetch all entities ──────────────────────────────────────────────

async function fetchAllEntities(): Promise<Entity[]> {
  const entities: Entity[] = []

  // Communities
  const { data: communities, error: cErr } = await supabase
    .from('communities')
    .select('id, name, slug, hero_image_url, hero_video_url')
  if (cErr) console.error('Warning: failed to fetch communities:', cErr.message)
  for (const c of communities || []) {
    entities.push({ ...c, type: 'community' })
  }

  // Cities
  const { data: cities, error: ciErr } = await supabase
    .from('cities')
    .select('id, name, slug, hero_image_url, hero_video_url')
  if (ciErr) console.error('Warning: failed to fetch cities:', ciErr.message)
  for (const c of cities || []) {
    entities.push({ ...c, type: 'city' })
  }

  // Neighborhoods
  const { data: neighborhoods, error: nErr } = await supabase
    .from('neighborhoods')
    .select('id, name, slug, hero_image_url, city_id')
  if (nErr) console.error('Warning: failed to fetch neighborhoods:', nErr.message)
  for (const n of neighborhoods || []) {
    entities.push({ ...n, type: 'neighborhood', hero_video_url: null })
  }

  return entities
}

// ─── Match folder to entity ──────────────────────────────────────────

function matchEntity(folderName: string, entities: Entity[]): Entity | null {
  const normalized = folderName.trim()
  const aliased = FOLDER_ALIASES[normalized] || normalized

  // 1. Exact name match (case-insensitive)
  const exactMatch = entities.find(
    (e) => e.name.toLowerCase() === aliased.toLowerCase()
  )
  if (exactMatch) return exactMatch

  // 2. Slug match
  const folderSlug = slugify(aliased)
  const slugMatch = entities.find((e) => e.slug === folderSlug)
  if (slugMatch) return slugMatch

  // 3. Fuzzy: folder name contains or is contained by entity name
  const fuzzyMatch = entities.find((e) => {
    const eLower = e.name.toLowerCase()
    const fLower = aliased.toLowerCase()
    return eLower.includes(fLower) || fLower.includes(eLower)
  })
  if (fuzzyMatch) return fuzzyMatch

  return null
}

// ─── Auto-create entity ──────────────────────────────────────────────

function classifyFolder(folderName: string): EntityType {
  const normalized = FOLDER_ALIASES[folderName] || folderName
  if (KNOWN_CITIES.has(normalized)) return 'city'
  if (KNOWN_NEIGHBORHOODS.has(normalized)) return 'neighborhood'
  return 'community'
}

async function createEntity(folderName: string, type: EntityType, bendCityId: string | null): Promise<Entity | null> {
  const canonicalName = FOLDER_ALIASES[folderName] || folderName
  const slug = slugify(canonicalName)

  if (type === 'city') {
    const { data, error } = await supabase
      .from('cities')
      .insert({ name: canonicalName, slug, state: 'OR' })
      .select('id, name, slug, hero_image_url, hero_video_url')
      .single()
    if (error) {
      console.error(`  ✗ Failed to create city "${canonicalName}": ${error.message}`)
      return null
    }
    console.log(`  🆕 Created city: "${canonicalName}" (${slug})`)
    return { ...data, type: 'city' }
  }

  if (type === 'neighborhood') {
    const insertData: Record<string, unknown> = { name: canonicalName, slug }
    // Assign to Bend by default if we have a Bend city ID
    if (bendCityId) insertData.city_id = bendCityId
    const { data, error } = await supabase
      .from('neighborhoods')
      .insert(insertData)
      .select('id, name, slug, hero_image_url, city_id')
      .single()
    if (error) {
      console.error(`  ✗ Failed to create neighborhood "${canonicalName}": ${error.message}`)
      return null
    }
    console.log(`  🆕 Created neighborhood: "${canonicalName}" (${slug})`)
    return { ...data, type: 'neighborhood', hero_video_url: null }
  }

  // Default: community
  const { data, error } = await supabase
    .from('communities')
    .insert({ name: canonicalName, slug })
    .select('id, name, slug, hero_image_url, hero_video_url')
    .single()
  if (error) {
    console.error(`  ✗ Failed to create community "${canonicalName}": ${error.message}`)
    return null
  }
  console.log(`  🆕 Created community: "${canonicalName}" (${slug})`)
  return { ...data, type: 'community' }
}

// ─── Storage ─────────────────────────────────────────────────────────

async function ensureBucket(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET_NAME)

  if (!exists) {
    console.log(`Creating storage bucket: ${BUCKET_NAME}`)
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 500 * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
      ],
    })
    if (error) {
      console.error('Failed to create bucket:', error.message)
      process.exit(1)
    }
    console.log(`Bucket "${BUCKET_NAME}" created.`)
  } else {
    console.log(`Bucket "${BUCKET_NAME}" already exists.`)
  }
}

async function uploadFile(filePath: string, storagePath: string): Promise<string | null> {
  const fileBuffer = fs.readFileSync(filePath)
  const contentType = getMimeType(filePath)

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, { contentType, upsert: true })

  if (error) {
    console.error(`  ✗ Upload failed: ${storagePath} — ${error.message}`)
    return null
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
  return data.publicUrl
}

// ─── Process a folder ────────────────────────────────────────────────

async function processFolder(
  folderPath: string,
  folderName: string,
  entity: Entity
): Promise<{ photos: number; videos: number }> {
  // Collect all media files, including from subdirectories
  const allPhotos: { file: string; relativePath: string }[] = []
  const allVideos: { file: string; relativePath: string }[] = []

  function scanDir(dirPath: string, prefix: string) {
    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        // Recurse into subdirectories (e.g., "photos/", "videos/")
        scanDir(fullPath, prefix ? `${prefix}/${entry}` : entry)
      } else if (stat.isFile()) {
        const relPath = prefix ? `${prefix}/${entry}` : entry
        if (isPhoto(entry)) allPhotos.push({ file: entry, relativePath: relPath })
        else if (isVideo(entry)) allVideos.push({ file: entry, relativePath: relPath })
      }
    }
  }

  scanDir(folderPath, '')

  if (allPhotos.length === 0 && allVideos.length === 0) {
    console.log(`  ⚠ No media files found in "${folderName}"`)
    return { photos: 0, videos: 0 }
  }

  console.log(`  Found ${allPhotos.length} photos, ${allVideos.length} videos`)

  const entitySlug = entity.slug
  const storagePrefix = `${entity.type}/${entitySlug}`
  let heroImageUrl = entity.hero_image_url
  let heroVideoUrl = entity.hero_video_url
  const additionalPhotos: { url: string; filename: string }[] = []

  // Upload photos
  for (let i = 0; i < allPhotos.length; i++) {
    const { file, relativePath } = allPhotos[i]
    const ext = path.extname(file).toLowerCase()
    const storagePath = `${storagePrefix}/photos/${slugify(path.basename(file, ext))}${ext}`
    const filePath = path.join(folderPath, relativePath)

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would upload: ${relativePath} → ${storagePath}`)
      continue
    }

    const url = await uploadFile(filePath, storagePath)
    if (!url) continue

    console.log(`  ✓ Uploaded photo: ${relativePath}`)

    if (i === 0 && !heroImageUrl) {
      heroImageUrl = url
    } else {
      additionalPhotos.push({ url, filename: file })
    }
  }

  // Upload videos
  for (let i = 0; i < allVideos.length; i++) {
    const { file, relativePath } = allVideos[i]
    const ext = path.extname(file).toLowerCase()
    const storagePath = `${storagePrefix}/videos/${slugify(path.basename(file, ext))}${ext}`
    const filePath = path.join(folderPath, relativePath)

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would upload: ${relativePath} → ${storagePath}`)
      continue
    }

    const url = await uploadFile(filePath, storagePath)
    if (!url) continue

    console.log(`  ✓ Uploaded video: ${relativePath}`)

    if (i === 0 && !heroVideoUrl) {
      heroVideoUrl = url
    }
  }

  if (DRY_RUN) return { photos: allPhotos.length, videos: allVideos.length }

  // Update hero URLs on the entity
  const table = entity.type === 'city' ? 'cities'
    : entity.type === 'neighborhood' ? 'neighborhoods'
    : 'communities'

  const updates: Record<string, string> = {}
  if (heroImageUrl && heroImageUrl !== entity.hero_image_url) {
    updates.hero_image_url = heroImageUrl
  }
  // Neighborhoods don't have hero_video_url column
  if (entity.type !== 'neighborhood' && heroVideoUrl && heroVideoUrl !== entity.hero_video_url) {
    updates.hero_video_url = heroVideoUrl
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    const { error } = await supabase.from(table).update(updates).eq('id', entity.id)

    if (error) {
      console.error(`  ✗ Failed to update hero URLs: ${error.message}`)
    } else {
      console.log(`  ✓ Updated hero URLs for "${entity.name}" (${entity.type})`)
    }
  }

  // Insert additional photos into page_images
  if (additionalPhotos.length > 0) {
    const pageType = entity.type // 'community', 'city', or 'neighborhood'
    for (const p of additionalPhotos) {
      const { error } = await supabase.from('page_images').insert({
        page_type: pageType,
        page_id: entity.slug,
        image_url: p.url,
        source: 'upload',
      })
      if (error) {
        console.error(`  ✗ Failed to insert page_image: ${error.message}`)
      }
    }
    console.log(`  ✓ Added ${additionalPhotos.length} additional photos to page_images`)
  }

  // For videos on neighborhoods (no hero_video_url column), store in page_images too
  if (entity.type === 'neighborhood' && heroVideoUrl) {
    console.log(`  ℹ Neighborhood videos stored in storage but hero_video_url not available on neighborhoods table`)
  }

  return { photos: allPhotos.length, videos: allVideos.length }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const sourcePath = process.argv[2]

  if (!sourcePath || sourcePath.startsWith('--')) {
    console.error(`
Usage:
  npx tsx scripts/upload-community-media.ts "/path/to/Area Guides"
  npx tsx scripts/upload-community-media.ts "/path/to/Area Guides" --dry-run

Options:
  --dry-run   Show what would happen without uploading anything
`)
    process.exit(1)
  }

  const resolvedPath = path.resolve(sourcePath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Source folder not found: ${resolvedPath}`)
    process.exit(1)
  }

  console.log(`\n📁 Source: ${resolvedPath}`)
  console.log(`${DRY_RUN ? '🧪 DRY RUN MODE — no changes will be made\n' : ''}`)

  // Fetch all existing entities from Supabase
  const entities = await fetchAllEntities()
  const commCount = entities.filter((e) => e.type === 'community').length
  const cityCount = entities.filter((e) => e.type === 'city').length
  const neighCount = entities.filter((e) => e.type === 'neighborhood').length
  console.log(`Found ${commCount} communities, ${cityCount} cities, ${neighCount} neighborhoods in Supabase\n`)

  // Find Bend's city_id for neighborhood creation
  const bendCity = entities.find((e) => e.type === 'city' && e.name.toLowerCase() === 'bend')
  const bendCityId = bendCity?.id || null

  // Ensure storage bucket exists
  if (!DRY_RUN) {
    await ensureBucket()
  }

  // Scan subfolders
  const subfolders = fs.readdirSync(resolvedPath).filter((f) => {
    return fs.statSync(path.join(resolvedPath, f)).isDirectory()
  })

  console.log(`\nFound ${subfolders.length} subfolders to process:\n`)

  let totalPhotos = 0
  let totalVideos = 0
  let matched = 0
  let created = 0
  let skipped = 0

  for (const folder of subfolders) {
    // Skip non-geographic folders
    if (SKIP_FOLDERS.has(folder)) {
      console.log(`⏭ "${folder}" — skipped (not a geographic entity)`)
      skipped++
      continue
    }

    const folderPath = path.join(resolvedPath, folder)

    // Try to match to an existing entity
    let entity = matchEntity(folder, entities)

    if (entity) {
      const typeEmoji = entity.type === 'city' ? '🏙' : entity.type === 'neighborhood' ? '🏘' : '🏡'
      console.log(`${typeEmoji} "${folder}" → ${entity.name} (${entity.type}: ${entity.slug})`)
      matched++
    } else {
      // Auto-create the entity
      const entityType = classifyFolder(folder)
      const typeLabel = entityType === 'city' ? 'city' : entityType === 'neighborhood' ? 'neighborhood' : 'community'

      if (DRY_RUN) {
        console.log(`🆕 "${folder}" → would create as ${typeLabel}`)
        // Create a fake entity for dry run
        entity = {
          id: 'dry-run',
          name: FOLDER_ALIASES[folder] || folder,
          slug: slugify(FOLDER_ALIASES[folder] || folder),
          type: entityType,
          hero_image_url: null,
          hero_video_url: null,
        }
        created++
      } else {
        entity = await createEntity(folder, entityType, bendCityId)
        if (entity) {
          entities.push(entity) // Add to working set so subsequent matches can find it
          created++
        } else {
          console.log(`  ✗ Skipping "${folder}" — could not create record`)
          skipped++
          continue
        }
      }
    }

    const counts = await processFolder(folderPath, folder, entity)
    totalPhotos += counts.photos
    totalVideos += counts.videos
    console.log('')
  }

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Folders scanned:     ${subfolders.length}`)
  console.log(`Matched existing:    ${matched}`)
  console.log(`Auto-created:        ${created}`)
  console.log(`Skipped:             ${skipped}`)
  console.log(`Photos uploaded:     ${totalPhotos}`)
  console.log(`Videos uploaded:     ${totalVideos}`)
  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
