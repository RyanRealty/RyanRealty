/**
 * lib/studio/qa/manifest.ts - the render manifest (`<name>.manifest.json`) the
 * factory writes beside every MP4, and a strict parser for it.
 *
 * The shape is exactly the one in docs/plans/STUDIO_ONE_FACTORY.md. The parser
 * returns typed issues, never throws on bad input, and never repairs: a manifest
 * that is wrong is reported wrong, so the check fails instead of guessing.
 *
 * Small supersets of the contract, all deliberate:
 *  - `builtBy` (optional string): who built the film, so check 14 can refuse a
 *    review by the same author.
 *  - `briefTechniques` (optional string[]): the brief's technique names, so check
 *    15 can run without a brief file.
 *  - `endcard` and `loop` may be null (a type with requires_end_card or
 *    requires_loop false). A type that requires them still fails the check when
 *    they are null.
 */

export const MANIFEST_FACTORY = 'lib/studio'
export const MANIFEST_VERSION = 1

export const BEAT_ROLES = ['hook', 'intro', 'body', 'payoff', 'cta', 'endcard'] as const
export type BeatRole = (typeof BEAT_ROLES)[number]

export const TEXT_KINDS = ['card', 'caption', 'endcard', 'cta', 'label'] as const
export type TextKind = (typeof TEXT_KINDS)[number]

export interface ManifestVideo {
  file: string
  sha256: string
  width: number
  height: number
  fps: number
  duration: number
}

export interface ManifestBeat {
  id: string
  role: BeatRole
  start: number
  end: number
}

export interface ManifestBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ManifestText {
  text: string
  start: number
  end: number
  box: ManifestBox
  kind: TextKind
}

export interface ManifestNumber {
  onScreen: string
  source?: string
  window?: string
  geography?: string
  definition?: string
}

export interface ManifestVoiceWord {
  word: string
  start: number
  end: number
}

export interface ManifestVoice {
  engine: string
  model: string
  voiceId: string
  words: ManifestVoiceWord[]
}

export interface ManifestCaption {
  text: string
  start: number
  end: number
  /** Indices into voice.words that this caption shows. */
  words: number[]
}

export interface ManifestAudio {
  lufs: number | null
  truePeakDb: number | null
  silent: boolean
}

export interface ManifestEndcard {
  start: number
  quality: number
  local: number
  service: number
  call: number
  out: number
}

export interface ManifestLoop {
  seconds: number
}

export interface Manifest {
  factory: string
  manifestVersion: number
  video: ManifestVideo
  videoType: string
  techniques: string[]
  beats: ManifestBeat[]
  texts: ManifestText[]
  numbers: ManifestNumber[]
  voice: ManifestVoice | null
  captions: ManifestCaption[]
  audio: ManifestAudio
  endcard: ManifestEndcard | null
  loop: ManifestLoop | null
  builtBy?: string
  /** The brief's technique names, when the renderer carries them (check 15 without a brief file). */
  briefTechniques?: string[]
}

export type ManifestIssueCode = 'json' | 'not_object' | 'missing' | 'type' | 'range' | 'enum' | 'unknown_key' | 'order'

export interface ManifestIssue {
  code: ManifestIssueCode
  /** Dotted path with array indices, e.g. `beats[2].end`. Empty for the root. */
  path: string
  message: string
}

export type ManifestParse = { ok: true; manifest: Manifest } | { ok: false; errors: ManifestIssue[] }

