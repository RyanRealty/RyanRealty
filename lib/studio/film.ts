/**
 * lib/studio/film.ts — a multi-beat film from our own photographs.
 *
 * Grade the available frames, choose a small sequence with a reason for each
 * beat, move across each one, and cut them together.
 *
 * Every frame here is a real photograph of a real property, and nothing
 * touches its pixels but a uniform scale and a crop. Matt 2026-10-07: the
 * beats used to be Grok clips, and Grok squeezed every landscape photo into
 * the 9:16 frame, so every house came out tall and thin. A beat is now a pan
 * across the true photograph (lib/video/pan.ts), alternating direction beat
 * to beat. Grok vision still does the one job it is good at here: which of
 * the forty-one photographs can carry a beat, and what each one is of.
 *
 * Adapter-injected and pure, so the sequence logic is testable without
 * spending a cent.
 */
import type { PhotoGrade } from '@/lib/grok/classify'
import type { ConcatResult } from '@/lib/video/concat'
import type { PanDirection } from '@/lib/video/pan'
import { planShotList, describeSequence, type GradedPhoto, type PlannedShot } from './shotlist'
import { addSpend, assertBudget, VISION_CALL_USD, type SpendLedger } from './spend'

/**
 * How many photographs we grade before choosing the sequence.
 *
 * Eight, not forty-one. Each grade is about three cents, MLS order is not
 * random (the listing agent led with their best frames), and a four-beat film
 * does not get better by looking at every bathroom.
 */
export const GRADE_BUDGET = 8

/**
 * Choose which photographs to grade.
 *
 * NOT the first eight. MLS order front-loads the exterior and the main living
 * space, so grading the head of a 41-photo set returned three exteriors and
 * five living rooms and no kitchen at all: the film had nothing to put in its
 * "room that sells the house" slot. Take the agent's first two picks, which
 * are chosen and usually the best frames, then stride across the rest so the
 * kitchen, the primary, and the view are actually in the running.
 */
export function sampleForGrading<T>(photos: T[], budget: number): T[] {
  if (photos.length <= budget) return photos
  const lead = photos.slice(0, 2)
  const rest = photos.slice(2)
  const want = budget - lead.length
  const stride = rest.length / want
  const spread: T[] = []
  for (let i = 0; i < want; i += 1) spread.push(rest[Math.floor(i * stride)])
  return [...lead, ...spread]
}

export type FilmAdapters = {
  getPhotos: (
    listingKey: string,
  ) => Promise<Array<{ url: string; gradeUrl?: string; order: number; isPrimary: boolean }>>
  gradePhoto: (input: { imageUrl: string }) => Promise<PhotoGrade>
  /**
   * One beat: the photograph at `url`, panned across at its true shape for
   * `seconds` (lib/video/pan.ts). Never a generator: a listing photo is not
   * animated by a model.
   */
  panPhoto: (input: {
    url: string
    seconds: number
    direction: PanDirection
    width: number
    height: number
  }) => Promise<{ body: Buffer; label: string }>
  concat: (clips: Buffer[]) => Promise<ConcatResult>
}

/** A beat as cut: the planned shot plus how the window actually moved. */
export type CutShot = PlannedShot & { pan: string }

export type FilmPlan = {
  shots: PlannedShot[]
  /** What the film will show, in order. Feeds the caption and the alt text. */
  describes: string
  /** First frame, used as the poster. */
  posterUrl: string
}

export type FilmResult =
  | {
      ok: true
      body: Buffer
      shots: CutShot[]
      describes: string
      posterUrl: string
    }
  | { ok: false; error: string }

export type BuildFilmInput = {
  listingKey: string
  maxShots: number
  secondsPerShot: number
}

/**
 * PHASE 1, cheap: grade the photo set and choose the sequence.
 *
 * Split from the render on purpose. Grading is the film's only spend (a few
 * cents a frame); the beats themselves are free pans. The caption is written
 * between the two, so a caption the voice gate rejects throws away no cut.
 */
export async function planListingFilm(
  input: Pick<BuildFilmInput, 'listingKey' | 'maxShots' | 'secondsPerShot'>,
  adapters: Pick<FilmAdapters, 'getPhotos' | 'gradePhoto'>,
  ledger: SpendLedger,
): Promise<{ ok: true; plan: FilmPlan } | { ok: false; error: string }> {
  const photos = await adapters.getPhotos(input.listingKey)
  if (photos.length === 0) return { ok: false, error: 'That listing has no usable public photos.' }

  const candidates = sampleForGrading(photos, GRADE_BUDGET)
  const graded: GradedPhoto[] = []
  for (const photo of candidates) {
    assertBudget(ledger, VISION_CALL_USD, 'photo grading')
    try {
      const grade = await adapters.gradePhoto({ imageUrl: photo.gradeUrl ?? photo.url })
      addSpend(ledger, { step: 'photo grade', usd: VISION_CALL_USD, ticks: null })
      graded.push({ ...grade, url: photo.url, order: photo.order })
    } catch {
      // One unreadable photo is not a reason to abandon the film.
      addSpend(ledger, { step: 'photo grade (failed)', usd: VISION_CALL_USD, ticks: null })
    }
  }

  const shots = planShotList(graded, {
    maxShots: input.maxShots,
    secondsPerShot: input.secondsPerShot,
  })
  if (shots.length === 0) {
    return { ok: false, error: 'No photograph in this set could carry a camera move.' }
  }

  return {
    ok: true,
    plan: { shots, describes: describeSequence(shots), posterUrl: shots[0].url },
  }
}

/**
 * PHASE 2: pan across each beat's photograph and cut them together. No
 * generator, no spend: the beats are the real photographs, moved across.
 * A beat that cannot be made fails the film with the reason, rather than
 * shipping something that is not the house.
 */
export async function renderListingFilm(
  plan: FilmPlan,
  frame: { width: number; height: number },
  adapters: Pick<FilmAdapters, 'panPhoto' | 'concat'>,
  ledger: SpendLedger,
): Promise<FilmResult> {
  // The beats do not depend on each other, so they are made together.
  let made: Array<{ body: Buffer; label: string }>
  try {
    made = await Promise.all(
      plan.shots.map((shot, i) =>
        adapters
          .panPhoto({ url: shot.url, seconds: shot.seconds, direction: i % 2 === 0 ? 'forward' : 'back', ...frame })
          .catch((err: unknown) => {
            throw new Error(`Could not make beat ${i + 1} (${shot.subject}): ${err instanceof Error ? err.message : 'pan failed'}`)
          }),
      ),
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'pan failed' }
  }
  const shots: CutShot[] = plan.shots.map((shot, i) => ({ ...shot, pan: made[i].label }))
  for (const [i, shot] of shots.entries()) {
    addSpend(ledger, { step: `beat ${i + 1}: ${shot.subject} (${shot.pan} across the real photo)`, usd: 0, ticks: null })
  }

  // Pans and the cut use the same ffmpeg, so there is no one-beat fallback
  // left to take: a cut that fails fails the film with its reason.
  const joined = await adapters.concat(made.map((m) => m.body))
  if (!joined.ok) return { ok: false, error: `Could not cut the film: ${joined.error}` }

  return { ok: true, body: joined.body, shots, describes: plan.describes, posterUrl: plan.posterUrl }
}
