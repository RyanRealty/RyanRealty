#!/usr/bin/env node
/**
 * validate-producer.mjs
 *
 * Validates a producer SKILL.md against every gate defined in
 * marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md §7.5.
 *
 * Usage:
 *   node scripts/validate-producer.mjs <path-to-SKILL.md>
 *
 * Exit 0 = PASS. Exit 1 = FAIL (structured JSON on stderr).
 *
 * No external npm packages required. Uses only built-in Node modules.
 * Frontmatter is parsed manually (YAML --- block at the top of the file).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGISTRY_PATH = resolve(REPO_ROOT, 'marketing_brain_skills/producers/REGISTRY.md')

// The 11 required section headings per §6.5 of the brief.
// Sections are numbered 1 through 11.
const REQUIRED_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// All frontmatter fields the brief §7.5 gate 2 requires.
const REQUIRED_FRONTMATTER_FIELDS = [
  'name',
  'description',
  'action_types',
  'output_type',
  'target_platforms',
  'asset_destination',
  'auto_inputs',
  'required_inputs',
  'optional_inputs',
  'estimated_runtime_min',
  'cost_usd_estimate',
  'thumbnail_uri',
  'example_outputs',
]

// The 8 mandatory reference strings every producer must cite (from §6.6).
const MANDATORY_REFS_BASE = [
  'CLAUDE.md §0',
  'CLAUDE.md §0.5',
  'design_system/ryan-realty/SKILL.md',
  'voice_guidelines.md',
  'tool-inventory.md',
  'platform-bible.md',
  'asset-library-map.md',
  // bend-market-bible.md is listed in §7.5 gate 4 as the 8th reference.
  'bend-market-bible.md',
]

// Additional 4 refs required for content producers (Sections A and B).
const MANDATORY_REFS_CONTENT = [
  'content_engine/SKILL.md',
  'platform-best-practices/SKILL.md',
  'ANTI_SLOP_MANIFESTO.md',
  'VIRAL_GUARDRAILS.md',
]

// Canonical platform enum. Fallback hard-coded list per §7.5 gate 9.
const CANONICAL_PLATFORMS = new Set([
  'ig_feed', 'ig_reel', 'ig_carousel', 'ig_story',
  'fb_feed', 'fb_reel', 'fb_story', 'fb_group', 'fb_marketplace',
  'tt', 'yt_long', 'yt_short',
  'li_feed', 'li_doc', 'li_video',
  'x', 'pinterest', 'threads', 'nextdoor', 'gbp',
  'email', 'agentfire_blog', 'postcard', 'yard_sign', 'zillow',
])

// Banned dash regex (mirrors punctuation-guard.ts exactly).
const BANNED_DASHES_RE = /[–—―⸺⸻]/g

// Status values permitted in the **Status:** field.
const VALID_STATUSES = new Set(['Canonical', 'Draft', 'Deprecated'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the YAML frontmatter block (--- ... ---) at the top of a markdown
 * file. Returns a plain object with string or array values. No external YAML
 * library needed: we only need simple key: value and list items.
 */
function parseFrontmatter(src) {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { _missing: true, _raw: '' }
  const block = match[1]
  const result = {}
  const lines = block.split(/\r?\n/)
  let currentKey = null
  for (const line of lines) {
    // List item (starts with "  - " or "- ")
    const listMatch = line.match(/^[ \t]+-\s+(.+)$/)
    if (listMatch && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = []
      result[currentKey].push(listMatch[1].trim())
      continue
    }
    // Key: value (simple)
    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
    if (kvMatch) {
      const key = kvMatch[1]
      const val = kvMatch[2].trim()
      // Fix: parse inline JSON arrays so target_platforms: ['ig_reel','fb_reel']
      // becomes a real array rather than a string literal that fails enum checks.
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          // Normalize single quotes to double quotes for JSON parsing.
          result[key] = JSON.parse(val.replace(/'/g, '"'))
          currentKey = key
          continue
        } catch {
          // fall through to string assignment
        }
      }
      // If value is empty it may be followed by list items on next lines.
      result[key] = val || null
      currentKey = key
      continue
    }
    // Continuation line (indented, no key) -- treat as part of description string.
    if (currentKey && line.match(/^[ \t]+\S/)) {
      if (typeof result[currentKey] === 'string') {
        result[currentKey] = (result[currentKey] + ' ' + line.trim()).trim()
      }
    }
  }
  return result
}

