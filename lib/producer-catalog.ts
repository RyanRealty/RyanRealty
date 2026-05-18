/**
 * Producer Catalog. Parses every SKILL.md under the skill directories and
 * returns a normalized list of ProducerRecord objects for the admin catalog UI.
 *
 * Frontmatter is parsed with a lightweight hand-rolled YAML parser so we avoid
 * a gray-matter dependency (gray-matter is NOT in package.json). It handles
 * the simple scalar + array frontmatter shapes used by every producer SKILL.md.
 */

import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProducerStatus = 'locked' | 'draft' | 'needs_tool' | 'needs_oauth'

export type ProducerSection = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'other'

export interface ProducerRecord {
  slug: string
  name: string
  description: string
  section: ProducerSection
  sectionLabel: string
  category: string
  actionTypes: string[]
  outputType: string
  targetPlatforms: string[]
  requiredInputs: string[]
  status: ProducerStatus
  exampleOutputs: string[]
  thumbnailUri: string
  skillPath: string
  skillContent: string
}

// ---------------------------------------------------------------------------
// Section map (Registry.md A-I)
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<ProducerSection, string> = {
  A: 'Content Orchestrators',
  B: 'Content Producers',
  C: 'Site Producers',
  D: 'Operational Producers',
  E: 'Communications Producers',
  F: 'Analysis Producers',
  G: 'Capabilities',
  H: 'Brain Components',
  I: 'Automation Pipeline',
  other: 'Other',
}

// Map known paths to Registry sections
function inferSection(skillPath: string): ProducerSection {
  const p = skillPath.toLowerCase()
  if (p.includes('content_engine') || p.includes('monthly-market-report-orchestrator') ||
      p.includes('list-kit') || p.includes('listing_launch')) return 'A'
  if (p.includes('video_production_skills') || p.includes('social_media_skills/blog') ||
      p.includes('facebook-lead-gen-ad') || p.includes('flyer') || p.includes('instagram') ||
      p.includes('cma') || p.includes('meme') || p.includes('ig-single') ||
      p.includes('coming-soon') || p.includes('tiktok') || p.includes('youtube') ||
      p.includes('open-house') || p.includes('under-contract') || p.includes('sold-deal') ||
      p.includes('linkedin-document') || p.includes('agent-coop') || p.includes('postcard') ||
      p.includes('social_media_skills')) return 'B'
  if (p.includes('site-edit') || p.includes('site-page') || p.includes('site-performance') ||
      p.includes('site-property') || p.includes('site-matterport') ||
      p.includes('producers/site')) return 'C'
  if (p.includes('ops-meta') || p.includes('ops-fub') || p.includes('ops-email') ||
      p.includes('ops-reputation') || p.includes('ops-fb') || p.includes('ops-manychat') ||
      p.includes('producers/ops')) return 'D'
  if (p.includes('comms-matt') || p.includes('comms-client') ||
      p.includes('producers/comms')) return 'E'
  if (p.includes('analyze-')) return 'F'
  if (p.includes('audio_sync') || p.includes('brand_assets') || p.includes('cinematic') ||
      p.includes('content_pipeline') || p.includes('depth_parallax') || p.includes('depthflow') ||
      p.includes('elevenlabs') || p.includes('gaussian') || p.includes('asset-library') ||
      p.includes('media-sourcing') || p.includes('ai_platforms') || p.includes('publisher') ||
      p.includes('quality_gate') || p.includes('platform-best-practices')) return 'G'
  if (p.includes('weekly-cycle') || p.includes('diagnose') || p.includes('generate-briefs')) return 'H'
  if (p.includes('automation_skills')) return 'I'
  return 'other'
}

// ---------------------------------------------------------------------------
// Simple frontmatter parser (handles --- delimited YAML with scalars + lists)
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): {
  data: Record<string, unknown>
  body: string
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!fmMatch) return { data: {}, body: content }

  const yamlBlock = fmMatch[1]
  const body = fmMatch[2] ?? ''
  const data: Record<string, unknown> = {}

  // Parse line by line
  const lines = yamlBlock.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Scalar: key: value
    const scalarMatch = line.match(/^(\w[\w_-]*):\s*(.+)$/)
    if (scalarMatch) {
      const key = scalarMatch[1]
      const val = scalarMatch[2].trim()
      // Handle inline array [a, b]
      if (val.startsWith('[') && val.endsWith(']')) {
        data[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
      } else {
        data[key] = val.replace(/^['"]|['"]$/g, '')
      }
      i++
      continue
    }
    // Block list: key:\n  - item
    const listKeyMatch = line.match(/^(\w[\w_-]*):\s*$/)
    if (listKeyMatch) {
      const key = listKeyMatch[1]
      const items: string[] = []
      i++
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, '')
        items.push(item)
        i++
      }
      data[key] = items
      continue
    }
    i++
  }

  return { data, body }
}

