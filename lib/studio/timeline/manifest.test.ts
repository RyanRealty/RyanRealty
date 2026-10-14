import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseManifestJson, type Manifest } from '../qa/manifest'
import { ManifestWriteError, serializeManifest, writeManifest } from './manifest'

const good = (): Manifest => ({
  factory: 'lib/studio',
  manifestVersion: 1,
  video: { file: 'final.mp4', sha256: 'a'.repeat(64), width: 1080, height: 1920, fps: 30, duration: 16.3 },
  videoType: 'buyer_ad',
  techniques: ['dollar_first_hook', 'meter_fill_verdict', 'eased_number_reveal'],
  beats: [
    { id: 'hook', role: 'hook', start: 0, end: 3.767 },
    { id: 'end', role: 'endcard', start: 13.2, end: 16.25 },
  ],
  texts: [{ text: '3.5', start: 0.2, end: 3.667, box: { x: 133, y: 340, w: 160, h: 220 }, kind: 'card' }],
  numbers: [{ onScreen: '3.5', source: 'market_metric', window: '2026-04-17 to 2026-10-13', geography: 'City of Bend', definition: 'months of supply' }],
  voice: { engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v', words: [{ word: 'So', start: 0.543, end: 0.81 }] },
  captions: [{ text: 'So', start: 0.543, end: 0.943, words: [0] }],
  audio: { lufs: -14, truePeakDb: -2.2, silent: false },
  endcard: { start: 13.2, quality: 13.2, local: 13.6, service: 14, call: 14.45, out: 16.25 },
  loop: { seconds: 0.3 },
  builtBy: 'claude',
  briefTechniques: ['dollar_first_hook'],
})

describe('the manifest writer', () => {
  it('writes only what the video:check parser accepts, and reads back the same', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tl-manifest-'))
    try {
      const path = join(dir, 'final.manifest.json')
      writeManifest(path, good())
      const parsed = parseManifestJson(readFileSync(path, 'utf8'))
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.manifest).toEqual(good())
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('refuses an invalid manifest and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tl-manifest-'))
    try {
      const path = join(dir, 'final.manifest.json')
      const bad = { ...good(), beats: [{ id: 'end', role: 'endcard', start: 13.2, end: 16.25 }, { id: 'hook', role: 'hook', start: 0, end: 3 }] } as Manifest
      expect(() => writeManifest(path, bad)).toThrow(ManifestWriteError)
      expect(existsSync(path)).toBe(false)
      expect(() => serializeManifest({ ...good(), extra: 1 } as unknown as Manifest)).toThrow(/unknown key "extra"/)
      expect(() => serializeManifest({ ...good(), video: { ...good().video, sha256: 'nope' } })).toThrow(/64 hex/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
