import { describe, expect, it, vi } from 'vitest'
import { chooseMove, describeSequence, planShotList, type GradedPhoto } from './shotlist'
import { planListingFilm, renderListingFilm, sampleForGrading, type FilmPlan } from './film'
import { capForFormat, newLedger } from './spend'
import { normalizeGrade } from '@/lib/grok/classify'

function photo(over: Partial<GradedPhoto> & { url: string }): GradedPhoto {
  return {
    subject: 'living',
    quality: 90,
    animatable: true,
    hasOverlay: false,
    describes: 'a room',
    order: 0,
    ...over,
  }
}

const SET: GradedPhoto[] = [
  photo({ url: 'ext1', subject: 'exterior_front', describes: 'the front of the house', order: 0 }),
  photo({ url: 'liv1', subject: 'living', describes: 'the living room', order: 1 }),
  photo({ url: 'kit1', subject: 'kitchen', describes: 'the kitchen', order: 2 }),
  photo({ url: 'view1', subject: 'view', describes: 'the view west', order: 3 }),
  photo({ url: 'ext2', subject: 'exterior_rear', describes: 'the back yard', order: 4 }),
]

describe('photo grading', () => {
  it('refuses to animate a frame with burned-in text even if the model said yes', () => {
    // An overlay is in the pixels: it survives the camera move and reads as
    // someone else's branding on our post.
    const grade = normalizeGrade({ subject: 'kitchen', quality: 95, animatable: true, hasOverlay: true, describes: 'x' })
    expect(grade.animatable).toBe(false)
  })

  it('falls back to "other" on an unknown subject rather than trusting it', () => {
    expect(normalizeGrade({ subject: 'swimming_pool_area' as never, quality: 80 }).subject).toBe('other')
  })
})

describe('shot grammar', () => {
  it('never shows the same subject twice in one film', () => {
    // Two front-porch beats is a repeat, not a bookend. The first real film
    // we cut opened and closed on the same porch.
    const porchHeavy: GradedPhoto[] = [
      photo({ url: 'ext1', subject: 'exterior_front', order: 0 }),
      photo({ url: 'ext2', subject: 'exterior_front', order: 1 }),
      photo({ url: 'liv1', subject: 'living', order: 2 }),
      photo({ url: 'kit1', subject: 'kitchen', order: 3 }),
      photo({ url: 'view1', subject: 'view', order: 4 }),
    ]
    const shots = planShotList(porchHeavy, { maxShots: 4 })
    const subjects = shots.map((s) => s.subject)
    expect(new Set(subjects).size).toBe(subjects.length)
  })

  it('opens outside and closes outside', () => {
    const shots = planShotList(SET, { maxShots: 4 })
    expect(shots[0].subject).toBe('exterior_front')
    expect(shots[shots.length - 1].subject).toMatch(/exterior|view|aerial/)
  })

  it('never repeats a subject back to back', () => {
    const shots = planShotList(SET, { maxShots: 5 })
    for (let i = 1; i < shots.length; i += 1) {
      expect(shots[i].subject).not.toBe(shots[i - 1].subject)
    }
  })

  it('gives every beat of a short film its own camera move', () => {
    const shots = planShotList(SET, { maxShots: 5 })
    for (let i = 1; i < shots.length; i += 1) {
      expect(shots[i].move).not.toBe(shots[i - 1].move)
    }
    expect(new Set(shots.map((s) => s.move)).size).toBe(shots.length)
    expect(chooseMove('push', 'push')).not.toBe('push')
    expect(chooseMove('push', 'locked')).toBe('push')
    // A move already used in this film is skipped when an unused one exists.
    expect(chooseMove('push', 'locked', ['push'])).not.toBe('push')
    // But running out of moves never costs us a good frame.
    expect(chooseMove('push', undefined, ['push', 'riseUp', 'panLeft', 'locked'])).toBe('push')
  })

  it('drops frames that cannot carry a move instead of padding the film', () => {
    const weak = SET.map((p) => (p.subject === 'kitchen' ? { ...p, animatable: false } : p))
    const shots = planShotList(weak, { maxShots: 5 })
    expect(shots.map((s) => s.url)).not.toContain('kit1')
  })

  it('returns fewer beats rather than reusing a frame', () => {
    const shots = planShotList([SET[0]], { maxShots: 4 })
    expect(shots).toHaveLength(1)
    expect(new Set(shots.map((s) => s.url)).size).toBe(shots.length)
  })

  it('returns nothing when every frame is below the bar, so no film is made', () => {
    expect(planShotList(SET.map((p) => ({ ...p, quality: 40 })), { maxShots: 4 })).toEqual([])
    expect(planShotList([], { maxShots: 4 })).toEqual([])
  })

  it('describes the film as an ordered sentence for the caption and alt text', () => {
    const shots = planShotList(SET, { maxShots: 3 })
    expect(describeSequence(shots)).toContain(', then ')
    expect(describeSequence([])).toBe('')
  })
})

describe('grading sample', () => {
  it('takes everything when the set is small', () => {
    expect(sampleForGrading([1, 2, 3], 8)).toEqual([1, 2, 3])
  })

  it('keeps the agent\'s first picks and then strides across the rest', () => {
    // The real failure this fixes: grading photos 0-7 of a 41-photo set
    // returned three exteriors and five living rooms and no kitchen, so the
    // film had nothing for its "room that sells the house" beat.
    const set = Array.from({ length: 41 }, (_, i) => i)
    const picked = sampleForGrading(set, 8)
    expect(picked).toHaveLength(8)
    expect(picked.slice(0, 2)).toEqual([0, 1])
    // Reaches deep into the set, not just the head.
    expect(Math.max(...picked)).toBeGreaterThan(30)
    expect(new Set(picked).size).toBe(8)
  })
})