export interface ParseOptions {
  /** Report unknown keys as errors (default) or ignore them. */
  allowUnknownKeys?: boolean
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Reader {
  issues: ManifestIssue[] = []
  constructor(private readonly allowUnknown: boolean) {}

  add(code: ManifestIssueCode, path: string, message: string): void {
    this.issues.push({ code, path, message })
  }

  object(v: unknown, path: string): Obj | null {
    if (v === undefined) {
      this.add('missing', path, `${path || 'manifest'} is required`)
      return null
    }
    if (!isObj(v)) {
      this.add('not_object', path, `${path || 'manifest'} must be an object`)
      return null
    }
    return v
  }

  exact(o: Obj, path: string, allowed: readonly string[]): void {
    if (this.allowUnknown) return
    for (const key of Object.keys(o)) {
      if (!allowed.includes(key)) this.add('unknown_key', join(path, key), `unknown key "${key}" in ${path || 'manifest'}`)
    }
  }

  str(o: Obj, key: string, path: string, opts: { optional?: boolean; nonEmpty?: boolean } = {}): string | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      if (!opts.optional) this.add('missing', p, `${p} is required`)
      return undefined
    }
    if (typeof v !== 'string') {
      this.add('type', p, `${p} must be a string`)
      return undefined
    }
    if (opts.nonEmpty && v.trim() === '') {
      this.add('range', p, `${p} must not be empty`)
      return undefined
    }
    return v
  }

  num(o: Obj, key: string, path: string, opts: { min?: number; positive?: boolean } = {}): number | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      this.add('missing', p, `${p} is required`)
      return undefined
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.add('type', p, `${p} must be a finite number`)
      return undefined
    }
    if (opts.positive && !(v > 0)) {
      this.add('range', p, `${p} must be greater than 0`)
      return undefined
    }
    if (opts.min !== undefined && v < opts.min) {
      this.add('range', p, `${p} must be at least ${opts.min}`)
      return undefined
    }
    return v
  }

  nullableNum(o: Obj, key: string, path: string): number | null | undefined {
    const v = o[key]
    if (v === null) return null
    return this.num(o, key, path)
  }

  bool(o: Obj, key: string, path: string): boolean | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      this.add('missing', p, `${p} is required`)
      return undefined
    }
    if (typeof v !== 'boolean') {
      this.add('type', p, `${p} must be true or false`)
      return undefined
    }
    return v
  }

  array(o: Obj, key: string, path: string): unknown[] | null {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      this.add('missing', p, `${p} is required`)
      return null
    }
    if (!Array.isArray(v)) {
      this.add('type', p, `${p} must be an array`)
      return null
    }
    return v
  }

  oneOf<T extends string>(o: Obj, key: string, path: string, allowed: readonly T[]): T | undefined {
    const v = this.str(o, key, path)
    if (v === undefined) return undefined
    if (!(allowed as readonly string[]).includes(v)) {
      this.add('enum', join(path, key), `${join(path, key)} must be one of ${allowed.join(', ')} (got "${v}")`)
      return undefined
    }
    return v as T
  }
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

function readVideo(r: Reader, root: Obj): ManifestVideo | undefined {
  const o = r.object(root.video, 'video')
  if (!o) return undefined
  r.exact(o, 'video', ['file', 'sha256', 'width', 'height', 'fps', 'duration'])
  const file = r.str(o, 'file', 'video', { nonEmpty: true })
  const sha256 = r.str(o, 'sha256', 'video')
  if (sha256 !== undefined && !/^[0-9a-f]{64}$/i.test(sha256)) r.add('range', 'video.sha256', 'video.sha256 must be 64 hex characters')
  const width = r.num(o, 'width', 'video', { positive: true })
  const height = r.num(o, 'height', 'video', { positive: true })
  const fps = r.num(o, 'fps', 'video', { positive: true })
  const duration = r.num(o, 'duration', 'video', { positive: true })
  if (file === undefined || sha256 === undefined || width === undefined || height === undefined || fps === undefined || duration === undefined) return undefined
  return { file, sha256: sha256.toLowerCase(), width, height, fps, duration }
}

function readNames(r: Reader, root: Obj, key: string): string[] | undefined {
  const arr = r.array(root, key, '')
  if (!arr) return undefined
  const bad = arr.findIndex((t) => typeof t !== 'string' || t.trim() === '')
  if (bad >= 0) {
    r.add('type', `${key}[${bad}]`, `${key} must be non-empty strings`)
    return undefined
  }
  return arr as string[]
}