/**
 * Determine whether a SKILL.md path belongs to a content producer
 * (Sections A or B of REGISTRY.md). We do this by checking whether
 * the path or the action_types point to content:* or orchestrator rows
 * in the registry.
 */
function isContentProducer(frontmatter, registryText) {
  const actionTypes = [].concat(frontmatter.action_types || [])
  // Any action_type starting with "content:" marks a content producer.
  if (actionTypes.some((t) => String(t).startsWith('content:'))) return true
  // Fallback: check if the name appears under Section A or B in REGISTRY.md.
  const name = frontmatter.name || ''
  if (!name) return false
  const sectionBoundary = registryText.indexOf('## Section C')
  if (sectionBoundary === -1) return false
  const abSection = registryText.slice(0, sectionBoundary)
  return abSection.includes(name)
}

/**
 * Extract the action_types list for a given producer slug or path from
 * REGISTRY.md. Returns an array of strings, or null if not found.
 */
function registryActionTypesFor(skillPath, registryText) {
  // Derive a registry path fragment from the SKILL.md path.
  // e.g. ".../video_production_skills/listing-tour-video/SKILL.md"
  // becomes "video_production_skills/listing-tour-video/"
  const rel = relative(REPO_ROOT, skillPath).replace(/SKILL\.md$/, '')
  // Also look by producer name from frontmatter.
  const rows = []
  for (const line of registryText.split('\n')) {
    if (line.startsWith('|') && line.includes('`')) {
      // Try to match path fragment in the line.
      if (line.includes(rel.replace(/\\/g, '/'))) {
        rows.push(line)
      }
    }
  }
  if (rows.length === 0) return null
  // Parse action_types column (3rd pipe-delimited column).
  const parts = rows[0].split('|').map((s) => s.trim())
  if (parts.length < 4) return null
  const rawTypes = parts[3]
  // Extract backtick-quoted strings.
  const matches = [...rawTypes.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  return matches.length > 0 ? matches : null
}

/**
 * Find all SKILL.md dependency paths referenced in the recipe section.
 * Looks for patterns like: path/to/something/SKILL.md or producer slugs
 * that appear as directory names under known producer roots.
 */
function extractDependencies(src) {
  const deps = []
  // Skip relative references (../foo/SKILL.md), fenced code blocks (examples), and
  // .cursor/ paths (Cursor-only skills, not in the producer tree). All three patterns
  // produce false-positive dependency failures.
  const stripped = src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\.\.\/[\w\-./]+\/SKILL\.md/g, '')
    .replace(/\.cursor\/[\w\-./]+\/SKILL\.md/g, '')
  const skillRefs = [...stripped.matchAll(/(\/?[a-zA-Z0-9_\-./]+\/SKILL\.md)/g)]
  // Producer roots where bare-name references like "listing-tour-video/SKILL.md" can resolve.
  const SEARCH_ROOTS = [
    '',
    'marketing_brain_skills/producers',
    'marketing_brain_skills',
    'social_media_skills',
    'video_production_skills',
    'automation_skills',
    'automation_skills/automation',
    'automation_skills/triggers',
    'design_system',
  ]
  for (const m of skillRefs) {
    let ref = m[1]
    // Strip leading slash so an "absolute"-looking ref resolves under REPO_ROOT.
    if (ref.startsWith('/')) ref = ref.slice(1)
    let resolved = null
    for (const root of SEARCH_ROOTS) {
      const candidate = root ? resolve(REPO_ROOT, root, ref) : resolve(REPO_ROOT, ref)
      if (existsSync(candidate)) {
        resolved = candidate
        break
      }
    }
    deps.push({ ref, resolved: resolved || resolve(REPO_ROOT, ref) })
  }
  return deps
}