describe('film build', () => {
  const planAdapters = (over = {}) => ({
    getPhotos: vi.fn().mockResolvedValue(
      SET.map((p, i) => ({ url: p.url, order: i, isPrimary: i === 0 })),
    ),
    gradePhoto: vi.fn().mockImplementation(async ({ imageUrl }: { imageUrl: string }) => {
      const found = SET.find((p) => p.url === imageUrl)!
      return { subject: found.subject, quality: found.quality, animatable: true, hasOverlay: false, describes: found.describes }
    }),
    ...over,
  })

  const renderAdapters = (over = {}) => ({
    animate: vi.fn().mockResolvedValue({
      url: 'https://x.ai/tmp.mp4', model: 'grok-imagine-video-1.5', durationSeconds: 6, costTicks: null,
    }),
    downloadUrl: vi.fn().mockResolvedValue(Buffer.from('clip')),
    concat: vi.fn().mockResolvedValue({ ok: true, body: Buffer.from('film'), method: 'encode', clips: 4 }),
    ...over,
  })

  it('plans without spending on video, so a caption failure is cheap', async () => {
    const a = planAdapters()
    const ledger = newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 }))
    const result = await planListingFilm({ listingKey: 'k', maxShots: 4, secondsPerShot: 6 }, a, ledger)
    expect(result.ok).toBe(true)
    // Grading only, and grading is a real line item: about three cents a
    // frame. What matters is that not one cent of video was spent yet.
    expect(ledger.totalUsd).toBeLessThan(0.35)
    expect(ledger.lines.every((l) => !l.step.startsWith('beat'))).toBe(true)
  })

  it('refuses the film when the listing has no usable photos', async () => {
    const result = await planListingFilm(
      { listingKey: 'k', maxShots: 4, secondsPerShot: 6 },
      planAdapters({ getPhotos: vi.fn().mockResolvedValue([]) }),
      newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })),
    )
    expect(result.ok).toBe(false)
  })

  it('survives one photo that will not grade', async () => {
    const gradePhoto = vi
      .fn()
      .mockRejectedValueOnce(new Error('vision timeout'))
      .mockImplementation(async ({ imageUrl }: { imageUrl: string }) => {
        const found = SET.find((p) => p.url === imageUrl)!
        return { subject: found.subject, quality: 90, animatable: true, hasOverlay: false, describes: found.describes }
      })
    const result = await planListingFilm(
      { listingKey: 'k', maxShots: 4, secondsPerShot: 6 },
      planAdapters({ gradePhoto }),
      newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })),
    )
    expect(result.ok).toBe(true)
  })

  it('animates one beat per shot and cuts them together', async () => {
    const planned = await planListingFilm({ listingKey: 'k', maxShots: 4, secondsPerShot: 6 }, planAdapters(), newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })))
    if (!planned.ok) throw new Error('plan failed')
    const a = renderAdapters()
    const ledger = newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 }))
    const film = await renderListingFilm(planned.plan, { aspectRatio: '9:16' }, a, ledger)
    expect(film.ok).toBe(true)
    expect(a.animate).toHaveBeenCalledTimes(planned.plan.shots.length)
    expect(a.concat).toHaveBeenCalledTimes(1)
    if (film.ok) expect(film.degradedToSingleBeat).toBe(false)
  })

  it('ships the first beat and says so when the runtime has no ffmpeg', async () => {
    const planned = await planListingFilm({ listingKey: 'k', maxShots: 4, secondsPerShot: 6 }, planAdapters(), newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })))
    if (!planned.ok) throw new Error('plan failed')
    const film = await renderListingFilm(
      planned.plan,
      { aspectRatio: '9:16' },
      renderAdapters({
        concat: vi.fn().mockResolvedValue({ ok: false, error: 'no ffmpeg', reason: 'no-ffmpeg' }),
      }),
      newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })),
    )
    expect(film.ok).toBe(true)
    // A quiet downgrade is the thing we refuse: it has to be on the record.
    if (film.ok) {
      expect(film.degradedToSingleBeat).toBe(true)
      expect(film.shots).toHaveLength(1)
    }
  })

  it('fails rather than shipping a broken file when the cut itself failed', async () => {
    const planned = await planListingFilm({ listingKey: 'k', maxShots: 4, secondsPerShot: 6 }, planAdapters(), newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })))
    if (!planned.ok) throw new Error('plan failed')
    const film = await renderListingFilm(
      planned.plan,
      { aspectRatio: '9:16' },
      renderAdapters({
        concat: vi.fn().mockResolvedValue({ ok: false, error: 'muxer blew up', reason: 'failed' }),
      }),
      newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })),
    )
    expect(film.ok).toBe(false)
  })

  it('gives every beat a different move, end to end', async () => {
    const planned = await planListingFilm({ listingKey: 'k', maxShots: 4, secondsPerShot: 6 }, planAdapters(), newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })))
    if (!planned.ok) throw new Error('plan failed')
    const a = renderAdapters()
    await renderListingFilm(planned.plan as FilmPlan, { aspectRatio: '9:16' }, a, newLedger(capForFormat({ shots: 4, seconds: 6, gradedPhotos: 8 })))
    const prompts = (a.animate as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })
})
