/**
 * The video freeze at the studio's produce door (Matt 2026-10-14). The
 * pipeline's own behaviour is tested in studio.test.ts with the freeze lifted;
 * this file runs the real freeze.
 */
import { describe, expect, it, vi } from 'vitest'
import { produceStudioDraft, type StudioAdapters } from './produce'
import { STUDIO_FORMAT_LIST } from './formats'
import { VIDEO_FREEZE_MESSAGE } from '@/lib/content/video-freeze'

function pngOf(width: number, height: number): Buffer {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}

function adapters(): StudioAdapters {
  return {
    getPhotos: vi.fn().mockResolvedValue([]),
    gradePhoto: vi.fn(),
    concat: vi.fn(),
    panPhoto: vi.fn(),
    resolveSubject: vi.fn().mockResolvedValue({
      label: 'Bend, Oregon',
      figures: { 'active listings': '412' },
      citations: [{ figure: '412', source: 'Supabase', table: 'market_pulse_live' }],
      place: 'Bend',
      sourcePhotoUrl: 'https://mls.test/photo.jpg',
    }),
    generateStills: vi
      .fn()
      .mockResolvedValue({ images: [pngOf(1080, 1350), pngOf(1080, 1350)], model: 'grok-imagine-image-2.0', costTicks: null }),
    inspectFrame: vi.fn().mockResolvedValue({ pass: true, score: 91, defects: [], describes: 'desert', fixHint: '', costUsd: null }),
    animate: vi.fn(),
    writeCaption: vi
      .fn()
      .mockResolvedValue({ ok: true, result: { caption: '412 active listings.', altText: 'alt', costUsd: 0, attempts: 1 } }),
    downloadUrl: vi.fn(),
    storeMedia: vi.fn().mockImplementation(async ({ filename }) => ({ ok: true, url: `https://cdn.test/${filename}` })),
    insertPending: vi.fn().mockResolvedValue({ ok: true, id: 'draft-1' }),
    markReady: vi.fn().mockResolvedValue({ ok: true }),
    killDraft: vi.fn().mockResolvedValue({ ok: true }),
    composeMotion: vi.fn(),
  }
}

const base = { brokerSlug: 'matt', requestedBy: 'matt@ryan-realty.com', origin: 'console' as const }

describe('produceStudioDraft under the video freeze', () => {
  const videoFormats = STUDIO_FORMAT_LIST.filter((f) => f.media === 'video')

  it('there are video formats to freeze', () => {
    expect(videoFormats.map((f) => f.id)).toEqual(
      expect.arrayContaining(['listing_film', 'listing_motion', 'market_pulse', 'market_trend', 'place_video', 'place_map']),
    )
  })

  it.each(videoFormats.map((f) => [f.id]))('refuses %s before a row, a cent, or a subject lookup', async (formatId) => {
    const a = adapters()
    const result = await produceStudioDraft({ ...base, formatId, subjectQuery: 'bend' }, a)
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE })
    for (const step of [a.resolveSubject, a.insertPending, a.generateStills, a.animate, a.panPhoto, a.markReady]) {
      expect(step).not.toHaveBeenCalled()
    }
  })

  it('the slate cron is refused the same way (origin does not matter)', async () => {
    const a = adapters()
    const result = await produceStudioDraft({ ...base, origin: 'slate', formatId: 'market_pulse' }, a)
    expect(result).toEqual({ ok: false, error: VIDEO_FREEZE_MESSAGE })
    expect(a.insertPending).not.toHaveBeenCalled()
  })

  it('still produces an image draft', async () => {
    const a = adapters()
    const result = await produceStudioDraft({ ...base, formatId: 'trend_reactive' }, a)
    expect(result.ok).toBe(true)
    expect(a.insertPending).toHaveBeenCalledTimes(1)
    const ready = (a.markReady as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(ready.executorResponse.publish_payload.mediaType).toBe('image')
    expect(ready.executorResponse.media.kind).toBe('image')
  })
})