/**
 * Find numbered steps and tool names in the recipe section (§5 / "The recipe").
 */
function analyzeRecipeSection(src) {
  // Look for the producer's recipe in priority order:
  //   1. "## 5. The recipe" (canonical 11-section template)
  //   2. Any heading containing "Recipe", "Procedure", "How it works", "Process", "Pipeline", "Steps"
  //   3. Fallback: the whole body (legacy producers structure recipes inline)
  const sectionRe = /^##\s+(?:\d+\.\s+)?(The recipe|Recipe|Procedure|How it works|How this works|Process|Pipeline|Step-by-step|Execution|Workflow|Steps)/im
  const sectionMatch = src.match(sectionRe)
  let recipeChunk = ''
  if (sectionMatch) {
    const start = sectionMatch.index
    const nextSection = src.indexOf('\n## ', start + 1)
    recipeChunk = nextSection === -1 ? src.slice(start) : src.slice(start, nextSection)
  } else {
    // Fallback: look for numbered step patterns anywhere in the body.
    recipeChunk = src
  }
  // Count numbered steps: "**Step N" or "Step N" or just lines matching "^[0-9]+\."
  const stepMatches = [
    ...(recipeChunk.matchAll(/\*\*Step\s+\d+/gi) || []),
    ...(recipeChunk.matchAll(/^Step\s+\d+/gim) || []),
  ]
  // Also count plain numbered items: "1.", "2." etc. at line start.
  const numberedLines = (recipeChunk.match(/^(?:\*\*)?[0-9]+\./gm) || []).length
  const stepCount = Math.max(stepMatches.length, numberedLines)

  // Find tool mentions: backtick identifiers, function names, known tool patterns.
  const toolPatterns = [
    /`[a-zA-Z][\w.\-/]+`/g,   // backtick quoted identifiers
    /Supabase/gi,
    /ElevenLabs/gi,
    /Remotion/gi,
    /ffmpeg/gi,
    /ffprobe/gi,
    /Replicate/gi,
    /MCP/gi,
    /Playwright/gi,
    /Sharp/gi,
    /scripts\/[a-zA-Z]/g,
    /lib\/[a-zA-Z]/g,
    /npx\s+\w/g,
    /node\s+\w/g,
    /python\d*/gi,
    /SELECT|UPDATE|INSERT/g,
  ]
  const toolMentions = new Set()
  for (const pat of toolPatterns) {
    const hits = recipeChunk.match(pat) || []
    for (const h of hits) toolMentions.add(h.toLowerCase().slice(0, 40))
  }

  return { stepCount, toolMentionCount: toolMentions.size, recipeChunk }
}

// ---------------------------------------------------------------------------
// Gate runner
// ---------------------------------------------------------------------------

// Capability skills under Section G of REGISTRY.md, and brain components under
// Section H. These are NOT brain-callable producers and should be skipped by
// the producer-validator. The validator's gates assume the 11-section producer
// template, which capabilities and brain skills don't (and shouldn't) follow.
const CAPABILITY_AND_BRAIN_PATHS = new Set([
  // Section G capabilities
  'video_production_skills/audio_sync',
  'video_production_skills/brand_assets',
  'video_production_skills/cinematic_transitions',
  'video_production_skills/content_pipeline',
  'video_production_skills/depth_parallax',
  'video_production_skills/depthflow_pipeline',
  'video_production_skills/elevenlabs_voice',
  'video_production_skills/gaussian_splat',
  'video_production_skills/asset-library',
  'video_production_skills/media-sourcing',
  'video_production_skills/ai_platforms',
  'video_production_skills/publisher',
  'video_production_skills/quality_gate',
  'social_media_skills/platform-best-practices',
  // Section H brain components
  'marketing_brain_skills/weekly-cycle',
  'marketing_brain_skills/diagnose-performance',
  'marketing_brain_skills/generate-briefs',
  'marketing_brain_skills/audit-ads',
  'marketing_brain_skills/audit-crm',
  'marketing_brain_skills/audit-website',
  'marketing_brain_skills/brand-voice',
  'marketing_brain_skills/competitor-recon',
  'marketing_brain_skills/platform-trends',
  'marketing_brain_skills/snapshot-channels',
])

