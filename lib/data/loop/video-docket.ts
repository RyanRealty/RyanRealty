/**
 * CAP-017 park-or-rebuild docket. Packet + /admin/loop read this file.
 * reachability: collectCompanyScoreboardSignals, /admin/loop, scripts/check-video-docket.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const VIDEO_DOCKET_PATH = 'docs/plans/ENTERPRISE_MAP/video-decision-docket.json'
export const VIDEO_DOCKET_SOURCE =
  'docs/plans/ENTERPRISE_MAP/video-decision-docket.json via readVideoDecisionDocket'

export type VideoDecisionStatus = 'pending' | 'park' | 'rebuild'

export type VideoDocketOption = {
  label: string
  incrementalVendorUsd?: number
  elevenLabsTurboUsdPer1kChars?: number
  producerCapPerRowUsd?: number
  producerCapPerRunUsd?: number
  brainPath: string
  sources: string[]
}

export type VideoDecisionDocket = {
  status: 'ok' | 'unreadable'
  recordedAt: string | null
  source: string
  capability: string
  versionGap: string
  mattMove: string
  decision: {
    status: VideoDecisionStatus
    recordedAt: string | null
    choice: VideoDecisionStatus | null
    note: string | null
  }
  inventory: {
    remotionConfigs: number
    deadSafeZoneImports: number
    decommissionedProducers: number
    mp4OnDisk: number
  }
  park: VideoDocketOption
  rebuild: VideoDocketOption
}

const UNREAD: VideoDecisionDocket = {
  status: 'unreadable',
  recordedAt: null,
  source: VIDEO_DOCKET_PATH,
  capability: 'CAP-017',
  versionGap: 'G12',
  mattMove: 'M3',
  decision: { status: 'pending', recordedAt: null, choice: null, note: null },
  inventory: {
    remotionConfigs: 0,
    deadSafeZoneImports: 0,
    decommissionedProducers: 0,
    mp4OnDisk: 0,
  },
  park: { label: 'Park', incrementalVendorUsd: 0, brainPath: '', sources: [] },
  rebuild: { label: 'Rebuild', brainPath: '', sources: [] },
}

function isDecisionStatus(v: unknown): v is VideoDecisionStatus {
  return v === 'pending' || v === 'park' || v === 'rebuild'
}

export function videoDocketComplete(d: VideoDecisionDocket): boolean {
  if (d.status !== 'ok') return false
  if (d.capability !== 'CAP-017' || d.versionGap !== 'G12' || d.mattMove !== 'M3') return false
  if (!isDecisionStatus(d.decision.status)) return false
  if (d.park.incrementalVendorUsd !== 0) return false
  if (d.rebuild.elevenLabsTurboUsdPer1kChars !== 0.05) return false
  if (d.rebuild.producerCapPerRowUsd !== 5) return false
  if (d.rebuild.producerCapPerRunUsd !== 15) return false
  if (d.inventory.deadSafeZoneImports !== 11) return false
  if (d.inventory.decommissionedProducers !== 24) return false
  if (!d.park.brainPath.trim() || d.park.sources.length < 2) return false
  if (!d.rebuild.brainPath.trim() || d.rebuild.sources.length < 2) return false
  return true
}

export function readVideoDecisionDocket(root: string = process.cwd()): VideoDecisionDocket {
  const path = resolve(root, VIDEO_DOCKET_PATH)
  if (!existsSync(path)) return { ...UNREAD }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<VideoDecisionDocket> & {
      inventory?: Partial<VideoDecisionDocket['inventory']>
      park?: Partial<VideoDocketOption>
      rebuild?: Partial<VideoDocketOption>
      decision?: Partial<VideoDecisionDocket['decision']>
    }
    const parsed: VideoDecisionDocket = {
      status: raw.status === 'ok' ? 'ok' : 'unreadable',
      recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : null,
      source: VIDEO_DOCKET_PATH,
      capability: String(raw.capability ?? ''),
      versionGap: String(raw.versionGap ?? ''),
      mattMove: String(raw.mattMove ?? ''),
      decision: {
        status: isDecisionStatus(raw.decision?.status) ? raw.decision.status : 'pending',
        recordedAt: raw.decision?.recordedAt ?? null,
        choice: isDecisionStatus(raw.decision?.choice) ? raw.decision.choice : null,
        note: raw.decision?.note ?? null,
      },
      inventory: {
        remotionConfigs: Number(raw.inventory?.remotionConfigs ?? 0),
        deadSafeZoneImports: Number(raw.inventory?.deadSafeZoneImports ?? 0),
        decommissionedProducers: Number(raw.inventory?.decommissionedProducers ?? 0),
        mp4OnDisk: Number(raw.inventory?.mp4OnDisk ?? 0),
      },
      park: {
        label: String(raw.park?.label ?? 'Park'),
        incrementalVendorUsd: Number(raw.park?.incrementalVendorUsd ?? -1),
        brainPath: String(raw.park?.brainPath ?? ''),
        sources: Array.isArray(raw.park?.sources) ? raw.park.sources.map(String) : [],
      },
      rebuild: {
        label: String(raw.rebuild?.label ?? 'Rebuild'),
        elevenLabsTurboUsdPer1kChars: Number(raw.rebuild?.elevenLabsTurboUsdPer1kChars ?? 0),
        producerCapPerRowUsd: Number(raw.rebuild?.producerCapPerRowUsd ?? 0),
        producerCapPerRunUsd: Number(raw.rebuild?.producerCapPerRunUsd ?? 0),
        brainPath: String(raw.rebuild?.brainPath ?? ''),
        sources: Array.isArray(raw.rebuild?.sources) ? raw.rebuild.sources.map(String) : [],
      },
    }
    if (!videoDocketComplete(parsed)) return { ...parsed, status: 'unreadable' }
    return parsed
  } catch {
    return { ...UNREAD }
  }
}
