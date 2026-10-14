/**
 * lib/studio/qa/ledger.ts - the film ledger behind check 16 ("Not a repeat").
 *
 * `data/studio/film-ledger.jsonl` is committed, so every machine compares a new
 * film against the same history. One JSON object per line:
 *   { sha256, slug, oneSentence, videoType, hookDevice, sceneSet, techniques, checkedAt }
 * A film repeats when its hook device AND scene set both equal any earlier film
 * of the same type (F7, 2026-10-14: every line, not a recent window). The one
 * line skipped is the immediately previous version of the SAME film: the same
 * slug AND the same creative one_sentence (a slug alone is a free field, so it
 * cannot make a new film a "revision"). A generic slug ("film", "test-2") is
 * refused, so a brief cannot dodge the comparison by naming every film alike.
 * The comparison is pure (findRepeat); only readLedger and appendLedgerEntry
 * touch the disk, and the append skips a line whose slug and sha256 are there.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { FILM_LEDGER_PATH } from './thresholds'
import { usableTechnique, type TechniqueRegistry } from './techniques'

export interface LedgerEntry {
  sha256: string
  /** The film's slug (manifest.slug). Older lines have none. */
  slug?: string
  /** The brief's creative.one_sentence (manifest.creative). Older lines have none. */
  oneSentence?: string
  videoType: string
  hookDevice: string
  sceneSet: string[]
  techniques: string[]
  checkedAt: string
}

/** Slug words that name no film. A slug made only of these (and numbers) is refused. */
export const GENERIC_SLUG_WORDS: readonly string[] = [
  'film', 'films', 'video', 'videos', 'ad', 'ads', 'test', 'tests', 'testing', 'draft', 'drafts', 'untitled', 'new', 'final',
  'copy', 'temp', 'tmp', 'clip', 'reel', 'sample', 'example', 'demo', 'v', 'version', 'rev', 'revision',
]

/** Check 16: a slug that names no film ("film", "test-2", "untitled") cannot tell films apart. Null when it can. */
export function genericSlugProblem(slug: string | undefined): string | null {
  const words = (slug ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const generic = words.every((w) => GENERIC_SLUG_WORDS.includes(w) || /^v?\d+$/.test(w))
  return generic
    ? `the slug "${slug ?? ''}" names no film (${GENERIC_SLUG_WORDS.slice(0, 6).join(', ')} and numbers are generic); give the brief a slug or title that says what this film is`
    : null
}

const sentenceForm = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export type BuiltEntry = { ok: true; entry: LedgerEntry } | { ok: false; reason: string }

/**
 * hookDevice is the first executed technique whose category is "hook"; sceneSet
 * is every executed "scene" technique, sorted. A film with no hook technique or
 * no scene technique cannot be compared, so it reports why instead.
 */
export function buildLedgerEntry(
  film: { sha256: string; slug?: string; oneSentence?: string; videoType: string; techniques: readonly string[]; checkedAt: string },
  registry: TechniqueRegistry,
): BuiltEntry {
  if (!registry.hasCategories) return { ok: false, reason: 'registry has no categories' }
  const hook = film.techniques.find((t) => registry.categories.get(t) === 'hook')
  if (!hook) return { ok: false, reason: 'the manifest ran no hook technique' }
  const scenes = film.techniques.filter((t) => registry.categories.get(t) === 'scene')
  if (scenes.length === 0) return { ok: false, reason: 'the manifest ran no scene technique' }
  return {
    ok: true,
    entry: {
      sha256: film.sha256,
      ...(film.slug ? { slug: film.slug } : {}),
      ...(film.oneSentence ? { oneSentence: film.oneSentence } : {}),
      videoType: film.videoType,
      hookDevice: hook,
      sceneSet: [...new Set(scenes)].sort(),
      techniques: [...film.techniques],
      checkedAt: film.checkedAt,
    },
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const x = [...new Set(a)].sort()
  const y = [...new Set(b)].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/** The same film: the same slug AND the same creative one_sentence. */
export const sameFilm = (a: LedgerEntry, b: LedgerEntry): boolean =>
  Boolean(a.slug) && a.slug === b.slug && sentenceForm(a.oneSentence) !== '' && sentenceForm(a.oneSentence) === sentenceForm(b.oneSentence)

/**
 * The earlier films of this type findRepeat compares against: every line of the
 * type, except the immediately previous version of the same film (the last line
 * that is the same film) and this very file's own line (same sha256 and slug).
 */
export function comparedLines(entry: LedgerEntry, ledger: readonly LedgerEntry[]): LedgerEntry[] {
  const ofType = ledger.filter((e) => e.videoType === entry.videoType)
  let previous = -1
  for (let i = ofType.length - 1; i >= 0; i--) {
    if (sameFilm(ofType[i], entry)) {
      previous = i
      break
    }
  }
  return ofType.filter((e, i) => i !== previous && !(e.sha256 === entry.sha256 && e.slug === entry.slug))
}

/** The earlier film this one repeats (the most recent such line), or null. */
export function findRepeat(entry: LedgerEntry, ledger: readonly LedgerEntry[]): LedgerEntry | null {
  const hits = comparedLines(entry, ledger).filter((e) => e.hookDevice === entry.hookDevice && sameSet(e.sceneSet, entry.sceneSet))
  return hits.length ? hits[hits.length - 1] : null
}

/** How many ledger lines findRepeat compares against (for the check's report). */
export function comparedCount(entry: LedgerEntry, ledger: readonly LedgerEntry[]): number {
  return comparedLines(entry, ledger).length
}

/**
 * The usable hook and scene pairs this type has not used in the films it is
 * compared against (techniques.ts usableTechnique: base ready or approved,
 * signature approved; one scene each): what a repeat could switch to.
 */
export function unusedCombinations(entry: LedgerEntry, ledger: readonly LedgerEntry[], registry: TechniqueRegistry): string[] {
  const ready = (cat: string) =>
    [...registry.categories.entries()].filter(([name, c]) => c === cat && usableTechnique(name, registry)).map(([name]) => name).sort()
  const recent = comparedLines(entry, ledger)
  const out: string[] = []
  for (const hook of ready('hook')) {
    for (const scene of ready('scene')) {
      if (!recent.some((e) => e.hookDevice === hook && sameSet(e.sceneSet, [scene]))) out.push(`${hook} + ${scene}`)
    }
  }
  return out
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export interface ParsedLedger {
  entries: LedgerEntry[]
  /** One message per line that is not a valid entry. */
  errors: string[]
}

/** Parse ledger text. Blank lines are ignored; a bad line is reported, never skipped silently. */
export function parseLedger(text: string): ParsedLedger {
  const entries: LedgerEntry[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      errors.push(`line ${i + 1} is not JSON`)
      return
    }
    const o = raw as Partial<LedgerEntry> | null
    if (
      !o || typeof o !== 'object' ||
      typeof o.sha256 !== 'string' || typeof o.videoType !== 'string' || typeof o.hookDevice !== 'string' ||
      typeof o.checkedAt !== 'string' || !isStringArray(o.sceneSet) || !isStringArray(o.techniques)
    ) {
      errors.push(`line ${i + 1} is missing a ledger field`)
      return
    }
    if (o.slug !== undefined && typeof o.slug !== 'string') {
      errors.push(`line ${i + 1} has a slug that is not a string`)
      return
    }
    if (o.oneSentence !== undefined && typeof o.oneSentence !== 'string') {
      errors.push(`line ${i + 1} has a oneSentence that is not a string`)
      return
    }
    entries.push({
      sha256: o.sha256,
      ...(o.slug ? { slug: o.slug } : {}),
      ...(o.oneSentence ? { oneSentence: o.oneSentence } : {}),
      videoType: o.videoType,
      hookDevice: o.hookDevice,
      sceneSet: o.sceneSet,
      techniques: o.techniques,
      checkedAt: o.checkedAt,
    })
  })
  return { entries, errors }
}

/** Read the ledger, creating an empty file when it does not exist yet. */
export function readLedger(path: string = FILM_LEDGER_PATH): ParsedLedger {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '')
  }
  return parseLedger(readFileSync(path, 'utf8'))
}

