#!/usr/bin/env tsx
/**
 * gate-schema.ts — Zod schema + helpers for gate.json
 *
 * gate.json is the QA artifact that gates every video asset before publish.
 * It is written by preflight.ts + postflight.ts and consumed by:
 *   - automation_skills/automation/qa_pass/SKILL.md (produces it)
 *   - automation_skills/automation/publish/SKILL.md (validates it)
 *   - app/api/social/publish/route.ts (GateArtifacts interface)
 *
 * Schema field count: 38 fields (see GateJsonSchema below).
 * Hard refuse conditions enforced: 26 (per qa_pass SKILL.md).
 *
 * Usage:
 *   import { readGate, writeGate, isGatePassing, GateJson } from './gate-schema'
 */

import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Format enum — matches qa_pass SKILL.md + route.ts gate.formatSkillName
// ---------------------------------------------------------------------------

export const FORMAT_NAMES = [
  'listing_reveal',
  'data_viz_video',
  'market_report_video',
  'news_video',
  'earth_zoom',
  'meme_content',
  'neighborhood_tour',
  'neighborhood_overview',
  'avatar_market_update',
  'weekend-events-video',
  'lifestyle-community',
  'development-showcase',
  'listing-tour-video',
] as const

export type FormatName = (typeof FORMAT_NAMES)[number]

/** Minimum viral scorecard score by format (per VIRAL_GUARDRAILS.md) */
export const FORMAT_MINIMUMS: Record<FormatName, number> = {
  listing_reveal: 85,
  data_viz_video: 80,
  market_report_video: 80,
  news_video: 80,
  earth_zoom: 85,
  meme_content: 75,
  neighborhood_tour: 80,
  neighborhood_overview: 80,
  avatar_market_update: 80,
  'weekend-events-video': 80,
  'lifestyle-community': 80,
  'development-showcase': 80,
  'listing-tour-video': 85,
}

// ---------------------------------------------------------------------------
// Hard refuse condition labels (26 conditions per qa_pass SKILL.md)
// ---------------------------------------------------------------------------

export const HARD_REFUSE_CONDITIONS = [
  'banned_words_clean',               // 1
  'citations_complete',               // 2
  'citations_file_present',           // 3
  'scorecard_file_present',           // 4
  'scorecard_above_minimum',          // 5
  'duration_in_range',                // 6
  'codec_h264',                       // 7
  'fps_30',                           // 8
  'blackdetect_clean',                // 9
  'no_frozen_frames',                 // 10
  'no_black_bars',                    // 11
  'caption_zone_non_overlap',         // 12
  'caption_transitions_smooth',       // 13
  'caption_timing_forced_alignment',  // 14
  'brand_compliance_no_logo_in_viral',// 15
  'end_card_uses_stacked_logo_png',   // 16
  'listing_overlay_spec_correct',     // 17 (listing formats only; null otherwise)
  'audio_non_silent',                 // 18
  'spark_supabase_reconciled',        // 19 (market reports only; null otherwise)
  'ai_disclosure_present',            // 20 (avatar/synthetic media; null otherwise)
  'youtube_synthetic_media_flag',     // 21
  'hook_motion_by_0_4s',              // 22
  'text_by_1_0s',                     // 23
  'register_shift_25pct',             // 24
  'pattern_interrupt_50pct',          // 25
  'kinetic_reveal_final_15pct',       // 26
] as const

export type HardRefuseCondition = (typeof HARD_REFUSE_CONDITIONS)[number]

// ---------------------------------------------------------------------------
// Zod schema — 38 fields total
// ---------------------------------------------------------------------------

