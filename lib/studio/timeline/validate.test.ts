import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findNumber, formatIssues, parseBrief, parseTimeline } from './validate'

const repo = join(__dirname, '..', '..', '..')
const read = (p: string) => JSON.parse(readFileSync(join(repo, p), 'utf8'))
const sampleTimeline = () => read('lib/studio/timeline/fixtures/bend-mos.timeline.json')
const sampleBrief = () => read('lib/studio/timeline/fixtures/bend-mos.brief.json')

const issuesOf = (raw: unknown) => {
  const r = parseTimeline(raw)
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`)
}

describe('parseTimeline', () => {
  it("reads today's timeline unchanged (the ryan-studio pass fixture)", () => {
    const legacy = read('.claude/skills/ryan-studio/tools/tests/fixtures/pass.timeline.json')
    const r = parseTimeline(legacy)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.beats.map((b) => b.role)).toEqual(['hook', 'intro', 'body', 'payoff', 'endcard'])
    expect(r.value.beats[0]).toMatchObject({ text: 'UNDER ASKING', number: '69%' })
    expect(r.value.beats[0].boxes).toHaveLength(1)
  })

  it('reads the extended sample: footage, scene, cards, voice, cta, score', () => {
    const r = parseTimeline(sampleTimeline())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.beats[0].footage?.src).toMatch(/^https:\/\//)
    expect(r.value.beats[0].cards?.[0]).toMatchObject({ kind: 'number', number: 'bend_sfr_mos' })
    expect(r.value.beats[1].scene).toMatchObject({ kind: 'meter_fill_verdict', number: 'bend_sfr_mos' })
    expect(r.value.voice).toMatchObject({ voice: 'ellen', start: 0.25, display: { 'three and a half': '3.5' } })
    expect(r.value.cta).toMatchObject({ kind: 'send_invite', start: 8.7, end: 12.2 })
    expect(r.value.beats[1].scene?.show_value).toBe(false)
    expect(r.value.score).toBe('measured')
  })

  it('refuses unknown keys, so a typo never drops a beat\'s picture', () => {
    const t = sampleTimeline()
    t.beats[0].fotage = t.beats[0].footage
    expect(issuesOf(t)).toContainEqual(expect.stringMatching(/beats\[0\]\.fotage: unknown key/))
  })

  it('names every broken rule with its path', () => {
    const t = sampleTimeline()
    t.fps = 24
    t.beats[1].role = 'boss'
    t.beats[2].start = 7.0
    t.beats[0].cards[0].kind = 'banner'
    t.voice.script = 'Bend has 3.5 months <break time="1s"/> of homes — for sale.'
    t.voice.voice = 'brian'
    t.cta.end = 14
    t.cta.text = 'Call us today.'
    const issues = issuesOf(t)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^fps: every Studio film is 30 fps/),
        expect.stringMatching(/^beats\[1\]\.role: must be one of hook, intro, body, payoff, endcard/),
        expect.stringMatching(/^beats\[0\]\.cards\[0\]\.kind: must be one of/),
        expect.stringMatching(/^voice\.script: .*em or en dash/),
        expect.stringMatching(/^voice\.script: ElevenLabs v3 takes no <break> tags/),
        expect.stringMatching(/^voice\.script: .*no digits/),
        expect.stringMatching(/^voice\.voice: must be one of ellen, victoria/),
        expect.stringMatching(/^cta\.end: the call to action runs into the end card/),
        expect.stringMatching(/^cta\.text: a send-invite line/),
      ]),
    )
  })

  it('refuses overlapping beats, a hook that is not first, and an end card that is not last', () => {
    const t = sampleTimeline()
    t.beats[2].start = 5.5
    expect(issuesOf(t)).toContainEqual(expect.stringMatching(/starts at 5.5s, before "supply" ends/))
    const u = sampleTimeline()
    u.beats = [u.beats[1], u.beats[0], ...u.beats.slice(2)]
    expect(issuesOf(u)).toContainEqual(expect.stringMatching(/^beats\[0\]\.role: the first beat is the hook/))
    const v = sampleTimeline()
    v.beats.push({ id: 'after', role: 'payoff', start: 15.25, end: 19 })
    expect(issuesOf(v)).toContainEqual(expect.stringMatching(/the end card is the last beat/))
  })

  it('locks the end card: no footage, scene or cards on it', () => {
    const t = sampleTimeline()
    t.beats[3].footage = { src: 'clip.mp4' }
    expect(issuesOf(t)).toContainEqual(expect.stringMatching(/the end card is locked/))
  })

  it('a question card ends with a question mark, and footage URLs are https', () => {
    const t = sampleTimeline()
    t.beats[0].cards = [{ kind: 'question', text: 'Shopping in Bend' }, { kind: 'turn', text: 'Here is the turn' }]
    t.beats[0].footage.src = 'http://example.com/clip.mp4'
    const issues = issuesOf(t)
    expect(issues).toContainEqual(expect.stringMatching(/ends with a question mark/))
    expect(issues).toContainEqual(expect.stringMatching(/a URL must be https/))
  })

  it('keeps figures off display words: a digit in a text card is refused', () => {
    const t = sampleTimeline()
    t.beats[2].cards = [{ kind: 'text', text: 'Down 45% this year' }]
    expect(issuesOf(t)).toContainEqual(expect.stringMatching(/^beats\[2\]\.cards\[0\]\.text: has a digit/))
  })

  it('formats issues one per line', () => {
    expect(formatIssues([{ path: 'beats[0].end', message: 'is required' }])).toBe('  - beats[0].end: is required')
  })
})

describe('parseBrief', () => {
  it('reads the sample brief and finds a number by key or by what is on screen', () => {
    const r = parseBrief(sampleBrief())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.video_type).toBe('buyer_ad')
    expect(findNumber(r.value, 'bend_sfr_mos')?.on_screen).toBe('3.5')
    expect(findNumber(r.value, '3.5')?.key).toBe('bend_sfr_mos')
    expect(findNumber(r.value, 'nope')).toBeUndefined()
    expect(r.value.numbers[0].citation).toMatchObject({ table: 'market_metric (via getMarketPulse overlay)' })
  })

  it('refuses a number row missing any of its trace, and a brief with no techniques', () => {
    const b = sampleBrief()
    delete b.numbers[0].window
    b.techniques = []
    const r = parseBrief(b)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const issues = r.issues.map((i) => `${i.path}: ${i.message}`)
    expect(issues).toContainEqual('numbers[0].window: is required')
    expect(issues).toContainEqual(expect.stringMatching(/^techniques: is required/))
  })
})