function readBeats(r: Reader, root: Obj): ManifestBeat[] | undefined {
  const arr = r.array(root, 'beats', '')
  if (!arr) return undefined
  const out: ManifestBeat[] = []
  arr.forEach((item, i) => {
    const path = `beats[${i}]`
    const o = r.object(item, path)
    if (!o) return
    r.exact(o, path, ['id', 'role', 'start', 'end'])
    const id = r.str(o, 'id', path, { nonEmpty: true })
    const role = r.oneOf(o, 'role', path, BEAT_ROLES)
    const start = r.num(o, 'start', path, { min: 0 })
    const end = r.num(o, 'end', path)
    if (start !== undefined && end !== undefined && !(end > start)) r.add('range', `${path}.end`, `${path}.end must be after start`)
    if (id !== undefined && role !== undefined && start !== undefined && end !== undefined) out.push({ id, role, start, end })
  })
  if (arr.length === 0) r.add('range', 'beats', 'beats must not be empty')
  let lastRank = -1
  let lastStart = -1
  out.forEach((b, i) => {
    const rank = BEAT_ROLES.indexOf(b.role)
    if (rank < lastRank) r.add('order', `beats[${i}].role`, `beat "${b.id}" (${b.role}) is out of order; roles run ${BEAT_ROLES.join(', ')}`)
    if (b.start < lastStart) r.add('order', `beats[${i}].start`, `beat "${b.id}" starts before the beat before it`)
    lastRank = Math.max(lastRank, rank)
    lastStart = Math.max(lastStart, b.start)
  })
  return out
}

function readTexts(r: Reader, root: Obj): ManifestText[] | undefined {
  const arr = r.array(root, 'texts', '')
  if (!arr) return undefined
  const out: ManifestText[] = []
  arr.forEach((item, i) => {
    const path = `texts[${i}]`
    const o = r.object(item, path)
    if (!o) return
    r.exact(o, path, ['text', 'start', 'end', 'box', 'kind'])
    const text = r.str(o, 'text', path, { nonEmpty: true })
    const start = r.num(o, 'start', path, { min: 0 })
    const end = r.num(o, 'end', path)
    if (start !== undefined && end !== undefined && !(end > start)) r.add('range', `${path}.end`, `${path}.end must be after start`)
    const kind = r.oneOf(o, 'kind', path, TEXT_KINDS)
    const b = r.object(o.box, `${path}.box`)
    let box: ManifestBox | undefined
    if (b) {
      r.exact(b, `${path}.box`, ['x', 'y', 'w', 'h'])
      const x = r.num(b, 'x', `${path}.box`)
      const y = r.num(b, 'y', `${path}.box`)
      const w = r.num(b, 'w', `${path}.box`, { min: 0 })
      const h = r.num(b, 'h', `${path}.box`, { min: 0 })
      if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) box = { x, y, w, h }
    }
    if (text !== undefined && start !== undefined && end !== undefined && kind !== undefined && box) out.push({ text, start, end, box, kind })
  })
  return out
}

function readNumbers(r: Reader, root: Obj): ManifestNumber[] | undefined {
  const arr = r.array(root, 'numbers', '')
  if (!arr) return undefined
  const out: ManifestNumber[] = []
  arr.forEach((item, i) => {
    const path = `numbers[${i}]`
    const o = r.object(item, path)
    if (!o) return
    r.exact(o, path, ['onScreen', 'source', 'window', 'geography', 'definition'])
    const onScreen = r.str(o, 'onScreen', path, { nonEmpty: true })
    // The four trace fields may be absent here: check 9 reports an absent or
    // blank one by name, which is more useful than rejecting the whole manifest.
    const row: ManifestNumber = { onScreen: onScreen ?? '' }
    for (const key of ['source', 'window', 'geography', 'definition'] as const) {
      const v = r.str(o, key, path, { optional: true })
      if (v !== undefined) row[key] = v
    }
    if (onScreen !== undefined) out.push(row)
  })
  return out
}

