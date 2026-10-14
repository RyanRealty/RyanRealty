/**
 * lib/studio/qa/ledger.ts - the film ledger behind check 16 ("Not a repeat").
 *
 * `data/studio/film-ledger.jsonl` is committed, so every machine compares a new
 * film against the same recent history. One JSON object per line:
 *   { sha256, videoType, hookDevice, sceneSet, techniques, checkedAt }
 * A film repeats when its hook device AND scene set both equal any of the last
 * five earlier films of the same type. A later render of the same film (the
 * same slug) is a revision, not a repeat. The comparison is a pure function
 * (findRepeat); only readLedger and appendLedgerEntry touch the disk.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { FILM_LEDGER_PATH, LEDGER_WINDOW } from './thresholds'
import { usableTechnique, type TechniqueRegistry } from './techniques'

export interface LedgerEntry {
  sha256: string
  /** The film's slug (manifest.slug). Older lines have none. */
  slug?: string
  videoType: string
  hookDevice: string
  sceneSet: string[]
  techniques: string[]
  checkedAt: string
}

export type BuiltEntry = { ok: true; entry: LedgerEntry } | { ok: false; reason: string }

/**
 * hookDevice is the first executed technique whose category is "hook"; sceneSet
 * is every executed "scene" technique, sorted. A film with no hook technique or
 * no scene technique cannot be compared, so it reports why instead.
 */
export function buildLedgerEntry(
  film: { sha256: string; slug?: string; videoType: string; techniques: readonly string[]; checkedAt: string },
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

/** The same film: the same file, or a revision of it (the same slug). */
const sameFilm = (a: LedgerEntry, b: LedgerEntry) => a.sha256 === b.sha256 || (Boolean(a.slug) && a.slug === b.slug)

/** The earlier films of this type findRepeat compares against: the last `window`, other films only. */
function recentOthers(entry: LedgerEntry, ledger: readonly LedgerEntry[], window: number): LedgerEntry[] {
  return ledger.filter((e) => e.videoType === entry.videoType && !sameFilm(e, entry)).slice(-window)
}

/**
 * The earlier film this one repeats, or null. Only films of the same type count;
 * a line with this film's own sha256, or its own slug (a revision), is the same
 * film and is skipped; the comparison covers the last `window` of what is left
 * (fewer if the ledger is short).
 */
export function findRepeat(entry: LedgerEntry, ledger: readonly LedgerEntry[], window: number = LEDGER_WINDOW): LedgerEntry | null {
  return recentOthers(entry, ledger, window).find((e) => e.hookDevice === entry.hookDevice && sameSet(e.sceneSet, entry.sceneSet)) ?? null
}

/** How many ledger lines findRepeat compares against (for the check's report). */
export function comparedCount(entry: LedgerEntry, ledger: readonly LedgerEntry[], window: number = LEDGER_WINDOW): number {
  return recentOthers(entry, ledger, window).length
}

/**
 * The usable hook and scene pairs this type has not used in its last `window`
 * films (techniques.ts usableTechnique: base ready or approved, signature
 * approved; one scene each): what a repeat could switch to.
 */
export function unusedCombinations(entry: LedgerEntry, ledger: readonly LedgerEntry[], registry: TechniqueRegistry, window: number = LEDGER_WINDOW): string[] {
  const ready = (cat: string) =>
    [...registry.categories.entries()].filter(([name, c]) => c === cat && usableTechnique(name, registry)).map(([name]) => name).sort()
  const recent = recentOthers(entry, ledger, window)
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
    entries.push({
      sha256: o.sha256,
      ...(o.slug ? { slug: o.slug } : {}),
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

/** Append one film. Returns false (and writes nothing) when its sha256 is already there. */
export function appendLedgerEntry(entry: LedgerEntry, path: string = FILM_LEDGER_PATH): boolean {
  const current = readLedger(path)
  if (current.entries.some((e) => e.sha256 === entry.sha256)) return false
  const text = readFileSync(path, 'utf8')
  const lead = text.length > 0 && !text.endsWith('\n') ? '\n' : ''
  appendFileSync(path, `${lead}${JSON.stringify(entry)}\n`)
  return true
}

/** Check 16 as a problem: the repeat and the ready pairs left, or null when the film is new. */
export function repeatProblem(entry: LedgerEntry, ledger: readonly LedgerEntry[], registry: TechniqueRegistry, window: number = LEDGER_WINDOW): string | null {
  const repeat = findRepeat(entry, ledger, window)
  if (!repeat) return null
  const unused = unusedCombinations(entry, ledger, registry, window)
  return `same hook device "${repeat.hookDevice}" and scene set [${repeat.sceneSet.join(', ')}] as film ${repeat.sha256.slice(0, 12)}${repeat.slug ? ` (${repeat.slug})` : ''} (${repeat.checkedAt}), one of the last ${window} ${entry.videoType} films. ${
    unused.length ? `Ready hook + scene pairs this type has not used lately: ${unused.join('; ')}` : 'Every ready hook + scene pair was used lately; a new scene technique is needed'
  }`
}
