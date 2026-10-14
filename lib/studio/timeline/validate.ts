/**
 * lib/studio/timeline/validate.ts: strict readers for brief.json and timeline.json.
 *
 * Never repairs, never guesses: every problem comes back as one issue with the
 * path that holds it and what to do, and the render does not start. Unknown
 * keys are errors (a typo such as `fotage` must not silently drop a beat's
 * picture). The few legacy timeline keys video_gate reads (duration_s, fps,
 * loop_seam, a beat's text, number and boxes) are accepted as they are today.
 */
import {
  TIMELINE_ROLES,
  type BriefNumber,
  type StudioBrief,
  type Timeline,
  type TimelineBeat,
  type TimelineCard,
  type TimelineCta,
  type TimelineFootage,
  type TimelineScene,
  type TimelineVoice,
} from './types'

export type Issue = { path: string; message: string }

export type Parsed<T> = { ok: true; value: T } | { ok: false; issues: Issue[] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const DASH = /[–—]/

class Reader {
  issues: Issue[] = []
  add(path: string, message: string): void {
    this.issues.push({ path, message })
  }
  exact(o: Obj, path: string, allowed: readonly string[]): void {
    for (const key of Object.keys(o)) {
      if (!allowed.includes(key)) this.add(join(path, key), `unknown key "${key}" (allowed: ${allowed.join(', ')})`)
    }
  }
  str(o: Obj, key: string, path: string, opts: { optional?: boolean; copy?: boolean; words?: boolean } = {}): string | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      if (!opts.optional) this.add(p, 'is required')
      return undefined
    }
    if (typeof v !== 'string' || v.trim() === '') {
      this.add(p, 'must be a non-empty string')
      return undefined
    }
    // Anything a viewer reads: no em or en dash (RULEBOOK §3, VOICE.md).
    if (opts.copy && DASH.test(v)) this.add(p, 'has an em or en dash; use a period, a comma or "to"')
    // Display words are Amboqia, and Amboqia never sits on a number: a figure is a number card.
    if (opts.words && /\d/.test(v)) this.add(p, 'has a digit; a figure goes on a number card (Geist, with its brief.numbers row), never in display words')
    return v
  }
  num(o: Obj, key: string, path: string, opts: { optional?: boolean; min?: number } = {}): number | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      if (!opts.optional) this.add(p, 'is required')
      return undefined
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.add(p, 'must be a finite number of seconds')
      return undefined
    }
    if (opts.min !== undefined && v < opts.min) {
      this.add(p, `must be at least ${opts.min}`)
      return undefined
    }
    return v
  }
  oneOf<T extends string>(o: Obj, key: string, path: string, allowed: readonly T[], optional = false): T | undefined {
    const v = o[key]
    const p = join(path, key)
    if (v === undefined) {
      if (!optional) this.add(p, `is required (one of ${allowed.join(', ')})`)
      return undefined
    }
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
      this.add(p, `must be one of ${allowed.join(', ')} (got ${JSON.stringify(v)})`)
      return undefined
    }
    return v as T
  }
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`
  return path ? `${path}.${key}` : key
}

export function formatIssues(issues: readonly Issue[]): string {
  return issues.map((i) => `  - ${i.path || '(root)'}: ${i.message}`).join('\n')
}

// ---------------------------------------------------------------------------
// timeline.json

function readFootage(r: Reader, raw: unknown, path: string): TimelineFootage | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object { src, in?, move? }')
    return undefined
  }
  r.exact(raw, path, ['src', 'in', 'move'])
  const src = r.str(raw, 'src', path)
  if (src && /^[a-z]+:\/\//i.test(src) && !/^https:\/\//i.test(src)) r.add(join(path, 'src'), 'a URL must be https')
  const inAt = r.num(raw, 'in', path, { optional: true, min: 0 })
  const move = r.oneOf(raw, 'move', path, ['hold', 'pan'] as const, true)
  if (!src) return undefined
  const out: TimelineFootage = { src }
  if (inAt !== undefined) out.in = inAt
  if (move) out.move = move
  return out
}

function readCard(r: Reader, raw: unknown, path: string): TimelineCard | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object with a kind')
    return undefined
  }
  const kind = r.oneOf(raw, 'kind', path, ['text', 'number', 'question', 'turn'] as const)
  switch (kind) {
    case 'text': {
      r.exact(raw, path, ['kind', 'text', 'eyebrow', 'tone'])
      const text = r.str(raw, 'text', path, { copy: true, words: true })
      const eyebrow = r.str(raw, 'eyebrow', path, { optional: true, copy: true })
      const tone = r.oneOf(raw, 'tone', path, ['plain', 'payoff'] as const, true)
      if (!text) return undefined
      return { kind, text, ...(eyebrow ? { eyebrow } : {}), ...(tone ? { tone } : {}) }
    }
    case 'number': {
      r.exact(raw, path, ['kind', 'number', 'eyebrow', 'unit', 'footer'])
      const number = r.str(raw, 'number', path)
      const eyebrow = r.str(raw, 'eyebrow', path, { optional: true, copy: true })
      const unit = r.str(raw, 'unit', path, { optional: true, copy: true, words: true })
      const footer = r.str(raw, 'footer', path, { optional: true, copy: true, words: true })
      if (!number) return undefined
      return { kind, number, ...(eyebrow ? { eyebrow } : {}), ...(unit ? { unit } : {}), ...(footer ? { footer } : {}) }
    }
    case 'question': {
      r.exact(raw, path, ['kind', 'text'])
      const text = r.str(raw, 'text', path, { copy: true, words: true })
      if (text && !text.trim().endsWith('?')) r.add(join(path, 'text'), 'a question card ends with a question mark')
      return text ? { kind, text } : undefined
    }
    case 'turn': {
      r.exact(raw, path, ['kind', 'text'])
      const text = r.str(raw, 'text', path, { copy: true, words: true })
      return text ? { kind, text } : undefined
    }
    default:
      return undefined
  }
}

function readScene(r: Reader, raw: unknown, path: string): TimelineScene | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object { kind, ...params }')
    return undefined
  }
  const kind = r.oneOf(raw, 'kind', path, ['meter_fill_verdict'] as const)
  if (kind !== 'meter_fill_verdict') return undefined
  r.exact(raw, path, ['kind', 'number', 'eyebrow'])
  const number = r.str(raw, 'number', path)
  const eyebrow = r.str(raw, 'eyebrow', path, { optional: true, copy: true })
  if (!number) return undefined
  return { kind, number, ...(eyebrow ? { eyebrow } : {}) }
}

function readBeat(r: Reader, raw: unknown, path: string): TimelineBeat | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object')
    return undefined
  }
  r.exact(raw, path, ['id', 'role', 'start', 'end', 'text', 'number', 'boxes', 'footage', 'scene', 'cards'])
  const id = r.str(raw, 'id', path)
  const role = r.oneOf(raw, 'role', path, TIMELINE_ROLES)
  const start = r.num(raw, 'start', path, { min: 0 })
  const end = r.num(raw, 'end', path)
  if (start !== undefined && end !== undefined && !(end > start)) r.add(join(path, 'end'), `must be after start (${start})`)
  const text = r.str(raw, 'text', path, { optional: true, copy: true })
  let number: string | undefined
  if (raw.number !== undefined && raw.number !== null) {
    if (typeof raw.number === 'string' || typeof raw.number === 'number') number = String(raw.number)
    else r.add(join(path, 'number'), 'must be the figure as shown (a string)')
  }
  let boxes: TimelineBeat['boxes']
  if (raw.boxes !== undefined) {
    if (!Array.isArray(raw.boxes)) r.add(join(path, 'boxes'), 'must be an array')
    else boxes = raw.boxes as TimelineBeat['boxes']
  }
  const footage = raw.footage === undefined ? undefined : readFootage(r, raw.footage, join(path, 'footage'))
  const scene = raw.scene === undefined ? undefined : readScene(r, raw.scene, join(path, 'scene'))
  let cards: TimelineCard[] | undefined
  if (raw.cards !== undefined) {
    if (!Array.isArray(raw.cards)) r.add(join(path, 'cards'), 'must be an array')
    else {
      cards = []
      raw.cards.forEach((c, i) => {
        const card = readCard(r, c, join(join(path, 'cards'), i))
        if (card) cards!.push(card)
      })
    }
  }
  if (role === 'endcard' && (footage || scene || cards)) {
    r.add(path, 'the end card is locked (END_CARD_SPEC): it takes no footage, scene or cards')
  }
  if (id === undefined || role === undefined || start === undefined || end === undefined) return undefined
  const beat: TimelineBeat = { id, role, start, end }
  if (text !== undefined) beat.text = text
  if (number !== undefined) beat.number = number
  if (boxes) beat.boxes = boxes
  if (footage) beat.footage = footage
  if (scene) beat.scene = scene
  if (cards) beat.cards = cards
  return beat
}

function readVoice(r: Reader, raw: unknown, path: string): TimelineVoice | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object { script, voice, display?, start? }')
    return undefined
  }
  r.exact(raw, path, ['script', 'voice', 'display', 'start', 'model', 'seed', 'settings'])
  const script = r.str(raw, 'script', path, { copy: true })
  if (script) {
    if (/<break/i.test(script)) r.add(join(path, 'script'), 'ElevenLabs v3 takes no <break> tags; use ellipses and audio tags')
    if (/\d/.test(script)) r.add(join(path, 'script'), 'ElevenLabs v3 scripts spell numbers out; no digits')
  }
  const voice = r.oneOf(raw, 'voice', path, ['ellen', 'victoria'] as const)
  const start = r.num(raw, 'start', path, { optional: true, min: 0 })
  const model = r.str(raw, 'model', path, { optional: true })
  const seed = r.num(raw, 'seed', path, { optional: true, min: 0 })
  let display: Record<string, string> | undefined
  if (raw.display !== undefined) {
    if (!isObj(raw.display)) r.add(join(path, 'display'), 'must map spoken phrases to on-screen figures')
    else {
      display = {}
      for (const [k, v] of Object.entries(raw.display)) {
        if (typeof v !== 'string' || v.trim() === '') r.add(join(join(path, 'display'), k), 'must be the on-screen figure (a string)')
        else if (DASH.test(v)) r.add(join(join(path, 'display'), k), 'has an em or en dash')
        else display[k] = v
      }
    }
  }
  let settings: TimelineVoice['settings']
  if (raw.settings !== undefined) {
    if (!isObj(raw.settings)) r.add(join(path, 'settings'), 'must be an object')
    else {
      r.exact(raw.settings, join(path, 'settings'), ['stability', 'similarity_boost', 'style', 'speed'])
      settings = {}
      for (const k of ['stability', 'similarity_boost', 'style', 'speed'] as const) {
        const v = r.num(raw.settings, k, join(path, 'settings'), { optional: true, min: 0 })
        if (v !== undefined) settings[k] = v
      }
    }
  }
  if (!script || !voice) return undefined
  const out: TimelineVoice = { script, voice }
  if (display) out.display = display
  if (start !== undefined) out.start = start
  if (model) out.model = model
  if (seed !== undefined) out.seed = seed
  if (settings) out.settings = settings
  return out
}

function readCta(r: Reader, raw: unknown, path: string): TimelineCta | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object { text, start, end, kind?, footage? }')
    return undefined
  }
  r.exact(raw, path, ['text', 'start', 'end', 'kind', 'footage'])
  const text = r.str(raw, 'text', path, { copy: true, words: true })
  const start = r.num(raw, 'start', path, { min: 0 })
  const end = r.num(raw, 'end', path)
  if (start !== undefined && end !== undefined && !(end > start)) r.add(join(path, 'end'), 'must be after start')
  const kind = r.oneOf(raw, 'kind', path, ['send_invite', 'plain'] as const, true)
  const footage = raw.footage === undefined ? undefined : readFootage(r, raw.footage, join(path, 'footage'))
  if (kind !== 'plain' && text && !/\b(send|share)\b/i.test(text)) {
    r.add(join(path, 'text'), 'a send-invite line asks the viewer to send or share the film ("Send this to ..."); or set kind "plain"')
  }
  if (!text || start === undefined || end === undefined) return undefined
  return { text, start, end, kind: kind ?? 'send_invite', ...(footage ? { footage } : {}) }
}

/** Validate a parsed timeline.json. */
export function parseTimeline(raw: unknown): Parsed<Timeline> {
  const r = new Reader()
  if (!isObj(raw)) return { ok: false, issues: [{ path: '', message: 'timeline must be a JSON object' }] }
  r.exact(raw, '', ['duration_s', 'fps', 'loop_seam', 'beats', 'voice', 'cta', 'score'])
  const fps = r.num(raw, 'fps', '', { optional: true })
  if (fps !== undefined && fps !== 30) r.add('fps', 'every Studio film is 30 fps')
  const duration = r.num(raw, 'duration_s', '', { optional: true, min: 0 })
  const loopSeam = r.str(raw, 'loop_seam', '', { optional: true })
  const beats: TimelineBeat[] = []
  if (!Array.isArray(raw.beats)) r.add('beats', 'is required: an array of beats')
  else {
    raw.beats.forEach((b, i) => {
      const beat = readBeat(r, b, `beats[${i}]`)
      if (beat) beats.push(beat)
    })
    if (raw.beats.length === 0) r.add('beats', 'must not be empty')
  }
  const ids = new Set<string>()
  beats.forEach((b, i) => {
    if (ids.has(b.id)) r.add(`beats[${i}].id`, `"${b.id}" is used twice`)
    ids.add(b.id)
    const prev = beats[i - 1]
    if (prev && b.start < prev.end - 1e-6) r.add(`beats[${i}].start`, `beat "${b.id}" starts at ${b.start}s, before "${prev.id}" ends at ${prev.end}s`)
  })
  if (beats.length && beats[0].role !== 'hook') r.add('beats[0].role', 'the first beat is the hook')
  if (beats.length && Math.abs(beats[0].start) > 1e-6) r.add('beats[0].start', 'the hook starts at 0')
  const endIndex = beats.findIndex((b) => b.role === 'endcard')
  if (endIndex >= 0 && endIndex !== beats.length - 1) r.add(`beats[${endIndex}].role`, 'the end card is the last beat')
  let rank = -1
  beats.forEach((b, i) => {
    const k = TIMELINE_ROLES.indexOf(b.role)
    if (k < rank) r.add(`beats[${i}].role`, `"${b.role}" is out of order (${TIMELINE_ROLES.join(', ')})`)
    rank = Math.max(rank, k)
  })
  const voice = raw.voice === undefined ? undefined : readVoice(r, raw.voice, 'voice')
  const cta = raw.cta === undefined ? undefined : readCta(r, raw.cta, 'cta')
  const score = r.oneOf(raw, 'score', '', ['calm', 'measured'] as const, true)
  if (cta && beats.length) {
    const content = beats.filter((b) => b.role !== 'endcard')
    const lastContent = content[content.length - 1]
    const end = beats.find((b) => b.role === 'endcard')
    if (lastContent && cta.start < lastContent.end - 1e-6) r.add('cta.start', `the call to action starts before "${lastContent.id}" ends (${lastContent.end}s)`)
    if (end && cta.end > end.start + 1e-6) r.add('cta.end', `the call to action runs into the end card (${end.start}s); it is its own card before it`)
  }
  if (r.issues.length) return { ok: false, issues: r.issues }
  const timeline: Timeline = { beats }
  if (duration !== undefined) timeline.duration_s = duration
  if (fps !== undefined) timeline.fps = fps
  if (loopSeam) timeline.loop_seam = loopSeam
  if (voice) timeline.voice = voice
  if (cta) timeline.cta = cta
  if (score) timeline.score = score
  return { ok: true, value: timeline }
}

// ---------------------------------------------------------------------------
// brief.json (the parts the renderer reads)

function readNumber(r: Reader, raw: unknown, path: string): BriefNumber | undefined {
  if (!isObj(raw)) {
    r.add(path, 'must be an object')
    return undefined
  }
  const onScreen = r.str(raw, 'on_screen', path, { copy: true })
  const out: Partial<BriefNumber> = { on_screen: onScreen }
  for (const k of ['definition', 'window', 'geography', 'source'] as const) {
    const v = r.str(raw, k, path)
    if (v !== undefined) out[k] = v
  }
  const key = r.str(raw, 'key', path, { optional: true })
  if (key) out.key = key
  const propertyType = r.str(raw, 'property_type', path, { optional: true })
  if (propertyType) out.property_type = propertyType
  if (raw.value !== undefined) out.value = raw.value
  if (raw.hero !== undefined) out.hero = raw.hero === true
  if (raw.citation !== undefined) {
    if (!isObj(raw.citation)) r.add(join(path, 'citation'), 'must be the DAL citation object')
    else out.citation = raw.citation
  }
  if (!onScreen || !out.definition || !out.window || !out.geography || !out.source) return undefined
  return out as BriefNumber
}

/** Validate the brief fields the renderer depends on. video_gate checks the rest of the paperwork. */
export function parseBrief(raw: unknown): Parsed<StudioBrief> {
  const r = new Reader()
  if (!isObj(raw)) return { ok: false, issues: [{ path: '', message: 'brief must be a JSON object' }] }
  const videoType = r.str(raw, 'video_type', '')
  const title = r.str(raw, 'title', '', { copy: true })
  const techniques: string[] = []
  if (!Array.isArray(raw.techniques) || raw.techniques.length === 0) r.add('techniques', 'is required: names from techniques/registry.json')
  else {
    raw.techniques.forEach((t, i) => {
      if (typeof t !== 'string' || !t.trim()) r.add(`techniques[${i}]`, 'must be a technique name')
      else techniques.push(t)
    })
  }
  const numbers: BriefNumber[] = []
  if (!Array.isArray(raw.numbers)) r.add('numbers', 'is required: an array (empty when nothing on screen is a figure)')
  else raw.numbers.forEach((n, i) => {
    const row = readNumber(r, n, `numbers[${i}]`)
    if (row) numbers.push(row)
  })
  const keys = new Map<string, number>()
  numbers.forEach((n, i) => {
    for (const k of new Set([n.key, n.on_screen].filter((x): x is string => Boolean(x)))) {
      if (keys.has(k) && keys.get(k) !== i) r.add(`numbers[${i}]`, `key "${k}" names two rows`)
      keys.set(k, i)
    }
  })
  if (r.issues.length || !videoType || !title) return { ok: false, issues: r.issues }
  return { ok: true, value: { ...(raw as Obj), video_type: videoType, title, techniques, numbers } as StudioBrief }
}

/** The brief row a timeline key names: its `key`, else its `on_screen`. */
export function findNumber(brief: StudioBrief, key: string): BriefNumber | undefined {
  return brief.numbers.find((n) => n.key === key) ?? brief.numbers.find((n) => n.on_screen === key)
}