/** Append one film. Returns false (and writes nothing) when a line with its slug and sha256 is already there. */
export function appendLedgerEntry(entry: LedgerEntry, path: string = FILM_LEDGER_PATH): boolean {
  const current = readLedger(path)
  if (current.entries.some((e) => e.sha256 === entry.sha256 && (e.slug ?? '') === (entry.slug ?? ''))) return false
  const text = readFileSync(path, 'utf8')
  const lead = text.length > 0 && !text.endsWith('\n') ? '\n' : ''
  appendFileSync(path, `${lead}${JSON.stringify(entry)}\n`)
  return true
}

/** Check 16 as problems: a generic slug, or the repeat and the ready pairs left. Empty when the film is new. */
export function repeatProblems(entry: LedgerEntry, ledger: readonly LedgerEntry[], registry: TechniqueRegistry): string[] {
  const out: string[] = []
  const generic = genericSlugProblem(entry.slug)
  if (generic) out.push(generic)
  const repeat = findRepeat(entry, ledger)
  if (repeat) {
    const unused = unusedCombinations(entry, ledger, registry)
    out.push(
      `same hook device "${repeat.hookDevice}" and scene set [${repeat.sceneSet.join(', ')}] as film ${repeat.sha256.slice(0, 12)}${repeat.slug ? ` (${repeat.slug})` : ''} (${repeat.checkedAt}), an earlier ${entry.videoType} film (only the previous version of the same film, the same slug and one sentence, is exempt). ${
        unused.length ? `Ready hook + scene pairs this type has not used: ${unused.join('; ')}` : 'Every ready hook + scene pair is used; a new scene technique is needed'
      }`,
    )
  }
  return out
}

/** Check 16 as one problem line, or null when the film is new and its slug names it. */
export function repeatProblem(entry: LedgerEntry, ledger: readonly LedgerEntry[], registry: TechniqueRegistry): string | null {
  const problems = repeatProblems(entry, ledger, registry)
  return problems.length ? problems.join('; ') : null
}