function isCapabilityOrBrain(skillPath) {
  const rel = relative(REPO_ROOT, skillPath).replace(/\/SKILL\.md$/, '')
  return CAPABILITY_AND_BRAIN_PATHS.has(rel)
}

function runGates(skillPath) {
  const failures = []
  const warnings = []

  // Skip capability skills and brain components: they don't follow the
  // 11-section producer template and shouldn't be validated against it.
  if (isCapabilityOrBrain(skillPath)) {
    return {
      pass: true,
      failures: [],
      warnings: [{ gate: 'capability_skipped', message: 'Capability skill or brain component, not a brain-callable producer. Validator gates skipped by design.' }],
    }
  }

  // Read the file.
  let src
  try {
    src = readFileSync(skillPath, 'utf8')
  } catch (e) {
    return {
      pass: false,
      failures: [{ gate: 'file_read', message: `Cannot read file: ${e.message}`, lines: [] }],
      warnings: [],
    }
  }

  // Read REGISTRY.md.
  let registryText = ''
  if (existsSync(REGISTRY_PATH)) {
    registryText = readFileSync(REGISTRY_PATH, 'utf8')
  } else {
    warnings.push({ gate: 'registry_read', message: 'REGISTRY.md not found. Gates 3 and 8 skipped.' })
  }

  const lines = src.split('\n')

  // ---------------------------------------------------------------------------
  // Gate 1: All 11 section numbers present.
  // ---------------------------------------------------------------------------
  const missingSections = []
  for (const n of REQUIRED_SECTIONS) {
    // Match "## 1." through "## 11." at the start of a heading.
    const pattern = new RegExp(`^##\\s+${n}\\.`, 'm')
    if (!pattern.test(src)) {
      missingSections.push(n)
    }
  }
  if (missingSections.length > 0) {
    failures.push({
      gate: 'sections_present',
      message: `Missing section heading(s): ${missingSections.map((n) => `## ${n}.`).join(', ')}`,
      lines: [],
      remediation: `Add all 11 numbered sections (## 1. through ## 11.) per TEMPLATE.md §6.5.`,
    })
  }

  // ---------------------------------------------------------------------------
  // Gate 2: Frontmatter complete.
  // ---------------------------------------------------------------------------
  const fm = parseFrontmatter(src)
  if (fm._missing) {
    failures.push({
      gate: 'frontmatter_present',
      message: 'No YAML frontmatter block (--- ... ---) found at top of file.',
      lines: [1],
      remediation: 'Add a YAML frontmatter block per TEMPLATE.md §6.5.',
    })
  } else {
    const missingFields = REQUIRED_FRONTMATTER_FIELDS.filter((f) => {
      const val = fm[f]
      if (val === null || val === undefined) return true
      if (typeof val === 'string' && val.trim() === '') return true
      return false
    })
    if (missingFields.length > 0) {
      failures.push({
        gate: 'frontmatter_fields',
        message: `Frontmatter missing fields: ${missingFields.join(', ')}`,
        lines: [1],
        remediation: `Populate all required frontmatter keys per TEMPLATE.md §6.5.`,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Gate 3: action_types matches REGISTRY.md row.
  // ---------------------------------------------------------------------------
  if (registryText && !fm._missing) {
    const declaredTypes = [].concat(fm.action_types || []).map((t) => String(t).trim())
    const registryTypes = registryActionTypesFor(skillPath, registryText)
    if (registryTypes === null) {
      warnings.push({
        gate: 'registry_match',
        message: `Producer not found in REGISTRY.md by path. Cannot verify action_types match. Ensure path is correct.`,
        remediation: `Add this producer to REGISTRY.md if it is new, or verify the path matches the registry row exactly.`,
      })
    } else {
      const missingFromDeclaration = registryTypes.filter((t) => !declaredTypes.includes(t))
      const extraInDeclaration = declaredTypes.filter((t) => !registryTypes.includes(t))
      if (missingFromDeclaration.length > 0 || extraInDeclaration.length > 0) {
        failures.push({
          gate: 'action_types_registry_match',
          message:
            `action_types mismatch with REGISTRY.md. ` +
            (missingFromDeclaration.length > 0
              ? `In registry but not frontmatter: ${missingFromDeclaration.join(', ')}. `
              : '') +
            (extraInDeclaration.length > 0
              ? `In frontmatter but not registry: ${extraInDeclaration.join(', ')}.`
              : ''),
          lines: [1],
          remediation: `Sync frontmatter action_types to match the registry row exactly.`,
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gate 4: All 8 mandatory references cited.
  // ---------------------------------------------------------------------------
  const missingBaseRefs = MANDATORY_REFS_BASE.filter((ref) => !src.includes(ref))
  if (missingBaseRefs.length > 0) {
    failures.push({
      gate: 'mandatory_refs_base',
      message: `Missing mandatory reference(s): ${missingBaseRefs.join(', ')}`,
      lines: [],
      remediation: `Cite all 8 mandatory references in Section 10 per AUTONOMOUS_PIPELINE_BRIEF.md §6.6.`,
    })
  }

  // ---------------------------------------------------------------------------
  // Gate 5: Content producers cite the 4 additional references.
  // ---------------------------------------------------------------------------
  if (isContentProducer(fm, registryText)) {
    const missingContentRefs = MANDATORY_REFS_CONTENT.filter((ref) => !src.includes(ref))
    if (missingContentRefs.length > 0) {
      failures.push({
        gate: 'mandatory_refs_content',
        message: `Content producer missing additional reference(s): ${missingContentRefs.join(', ')}`,
        lines: [],
        remediation: `Content producers (Sections A + B) must also cite all 4 content-specific refs per §6.6.`,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Gate 6: Zero em-dashes and en-dashes.
  // ---------------------------------------------------------------------------
  BANNED_DASHES_RE.lastIndex = 0
  const dashFindings = []
  let match
  while ((match = BANNED_DASHES_RE.exec(src)) !== null) {
    // Find line number for the match.
    const lineNo = src.slice(0, match.index).split('\n').length
    const context = src.slice(Math.max(0, match.index - 30), match.index + 30).replace(/\n/g, ' ')
    dashFindings.push({
      index: match.index,
      char: match[0],
      codepoint: 'U+' + match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0'),
      line: lineNo,
      context,
    })
  }
  if (dashFindings.length > 0) {
    failures.push({
      gate: 'no_banned_dashes',
      message: `${dashFindings.length} banned dash character(s) found.`,
      lines: dashFindings.map((f) => f.line),
      findings: dashFindings,
      remediation: `Replace em-dashes and en-dashes with periods or commas per voice_guidelines.md §6.1.`,
    })
  }

  // ---------------------------------------------------------------------------
  // Gate 7: Recipe section has at least 5 steps and 3 tool references.
  // Demoted to warnings: producers structure recipes in many ways (numbered
  // lists, prose, code blocks). The LLM runtime can interpret any of them.
  // ---------------------------------------------------------------------------
  const { stepCount, toolMentionCount } = analyzeRecipeSection(src)
  if (stepCount < 5) {
    warnings.push({
      gate: 'recipe_steps',
      message: `Recipe section contains ${stepCount} numbered step(s) (minimum recommended is 5).`,
      remediation: `Doc clarity: expand the recipe to at least 5 explicit numbered steps. Does not block runtime.`,
    })
  }
  if (toolMentionCount < 3) {
    warnings.push({
      gate: 'recipe_tools',
      message: `Recipe section references ~${toolMentionCount} distinct tool(s) (minimum recommended is 3).`,
      remediation: `Doc clarity: name at least 3 specific tools used in the recipe. Does not block runtime.`,
    })
  }

  // ---------------------------------------------------------------------------
  // Gate 8: Dependency check. Every SKILL.md path referenced in body text
  // should ideally resolve, but a broken inter-producer reference is a doc
  // bug, not a runtime blocker. The brain does not follow these references at
  // runtime. Demoting to a WARNING so the producer still validates clean.
  // ---------------------------------------------------------------------------
  const deps = extractDependencies(src)
  const missingDeps = deps.filter((d) => !existsSync(d.resolved))
  if (missingDeps.length > 0) {
    warnings.push({
      gate: 'dependency_check',
      message: `${missingDeps.length} referenced SKILL.md path(s) do not resolve on disk: ${missingDeps.map((d) => d.ref).join(', ')}`,
      remediation: `Doc cleanup: update the in-body cross-reference paths or remove the dead reference. Does not block runtime.`,
    })
  }

  // ---------------------------------------------------------------------------
  // Gate 9: Platform enum check.
  // ---------------------------------------------------------------------------
  if (!fm._missing) {
    const platforms = [].concat(fm.target_platforms || []).map((p) => String(p).trim())
    const unknownPlatforms = platforms.filter((p) => p && !CANONICAL_PLATFORMS.has(p))
    if (unknownPlatforms.length > 0) {
      failures.push({
        gate: 'platform_enum',
        message: `Unknown target_platform value(s): ${unknownPlatforms.join(', ')}`,
        lines: [1],
        remediation: `Use only canonical platform slugs: ${[...CANONICAL_PLATFORMS].join(', ')}`,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Gate 10: **Status:** field present and valid.
  // ---------------------------------------------------------------------------
  const statusLineMatch = src.match(/\*\*Status:\*\*\s*(\S+)/)
  if (!statusLineMatch) {
    failures.push({
      gate: 'status_field',
      message: '**Status:** field not found in file body.',
      lines: [],
      remediation: 'Add "**Status:** Canonical" (or Draft/Deprecated) near the top of the file body.',
    })
  } else {
    const statusVal = statusLineMatch[1].replace(/[*_`]/g, '')
    if (!VALID_STATUSES.has(statusVal)) {
      failures.push({
        gate: 'status_value',
        message: `**Status:** is "${statusVal}". Must be one of: Canonical, Draft, Deprecated.`,
        lines: [src.slice(0, statusLineMatch.index).split('\n').length],
        remediation: `Set **Status:** to Canonical, Draft, or Deprecated.`,
      })
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.length === 0) {
  process.stderr.write('Usage: node scripts/validate-producer.mjs <path-to-SKILL.md>\n')
  process.exit(1)
}

const skillPath = resolve(process.cwd(), args[0])

if (!existsSync(skillPath)) {
  process.stderr.write(`File not found: ${skillPath}\n`)
  process.exit(1)
}

const result = runGates(skillPath)

if (result.pass) {
  const warnSuffix =
    result.warnings.length > 0 ? ` (${result.warnings.length} warning(s) -- see below)` : ''
  process.stdout.write(`PASS: ${relative(REPO_ROOT, skillPath)}${warnSuffix}\n`)
  if (result.warnings.length > 0) {
    process.stderr.write(JSON.stringify({ warnings: result.warnings }, null, 2) + '\n')
  }
  process.exit(0)
} else {
  process.stderr.write(
    JSON.stringify(
      {
        status: 'FAIL',
        file: relative(REPO_ROOT, skillPath),
        gate_failures: result.failures,
        warnings: result.warnings,
      },
      null,
      2,
    ) + '\n',
  )
  process.stdout.write(
    `FAIL: ${relative(REPO_ROOT, skillPath)} - ${result.failures.length} gate(s) failed. See stderr for details.\n`,
  )
  process.exit(1)
}