// ---------------------------------------------------------------------------
// Skill scan roots
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..')

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'marketing_brain_skills', 'producers'),
  path.join(REPO_ROOT, 'social_media_skills'),
  path.join(REPO_ROOT, 'video_production_skills'),
  path.join(REPO_ROOT, 'automation_skills'),
]

function findSkillFiles(dir: string, depth = 0): string[] {
  if (depth > 4) return []
  let results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(findSkillFiles(full, depth + 1))
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      results.push(full)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Parse a single SKILL.md into a ProducerRecord
// ---------------------------------------------------------------------------

const PLACEHOLDER_THUMBNAIL = '/admin/producers/_placeholder.png'

function skillPathToSlug(skillPath: string): string {
  // e.g. /repo/video_production_skills/news-video/SKILL.md -> news-video
  const dir = path.dirname(skillPath)
  return path.basename(dir)
}

function resolveStatus(data: Record<string, unknown>): ProducerStatus {
  const raw = String(data['status'] ?? '').toLowerCase()
  if (raw === 'draft') return 'draft'
  if (raw === 'needs_tool' || raw === 'needs-tool') return 'needs_tool'
  if (raw === 'needs_oauth' || raw === 'needs-oauth') return 'needs_oauth'
  return 'locked'
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

function parseSkillFile(skillPath: string): ProducerRecord | null {
  let raw: string
  try {
    raw = fs.readFileSync(skillPath, 'utf-8')
  } catch {
    return null
  }

  const { data, body } = parseFrontmatter(raw)

  const slug = skillPathToSlug(skillPath)
  const name = String(data['name'] ?? data['producer_name'] ?? slug)
  const description = String(data['description'] ?? data['summary'] ?? 'No description.')
  const actionTypes = toStringArray(data['action_types'] ?? data['action_type'])
  const outputType = String(data['output_type'] ?? data['output'] ?? '')
  const targetPlatforms = toStringArray(data['target_platforms'] ?? data['platforms'])
  const requiredInputs = toStringArray(data['required_inputs'] ?? data['inputs'])
  const exampleOutputs = toStringArray(data['example_outputs'] ?? data['examples'])
  const thumbnailUri = String(data['thumbnail_uri'] ?? data['thumbnail'] ?? '') || PLACEHOLDER_THUMBNAIL
  const section = inferSection(skillPath)
  const category = String(data['category'] ?? SECTION_LABELS[section])
  const status = resolveStatus(data)

  return {
    slug,
    name,
    description,
    section,
    sectionLabel: SECTION_LABELS[section],
    category,
    actionTypes,
    outputType,
    targetPlatforms,
    requiredInputs,
    status,
    exampleOutputs,
    thumbnailUri: exampleOutputs.length > 0 ? (exampleOutputs[0]) : thumbnailUri,
    skillPath,
    skillContent: body,
  }
}

// ---------------------------------------------------------------------------
// Cache (module-level, refreshed per cold start)
// ---------------------------------------------------------------------------

let _cache: ProducerRecord[] | null = null

const SECTION_ORDER: ProducerSection[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'other']

export function getAllProducers(): ProducerRecord[] {
  if (_cache) return _cache

  const skillFiles: string[] = []
  for (const root of SCAN_ROOTS) {
    skillFiles.push(...findSkillFiles(root))
  }

  const records: ProducerRecord[] = []
  const seen = new Set<string>()
  for (const f of skillFiles) {
    const rec = parseSkillFile(f)
    if (!rec) continue
    if (seen.has(rec.slug)) {
      // Disambiguate with parent dir
      const parent = path.basename(path.dirname(path.dirname(f)))
      rec.slug = `${parent}--${rec.slug}`
    }
    seen.add(rec.slug)
    records.push(rec)
  }

  // Sort by section order, then alphabetically within section
  records.sort((a, b) => {
    const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    if (si !== 0) return si
    return a.name.localeCompare(b.name)
  })

  _cache = records
  return records
}

export function getProducerBySlug(slug: string): ProducerRecord | undefined {
  return getAllProducers().find((p) => p.slug === slug)
}

export function getUniqueCategories(): string[] {
  return [...new Set(getAllProducers().map((p) => p.sectionLabel))]
}

export function getUniqueStatuses(): ProducerStatus[] {
  return [...new Set(getAllProducers().map((p) => p.status))]
}

export function getUniqueOutputTypes(): string[] {
  return [...new Set(getAllProducers().map((p) => p.outputType).filter(Boolean))]
}

export function getUniquePlatforms(): string[] {
  const all = getAllProducers().flatMap((p) => p.targetPlatforms)
  return [...new Set(all)]
}