export const GateJsonSchema = z.object({
  // ── Required by /api/social/publish (GateArtifacts interface) ─────────────
  /** Path to scorecard.json (VIRAL_GUARDRAILS score, must meet format minimum) */
  scorecardPath: z.string().min(1),
  /** Path to citations.json (every visible figure traced to primary source) */
  citationsPath: z.string().min(1),
  /** Path to qa_report.md (qa_pass output with all hard refuse checks) */
  qaReportPath: z.string().min(1),
  /** Path to postflight.json (ffprobe + blackdetect + frame-visual checks) */
  postflightPath: z.string().nullable(), // null until postflight.ts runs
  /** Path to ANTI_SLOP_MANIFESTO.md the asset was checked against */
  manifestoPath: z.string().min(1),
  /** ISO 8601 timestamp of Matt's explicit chat approval. null until approved. */
  humanApprovedAt: z.string().nullable(), // null until Matt approves
  /** Format skill that produced the asset (e.g. "data_viz_video") */
  formatSkillName: z.string().min(1),
  /** Optional: git SHA or date of the format skill at render time */
  formatSkillVersion: z.string().optional(),

  // ── QA pass fields (per qa_pass SKILL.md) ────────────────────────────────
  gatePassed: z.boolean(),
  gateTimestamp: z.string().min(1), // ISO 8601
  iterationCyclesUsed: z.number().int().min(0).max(2),
  assetPath: z.string().min(1),
  format: z.enum(FORMAT_NAMES),
  formatMinimum: z.number().int().min(70).max(100),
  scorecardTotal: z.number().int().min(0).max(100),
  autoZeroHits: z.array(z.string()),

  // ── Hard refuse conditions (binary, one per qa_pass SKILL.md §Hard refuse) ─
  bannedWordsClean: z.boolean(),
  citationsComplete: z.boolean(),
  durationInRange: z.boolean(),
  blackdetectClean: z.boolean(),
  noFrozenFrames: z.boolean(),
  noBlackBars: z.boolean(),
  captionZoneNonOverlap: z.boolean(),
  brandComplianceOK: z.boolean(),
  audioNonSilent: z.boolean(),
  fileSizeUnder100MB: z.boolean(),

  // ── Reconciliation + compliance flags ─────────────────────────────────────
  /** null if not a market-data format */
  sparkSupabaseReconciled: z.boolean().nullable(),
  /** Max absolute delta % across all reconciled figures. null if not applicable. */
  reconciliationMaxDelta: z.number().min(0).max(1).nullable(),
  /** null if not avatar/synthetic-media content */
  aiDisclosurePresent: z.boolean().nullable(),
  /** true whenever ElevenLabs VO is present — required by YouTube ToS */
  youtubeSyntheticMediaFlag: z.boolean(),

  // ── Hard refuse summary ───────────────────────────────────────────────────
  /** All condition names checked in this run */
  hardRefuseConditionsChecked: z.array(z.string()),
  /** Subset that failed. Empty array means clean pass. */
  hardRefuseConditionsFailed: z.array(z.string()),

  // ── Approval state (frozen by qa_pass; mutated ONLY by publish skill) ─────
  mattApprovalRequired: z.literal(true),
  /** false until publish skill is invoked with Matt's explicit approval */
  approvedByMatt: z.boolean(),
  approvedAt: z.string().nullable(), // ISO 8601 or null

  // ── Cost tracking ──────────────────────────────────────────────────────────
  renderCostUsd: z.number().min(0),
  apiCostUsd: z.number().min(0),
  totalCostUsd: z.number().min(0),
})

export type GateJson = z.infer<typeof GateJsonSchema>

// ---------------------------------------------------------------------------
// Re-export: GateArtifacts shape expected by /api/social/publish
// (must stay in sync with app/api/social/publish/route.ts GateArtifacts)
// ---------------------------------------------------------------------------

export interface GateArtifacts {
  scorecardPath: string
  citationsPath: string
  qaReportPath: string
  postflightPath: string
  manifestoPath: string
  humanApprovedAt: string
  formatSkillName: string
  formatSkillVersion?: string
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

/**
 * Read and validate gate.json from disk. Throws if file is missing or malformed.
 */
export function readGate(gatePath: string): GateJson {
  const abs = path.resolve(gatePath)
  if (!fs.existsSync(abs)) {
    throw new Error(`gate.json not found at ${abs}`)
  }
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Error(`gate.json at ${abs} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const result = GateJsonSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`gate.json schema validation failed:\n${issues}`)
  }
  return result.data
}

/**
 * Validate then write gate.json to disk (pretty-printed, 2-space indent).
 * Always validates before writing — will throw on schema violation.
 */
export function writeGate(gatePath: string, gate: GateJson): void {
  const result = GateJsonSchema.safeParse(gate)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Refusing to write invalid gate.json:\n${issues}`)
  }
  const abs = path.resolve(gatePath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, JSON.stringify(result.data, null, 2) + '\n', 'utf8')
}

// ---------------------------------------------------------------------------
// Gate evaluation
// ---------------------------------------------------------------------------