function readVoice(r: Reader, root: Obj): ManifestVoice | null | undefined {
  if (root.voice === null) return null
  const o = r.object(root.voice, 'voice')
  if (!o) return undefined
  r.exact(o, 'voice', ['engine', 'model', 'voiceId', 'words'])
  const engine = r.str(o, 'engine', 'voice', { nonEmpty: true })
  const model = r.str(o, 'model', 'voice', { nonEmpty: true })
  const voiceId = r.str(o, 'voiceId', 'voice', { nonEmpty: true })
  const arr = r.array(o, 'words', 'voice')
  const words: ManifestVoiceWord[] = []
  arr?.forEach((item, i) => {
    const path = `voice.words[${i}]`
    const w = r.object(item, path)
    if (!w) return
    r.exact(w, path, ['word', 'start', 'end'])
    const word = r.str(w, 'word', path, { nonEmpty: true })
    const start = r.num(w, 'start', path, { min: 0 })
    const end = r.num(w, 'end', path)
    if (start !== undefined && end !== undefined && end < start) r.add('range', `${path}.end`, `${path}.end must not be before start`)
    if (word !== undefined && start !== undefined && end !== undefined) words.push({ word, start, end })
  })
  if (arr && arr.length === 0) r.add('range', 'voice.words', 'voice.words must not be empty when voice is set')
  if (engine === undefined || model === undefined || voiceId === undefined || !arr) return undefined
  return { engine, model, voiceId, words }
}

function readCaptions(r: Reader, root: Obj): ManifestCaption[] | undefined {
  const arr = r.array(root, 'captions', '')
  if (!arr) return undefined
  const out: ManifestCaption[] = []
  arr.forEach((item, i) => {
    const path = `captions[${i}]`
    const o = r.object(item, path)
    if (!o) return
    r.exact(o, path, ['text', 'start', 'end', 'words'])
    const text = r.str(o, 'text', path, { nonEmpty: true })
    const start = r.num(o, 'start', path, { min: 0 })
    const end = r.num(o, 'end', path)
    if (start !== undefined && end !== undefined && end < start) r.add('range', `${path}.end`, `${path}.end must not be before start`)
    const idx = r.array(o, 'words', path)
    let words: number[] | undefined
    if (idx) {
      const bad = idx.findIndex((n) => !Number.isInteger(n) || (n as number) < 0)
      if (bad >= 0) r.add('type', `${path}.words[${bad}]`, `${path}.words must hold non-negative integer indices into voice.words`)
      else words = idx as number[]
    }
    if (text !== undefined && start !== undefined && end !== undefined && words) out.push({ text, start, end, words })
  })
  return out
}

function readAudio(r: Reader, root: Obj): ManifestAudio | undefined {
  const o = r.object(root.audio, 'audio')
  if (!o) return undefined
  r.exact(o, 'audio', ['lufs', 'truePeakDb', 'silent'])
  const lufs = r.nullableNum(o, 'lufs', 'audio')
  const truePeakDb = r.nullableNum(o, 'truePeakDb', 'audio')
  const silent = r.bool(o, 'silent', 'audio')
  if (lufs === undefined || truePeakDb === undefined || silent === undefined) return undefined
  return { lufs, truePeakDb, silent }
}

function readEndcard(r: Reader, root: Obj): ManifestEndcard | null | undefined {
  if (root.endcard === null) return null
  const o = r.object(root.endcard, 'endcard')
  if (!o) return undefined
  r.exact(o, 'endcard', ['start', 'quality', 'local', 'service', 'call', 'out'])
  const vals = ['start', 'quality', 'local', 'service', 'call', 'out'].map((k) => r.num(o, k, 'endcard', { min: 0 }))
  if (vals.some((v) => v === undefined)) return undefined
  const [start, quality, local, service, call, out] = vals as number[]
  return { start, quality, local, service, call, out }
}

