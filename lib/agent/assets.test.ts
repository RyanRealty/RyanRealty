/**
 * lib/agent/assets.test.ts — unit coverage for the R2.6 link ladder's
 * classifier and the R2.7 sha256-dedupe path in ingestShoot.
 *
 * NO network, NO live DB: lib/data/agent/asset-registry.ts (every Supabase
 * call) and lib/ai/anthropic.ts (the vision-grading model call) are fully
 * mocked. lib/agent/exif.ts is left real — `exifr` isn't installed for this
 * rung, so readExif() resolves to `{}` via its own dynamic-import failure
 * path with zero network involved (see that module's doc comment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const registryMocks = vi.hoisted(() => ({
  ensureShootsBucket: vi.fn().mockResolvedValue(undefined),
  uploadShootAsset: vi.fn().mockResolvedValue({ ok: true }),
  findAssetBySourceId: vi.fn().mockResolvedValue(null),
  upsertAssetLibraryRow: vi.fn().mockResolvedValue({ ok: true }),
  resolveListingLatLng: vi.fn().mockResolvedValue(null),
  PROPERTY_SHOOTS_BUCKET: 'property-shoots',
}))

vi.mock('@/lib/data/agent/asset-registry', () => registryMocks)

vi.mock('@/lib/ai/anthropic', () => ({
  CLASSIFIER_MODEL: 'claude-haiku-4-5-20251001',
  createAnthropic: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify([{ grade: 'A', caption: 'a house', scene: 'exterior', watermark: false }]),
          },
        ],
      }),
    },
  }),
}))

import { classifyLink, ingestShoot } from './assets'
import type { AgentContext } from './types'

const CTX: AgentContext = {
  brokerSlug: 'paul',
  brokerEmail: 'paul@ryan-realty.com',
  brokerDisplayName: 'Paul Stevenson',
  sessionId: 'session-1',
  brokerCell: '+15417033095',
}

describe('classifyLink', () => {
  it('classifies a direct image URL by extension', () => {
    expect(classifyLink('https://example.com/photos/house.jpg').kind).toBe('direct-file')
  })

  it('classifies a direct zip URL by extension, query string tolerated', () => {
    expect(classifyLink('https://cdn.example.com/shoot.zip?x=1').kind).toBe('direct-file')
  })

  it('rewrites a Dropbox share link to force a direct download (dl=1)', () => {
    const result = classifyLink('https://www.dropbox.com/s/abc123/photos.zip?dl=0')
    expect(result.kind).toBe('dropbox')
    if (result.kind === 'dropbox') {
      expect(result.url).toContain('dl=1')
      expect(result.url).not.toContain('dl=0')
    }
  })

  it('flags WeTransfer share links and short we.tl links', () => {
    expect(classifyLink('https://wetransfer.com/downloads/abc123').kind).toBe('wetransfer')
    expect(classifyLink('https://we.tl/t-abc123').kind).toBe('wetransfer')
  })

  it('falls back to a manual "download all" instruction for known gallery platforms', () => {
    const result = classifyLink('https://ryanrealty.aryeo.com/sites/abc-def/branded')
    expect(result.kind).toBe('manual')
    if (result.kind === 'manual') {
      expect(result.platform).toBe('Aryeo')
      expect(result.instruction.toLowerCase()).toContain('download all')
    }
  })

  it('recognizes hdphotohub, rela.to, tourfactory, and spiro as gallery platforms', () => {
    const cases: Array<[string, string]> = [
      ['https://tour.hdphotohub.com/xyz', 'HDPhotoHub'],
      ['https://rela.to/abc', 'Rela'],
      ['https://www.tourfactory.com/123', 'TourFactory'],
      ['https://app.spiro.media/tour/abc', 'Spiro'],
    ]
    for (const [url, platform] of cases) {
      const result = classifyLink(url)
      expect(result.kind).toBe('manual')
      if (result.kind === 'manual') expect(result.platform).toBe(platform)
    }
  })

  it('returns "other" for an unrecognized link with no recognizable file extension', () => {
    expect(classifyLink('https://example.com/gallery').kind).toBe('other')
  })

  it('returns "other" for a malformed URL instead of throwing', () => {
    expect(() => classifyLink('not a url')).not.toThrow()
    expect(classifyLink('not a url').kind).toBe('other')
  })
})

describe('ingestShoot — sha256 dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registryMocks.ensureShootsBucket.mockResolvedValue(undefined)
    registryMocks.uploadShootAsset.mockResolvedValue({ ok: true })
    registryMocks.upsertAssetLibraryRow.mockResolvedValue({ ok: true })
    registryMocks.resolveListingLatLng.mockResolvedValue(null)
    registryMocks.findAssetBySourceId.mockResolvedValue(null)
  })

  it('skips a file whose sha256 already exists in asset_library, ingests the rest', async () => {
    const bufferA = Buffer.from('same-bytes-both-files')
    const bufferBDuplicateContent = Buffer.from('same-bytes-both-files') // identical bytes, different filename
    const bufferC = Buffer.from('genuinely-different-bytes')

    const dupSha = createHash('sha256').update(bufferA).digest('hex')
    registryMocks.findAssetBySourceId.mockImplementation(async (_source: string, sha: string) =>
      sha === dupSha ? { id: 'already-registered' } : null,
    )

    const summary = await ingestShoot(CTX, {
      propertyLabel: '123 NW Awbrey Ave',
      files: [
        { name: 'a.jpg', buffer: bufferA, mime: 'image/jpeg' },
        { name: 'b-duplicate.jpg', buffer: bufferBDuplicateContent, mime: 'image/jpeg' },
        { name: 'c.jpg', buffer: bufferC, mime: 'image/jpeg' },
      ],
    })

    // a.jpg and b-duplicate.jpg share a sha the registry says is already present.
    expect(summary.skipped).toBe(2)
    expect(summary.ingested).toBe(1)
    expect(registryMocks.upsertAssetLibraryRow).toHaveBeenCalledTimes(1)
    expect(registryMocks.uploadShootAsset).toHaveBeenCalledTimes(1)
  })

  it('never uploads or registers a file whose content is already registered', async () => {
    const buffer = Buffer.from('duplicate-content-only-file-in-this-batch')
    registryMocks.findAssetBySourceId.mockResolvedValue({ id: 'already-registered' })

    const summary = await ingestShoot(CTX, {
      propertyLabel: '456 NW Bond St',
      files: [{ name: 'dup.jpg', buffer, mime: 'image/jpeg' }],
    })

    expect(summary.ingested).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(registryMocks.uploadShootAsset).not.toHaveBeenCalled()
    expect(registryMocks.upsertAssetLibraryRow).not.toHaveBeenCalled()
  })

  it('registers a genuinely new file with the sha256 as source_id and source "property-shoot"', async () => {
    const buffer = Buffer.from('a brand new photo nobody has seen')
    const expectedSha = createHash('sha256').update(buffer).digest('hex')

    const summary = await ingestShoot(CTX, {
      propertyLabel: '789 NW Newport Ave',
      files: [{ name: 'new.jpg', buffer, mime: 'image/jpeg' }],
    })

    expect(summary.ingested).toBe(1)
    expect(summary.skipped).toBe(0)
    expect(registryMocks.upsertAssetLibraryRow).toHaveBeenCalledTimes(1)
    const row = registryMocks.upsertAssetLibraryRow.mock.calls[0][0]
    expect(row.source).toBe('property-shoot')
    expect(row.source_id).toBe(expectedSha)
    expect(row.approval).toBe('intake')
  })

  it('skips non-image/video files without touching storage or the registry', async () => {
    const summary = await ingestShoot(CTX, {
      propertyLabel: '1 NW Wall St',
      files: [{ name: 'notes.pdf', buffer: Buffer.from('%PDF-1.4 not a photo'), mime: 'application/pdf' }],
    })

    expect(summary.ingested).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(registryMocks.uploadShootAsset).not.toHaveBeenCalled()
    expect(registryMocks.upsertAssetLibraryRow).not.toHaveBeenCalled()
  })
})