/**
 * Returns { ok: true } if the gate is fully passing, or { ok: false, reason }
 * for the first blocking condition. Checks ALL hard refuse conditions.
 *
 * This mirrors the logic in qa_pass SKILL.md §Hard refuse conditions.
 */
export function isGatePassing(gate: GateJson): { ok: true } | { ok: false; reason: string } {
  if (!gate.gatePassed) {
    return { ok: false, reason: 'gate_passed is false — QA explicitly marked this as a non-ship' }
  }

  // Hard refuse binary checks
  if (!gate.bannedWordsClean) {
    return { ok: false, reason: 'Banned word found in captions, VO script, or on-screen text (ANTI_SLOP_MANIFESTO Rule 1)' }
  }
  if (!gate.citationsComplete) {
    return { ok: false, reason: 'citations.json missing or contains figures without a primary-source trace (CLAUDE.md §0)' }
  }
  if (!gate.durationInRange) {
    return { ok: false, reason: 'Video duration is outside the 30–60s window (CLAUDE.md §Video Build Hard Rules)' }
  }
  if (!gate.blackdetectClean) {
    return { ok: false, reason: 'ffmpeg blackdetect returned ≥1 black sequence (pix_th=0.05 — any black = non-ship)' }
  }
  if (!gate.noFrozenFrames) {
    return { ok: false, reason: 'Frozen frame detected at a beat boundary (< 0.2% pixel change across 3+ consecutive frames)' }
  }
  if (!gate.noBlackBars) {
    return { ok: false, reason: 'Black bars detected at transitions (letterbox/pillarbox artifacts > 2 px)' }
  }
  if (!gate.captionZoneNonOverlap) {
    return { ok: false, reason: 'Caption zone (y 1480–1720, x 90–990) overlaps another rendered component in ≥1 frame' }
  }
  if (!gate.brandComplianceOK) {
    return { ok: false, reason: 'Brand compliance failed: logo/Ryan Realty/phone visible outside permitted zones, or end card uses text-only attribution' }
  }
  if (!gate.audioNonSilent) {
    return { ok: false, reason: 'Audio is silent or below threshold (RMS < −40 dBFS for > 1s during VO passages)' }
  }
  if (!gate.fileSizeUnder100MB) {
    return { ok: false, reason: 'File size exceeds 100 MB (CLAUDE.md §Video Build Hard Rules)' }
  }

  // Scorecard auto-zero hits block regardless of total score
  if (gate.autoZeroHits.length > 0) {
    return {
      ok: false,
      reason: `scorecard.json contains ${gate.autoZeroHits.length} auto-zero hit(s): ${gate.autoZeroHits.join(', ')}`,
    }
  }

  // Scorecard total must meet format minimum
  if (gate.scorecardTotal < gate.formatMinimum) {
    return {
      ok: false,
      reason: `Viral scorecard ${gate.scorecardTotal}/100 is below format minimum ${gate.formatMinimum} for ${gate.format}`,
    }
  }

  // Spark × Supabase reconciliation (market formats)
  if (gate.sparkSupabaseReconciled === false) {
    const delta = gate.reconciliationMaxDelta !== null
      ? ` (max delta ${(gate.reconciliationMaxDelta * 100).toFixed(2)}%)`
      : ''
    return {
      ok: false,
      reason: `Spark × Supabase reconciliation failed${delta} — any |delta| > 1% is a hard stop (CLAUDE.md §0)`,
    }
  }

  // AI disclosure (avatar/synthetic media)
  if (gate.aiDisclosurePresent === false) {
    return {
      ok: false,
      reason: 'AI disclosure pill absent for avatar/synthetic-media content (SB 942 California compliance; qa_pass SKILL.md condition 20)',
    }
  }

  // Hard refuse conditions listed as failed
  if (gate.hardRefuseConditionsFailed.length > 0) {
    return {
      ok: false,
      reason: `${gate.hardRefuseConditionsFailed.length} hard refuse condition(s) failed: ${gate.hardRefuseConditionsFailed.join(', ')}`,
    }
  }

  // postflightPath must be populated (postflight ran)
  if (!gate.postflightPath) {
    return { ok: false, reason: 'postflightPath is null — postflight.ts has not run yet (run gate:postflight first)' }
  }

  return { ok: true }
}