function readLoop(r: Reader, root: Obj): ManifestLoop | null | undefined {
  if (root.loop === null) return null
  const o = r.object(root.loop, 'loop')
  if (!o) return undefined
  r.exact(o, 'loop', ['seconds'])
  const seconds = r.num(o, 'seconds', 'loop', { positive: true })
  return seconds === undefined ? undefined : { seconds }
}

/** Validate an already-parsed JSON value as a render manifest. */
export function parseManifest(raw: unknown, opts: ParseOptions = {}): ManifestParse {
  const r = new Reader(opts.allowUnknownKeys === true)
  if (!isObj(raw)) return { ok: false, errors: [{ code: 'not_object', path: '', message: 'manifest must be a JSON object' }] }
  r.exact(raw, '', [
    'factory', 'manifestVersion', 'video', 'videoType', 'techniques', 'beats', 'texts', 'numbers',
    'voice', 'captions', 'audio', 'endcard', 'loop', 'builtBy', 'briefTechniques',
  ])

  const factory = r.str(raw, 'factory', '', { nonEmpty: true })
  const manifestVersion = r.num(raw, 'manifestVersion', '')
  if (manifestVersion !== undefined && manifestVersion !== MANIFEST_VERSION) {
    r.add('range', 'manifestVersion', `manifestVersion must be ${MANIFEST_VERSION} (got ${manifestVersion})`)
  }
  const video = readVideo(r, raw)
  const videoType = r.str(raw, 'videoType', '', { nonEmpty: true })
  const techniques = readNames(r, raw, 'techniques')
  const briefTechniques = 'briefTechniques' in raw ? readNames(r, raw, 'briefTechniques') : undefined
  const beats = readBeats(r, raw)
  const texts = readTexts(r, raw)
  const numbers = readNumbers(r, raw)
  const voice = 'voice' in raw ? readVoice(r, raw) : (r.add('missing', 'voice', 'voice is required (null for a film with no voiceover)'), undefined)
  const captions = readCaptions(r, raw)
  const audio = readAudio(r, raw)
  const endcard = 'endcard' in raw ? readEndcard(r, raw) : (r.add('missing', 'endcard', 'endcard is required (null only for a type with no end card)'), undefined)
  const loop = 'loop' in raw ? readLoop(r, raw) : (r.add('missing', 'loop', 'loop is required (null only for a type with no loop)'), undefined)
  const builtBy = r.str(raw, 'builtBy', '', { optional: true, nonEmpty: true })

  if (r.issues.length > 0) return { ok: false, errors: r.issues }
  const manifest: Manifest = {
    factory: factory as string,
    manifestVersion: manifestVersion as number,
    video: video as ManifestVideo,
    videoType: videoType as string,
    techniques: techniques as string[],
    beats: beats as ManifestBeat[],
    texts: texts as ManifestText[],
    numbers: numbers as ManifestNumber[],
    voice: voice as ManifestVoice | null,
    captions: captions as ManifestCaption[],
    audio: audio as ManifestAudio,
    endcard: endcard as ManifestEndcard | null,
    loop: loop as ManifestLoop | null,
  }
  if (builtBy !== undefined) manifest.builtBy = builtBy
  if (briefTechniques !== undefined) manifest.briefTechniques = briefTechniques
  return { ok: true, manifest }
}

/** Parse manifest JSON text. A syntax error comes back as a `json` issue. */
export function parseManifestJson(text: string, opts: ParseOptions = {}): ManifestParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [{ code: 'json', path: '', message: `manifest is not valid JSON: ${(e as Error).message}` }] }
  }
  return parseManifest(raw, opts)
}

/** One line per issue, for CLI output and check details. */
export function formatManifestIssues(issues: readonly ManifestIssue[], limit = 8): string {
  const shown = issues.slice(0, limit).map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
  const more = issues.length > limit ? `; and ${issues.length - limit} more` : ''
  return shown.join('; ') + more
}
