/**
 * The runner: steps in order, stamps that must still hold, the caps, and the
 * refusals before anything runs. Everything runs on the harness's fakes (no
 * network, no paid voice, no browser, no ffmpeg, no git of this checkout).
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT } from '../../studio/qa/thresholds'
import { ruleFor } from './classify'
import type { RunContext } from './context'
import { runStep, runSteps, type RunOptions } from './run'
import { rulesVersion } from './rules-version'
import { hashFile } from './canonical'
import { readStamp } from './stamp'
import { STEP_DEFS } from './steps/index'
import { CLIP_PART } from './steps/stills'
import { baseFilm, fakeVoiceProvider, makeHarness, type Harness } from './test-harness'
import { filmVoice, paidVoiceRefused } from './steps/voice'

const OK = () => ({ ok: true as const, head: 'a'.repeat(40), main: 'a'.repeat(40) })

function options(h: Harness, over: Partial<RunOptions> = {}): RunOptions {
  return {
    briefPath: h.briefPath, timelinePath: h.timelinePath, root: h.dir, outRoot: h.outRoot, deps: h.deps, freshness: OK,
    claims: h.claims, ledgerPath: h.ledgerPath, gitHead: () => 'f'.repeat(40), machine: 'test-machine', builder: 'claude', allowUnbuilt: ['animatic'], ...over,
  }
}

const SLUG = 'bend-go-in-with-a-plan'
const stamp = (h: Harness, step: Parameters<typeof readStamp>[2]) => {
  const r = readStamp(h.outRoot, SLUG, step)
  if (!r.ok) throw new Error(`no stamp for ${step}: ${r.detail}`)
  return r.stamp
}

/** Count the paid voice's calls. */
function countVoice(h: Harness): { n: number } {
  const calls = { n: 0 }
  const inner = fakeVoiceProvider(1)
  h.deps.render.voiceProvider = (req) => {
    calls.n++
    return inner(req)
  }
  return calls
}

describe('runSteps', () => {
  it('runs every step in order and leaves a stamp for each, then stops at certify: nothing can ship', async () => {
    const h = makeHarness()
    const r = await runSteps(options(h))
    expect(r.ok).toBe(false)
    expect(r.refusedAt).toBe('certify')
    expect(r.problems[0].problem).toMatch(/step certify is not built yet: CONTENT_PROCESS\.md build order step 3/)
    expect(r.outcomes.map((o) => [o.step, o.action])).toEqual([
      ['brief', 'ran'], ['voice', 'ran'], ['stills', 'ran'], ['board', 'ran'], ['animatic', 'ran'], ['motion', 'ran'], ['master', 'ran'], ['certify', 'refused'],
    ])
    const dir = join(h.outRoot, 'studio', SLUG, 'stamps')
    expect(readdirSync(dir).sort()).toEqual(['animatic.json', 'attempts.jsonl', 'board.json', 'brief.json', 'master.json', 'motion.json', 'stills.json', 'voice.json'])
    expect(existsSync(join(dir, 'certify.json'))).toBe(false)
  })

  it('records who, where, on which commit and under which rules, and logs an unbuilt step it was allowed past', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'motion' }))
    const brief = stamp(h, 'brief')
    expect(brief).toMatchObject({ step: 'brief', slug: SLUG, verdict: 'pass', builder: 'claude', machine: 'test-machine', gitHead: 'f'.repeat(40), rulesVersion: rulesVersion(), problems: [], status: 'built' })
    expect(brief.inputsSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(stamp(h, 'animatic')).toMatchObject({ verdict: 'pass', status: 'not built', allowUnbuilt: true })
    expect(stamp(h, 'motion')).toMatchObject({ verdict: 'pass', status: 'not needed' })
  })

  it('stops after the step named by --to', async () => {
    const h = makeHarness()
    const r = await runSteps(options(h, { to: 'stills' }))
    expect(r.ok).toBe(true)
    expect(r.outcomes.map((o) => o.step)).toEqual(['brief', 'voice', 'stills'])
    expect(existsSync(join(h.outRoot, 'studio', SLUG, 'stamps', 'board.json'))).toBe(false)
  })

  it('resumes: a second run finds every stamp still holds and runs nothing, and the paid voice was called once', async () => {
    const h = makeHarness()
    const voice = countVoice(h)
    await runSteps(options(h, { to: 'master' }))
    expect(voice.n).toBe(1)
    const again = await runSteps(options(h, { to: 'master' }))
    expect(again.ok).toBe(true)
    expect(again.outcomes.every((o) => o.action === 'valid')).toBe(true)
    expect(voice.n).toBe(1)
  })

  it('stops at the first refusal, writes its stamp with the problems and their rule IDs, and runs nothing after it', async () => {
    const h = makeHarness({}, [{ in: 'brief', path: 'caption', set: 'Nestled in Bend, 3.5 months of homes for sale.' }])
    const voice = countVoice(h)
    const r = await runSteps(options(h))
    expect(r.refusedAt).toBe('brief')
    expect(r.outcomes.map((o) => o.step)).toEqual(['brief'])
    expect(voice.n).toBe(0)
    const s = stamp(h, 'brief')
    expect(s.verdict).toBe('fail')
    const banned = s.problems.find((p) => /Banned phrase "nestled"/.test(p.problem))
    expect(banned?.rule).toBe(ruleFor(banned!.problem)?.id)
    expect(banned?.rule).toBeTruthy()
    expect(existsSync(join(h.outRoot, 'studio', SLUG, 'stamps', 'voice.json'))).toBe(false)
  })

  it('re-runs from the first step whose stamp no longer holds when the film changes, and counts the boards', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'board' }))
    const timeline = JSON.parse(readFileSync(h.timelinePath, 'utf8'))
    timeline.beats[2].scene.eyebrow = 'Bend, Oregon'
    writeFileSync(h.timelinePath, JSON.stringify(timeline, null, 2))
    const r = await runSteps(options(h, { to: 'board' }))
    expect(r.outcomes.map((o) => [o.step, o.action])).toEqual([['brief', 'ran'], ['voice', 'ran'], ['stills', 'ran'], ['board', 'ran']])
    expect(h.claims.attempts(SLUG).filter((a) => a.step === 'board').length).toBe(2)
    expect(stamp(h, 'board').attempt).toBe(2)
  })

  it('stops a job at 3 boards however it got there', async () => {
    const h = makeHarness()
    for (let i = 1; i <= 3; i++) {
      const timeline = JSON.parse(readFileSync(h.timelinePath, 'utf8'))
      timeline.beats[2].scene.eyebrow = `Bend ${'x'.repeat(i)}`
      writeFileSync(h.timelinePath, JSON.stringify(timeline, null, 2))
      expect((await runSteps(options(h, { to: 'board' }))).ok).toBe(true)
    }
    const timeline = JSON.parse(readFileSync(h.timelinePath, 'utf8'))
    timeline.beats[2].scene.eyebrow = 'Bend again'
    writeFileSync(h.timelinePath, JSON.stringify(timeline, null, 2))
    const fourth = await runSteps(options(h, { to: 'board' }))
    expect(fourth.refusedAt).toBe('board')
    expect(fourth.problems[0].problem).toMatch(/already spent its 3 boards/)
  })

  it('refuses an unbuilt animatic unless the person allows it, and writes the failing stamp', async () => {
    const h = makeHarness()
    const r = await runSteps(options(h, { to: 'animatic', allowUnbuilt: [] }))
    expect(r.refusedAt).toBe('animatic')
    expect(stamp(h, 'animatic')).toMatchObject({ verdict: 'fail', status: 'not built' })
    expect(stamp(h, 'animatic').allowUnbuilt).toBeUndefined()
  })

  it('refuses before anything when the checkout is behind main, and writes nothing', async () => {
    const h = makeHarness()
    const r = await runSteps(options(h, { freshness: () => ({ ok: false, problem: 'this checkout is behind origin/main (main has 2 commit(s) HEAD does not)' }) }))
    expect(r.refusedAt).toBe('brief')
    expect(r.problems[0].problem).toMatch(/behind origin\/main/)
    expect(existsSync(join(h.outRoot, 'studio'))).toBe(false)
  })

  it('refuses a brief with no video type: only a video has a factory today', async () => {
    const h = makeHarness()
    writeFileSync(h.briefPath, JSON.stringify({ title: 'a post' }))
    const r = await runSteps(options(h))
    expect(r.problems[0].problem).toMatch(/names no video_type: only a video has a factory today/)
  })

  it('refuses unreadable files and an unknown step with a plain reason', async () => {
    const h = makeHarness()
    expect((await runSteps(options(h, { briefPath: join(h.dir, 'nope.json') }))).problems[0].problem).toMatch(/could not read .*nope\.json/)
    expect((await runSteps(options(h, { to: 'dance' as never }))).problems[0].problem).toMatch(/there is no step "dance"/)
  })

  it('lets a later run pass the steps the person allows, in the stamp, for motion as well', async () => {
    const base = baseFilm()
    base.brief.footage.push({ kind: 'imagine_plate', path: 'imagine/plate-1.mp4', rights: 'generated_own', source: 'imagine_subscription' })
    const h = makeHarness()
    writeFileSync(h.briefPath, JSON.stringify(base.brief, null, 2))
    expect((await runSteps(options(h, { to: 'motion' }))).refusedAt).toBe('motion')
    const r = await runSteps(options(h, { to: 'motion', allowUnbuilt: ['animatic', 'motion'] }))
    expect(r.ok).toBe(true)
    expect(stamp(h, 'motion')).toMatchObject({ status: 'not built', allowUnbuilt: true })
  })
})

describe('runStep: one step, with every step before it still holding', () => {
  it('refuses a step whose predecessor has not run', async () => {
    const h = makeHarness()
    const r = await runStep(options(h), 'stills')
    expect(r.refusedAt).toBe('stills')
    expect(r.problems[0].problem).toBe('step brief has not run: run step brief first')
  })

  it('refuses with "the brief changed since step brief passed" after one word of the script changes', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'brief' }))
    const brief = JSON.parse(readFileSync(h.briefPath, 'utf8'))
    brief.spec_rules.voiceover.script = brief.spec_rules.voiceover.script.replace('Send this', 'Pass this')
    writeFileSync(h.briefPath, JSON.stringify(brief, null, 2))
    for (const step of ['voice', 'stills', 'board'] as const) {
      const r = await runStep(options(h), step)
      expect(r.problems[0].problem, step).toBe('the brief changed since step brief passed: run step brief again')
    }
  })

  it('refuses when a file a step read has changed: the technique registry, the ledger, a clip', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'stills' }))
    writeFileSync(h.ledgerPath, `${JSON.stringify({ sha256: 'a'.repeat(64), videoType: 'listing', hookDevice: 'x', sceneSet: ['y'], techniques: [], checkedAt: '2026-10-01T00:00:00.000Z' })}\n`)
    const r = await runStep(options(h), 'board')
    expect(r.problems[0].problem).toBe('the file ledger changed since step brief passed: run step brief again')
  })

  it('refuses when the rules changed since a step passed', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'brief' }))
    const r = await runStep(options(h, { rulesVersion: 'e'.repeat(64) }), 'voice')
    expect(r.problems[0].problem).toMatch(/the rules changed since step brief passed .*run step brief again/)
  })

  it('refuses a step whose predecessor did not pass, naming why', async () => {
    const h = makeHarness({}, [{ in: 'brief', path: 'caption', set: 'Nestled in Bend, 3.5 months of homes for sale.' }])
    await runSteps(options(h, { to: 'brief' }))
    const r = await runStep(options(h), 'voice')
    expect(r.problems[0].problem).toMatch(/step brief did not pass \(.*[Bb]anned phrase "nestled".*\): fix it and run step brief again/)
  })

  it('runs the step when every step before it holds', async () => {
    const h = makeHarness()
    await runSteps(options(h, { to: 'brief' }))
    const r = await runStep(options(h), 'voice')
    expect(r.ok).toBe(true)
    expect(r.outcomes[0]).toMatchObject({ step: 'voice', action: 'ran' })
  })
})

describe('what a stamp records of its inputs', () => {
  it('hashes what a step reads BEFORE it runs, so a file changed during the step does not stand beside a verdict reached on the old one', async () => {
    const h = makeHarness()
    const def = STEP_DEFS.brief!
    const realRun = def.run
    const ledgerBefore = hashFile(h.ledgerPath)
    // A long step during which something else touches a file the step reads (here, the film ledger).
    def.run = async (ctx, stamps) => {
      const r = await realRun(ctx, stamps)
      appendFileSync(h.ledgerPath, '\n')
      return r
    }
    try {
      const first = await runSteps(options(h, { to: 'brief' }))
      expect(first.outcomes[0]).toMatchObject({ step: 'brief', action: 'ran' })
    } finally {
      def.run = realRun
    }
    expect(hashFile(h.ledgerPath)).not.toBe(ledgerBefore)
    // The stamp holds the hash the step read, not the hash of the file as it was left.
    expect(stamp(h, 'brief').inputs['file:ledger']).toBe(ledgerBefore)
    // So the next run does not take the stamp for current: the ledger is not what the verdict was reached on.
    const again = await runSteps(options(h, { to: 'brief' }))
    expect(again.outcomes[0]).toMatchObject({ step: 'brief', action: 'ran' })
    expect(stamp(h, 'brief').inputs['file:ledger']).toBe(hashFile(h.ledgerPath))
    const third = await runSteps(options(h, { to: 'brief' }))
    expect(third.outcomes[0].action).toBe('valid')
  })

  it('re-hashes only what the step itself produces: the clips step stills fetches', async () => {
    const h = makeHarness()
    expect(STEP_DEFS.stills!.produces).toEqual([CLIP_PART])
    for (const [id, def] of Object.entries(STEP_DEFS)) if (id !== 'stills') expect(def!.produces, id).toBeUndefined()
    const r = await runSteps(options(h, { to: 'stills' }))
    expect(r.ok).toBe(true)
    const clips = Object.entries(stamp(h, 'stills').inputs).filter(([part]) => part.startsWith(CLIP_PART))
    expect(clips.length).toBeGreaterThan(0)
    // The clips were missing before the step and are the downloaded files after it, not 'missing'.
    for (const [part, hash] of clips) expect(hash, part).toMatch(/^[0-9a-f]{64}$/)
    // And the stamp holds: a second run takes every step as current.
    const again = await runSteps(options(h, { to: 'stills' }))
    expect(again.outcomes.map((o) => o.action)).toEqual(['valid', 'valid', 'valid'])
  })
})

describe('the voice step re-run from the cache', () => {
  it('reports that the voice came from the cache without changing what later steps depend on', async () => {
    const h = makeHarness()
    const voice = countVoice(h)
    await runSteps(options(h, { to: 'stills' }))
    const first = stamp(h, 'voice')
    expect(first.report).toEqual({ cached: false })
    expect(first.outputs).not.toHaveProperty('cached')
    expect(voice.n).toBe(1)
    // The same script run again (step voice by name): the voice is read from the cache.
    const rerun = await runStep(options(h), 'voice')
    expect(rerun.ok).toBe(true)
    const second = stamp(h, 'voice')
    expect(second.report).toEqual({ cached: true })
    expect(voice.n).toBe(1)
    // What a later step reads is unchanged, so the stamps built on the voice still hold.
    expect(second.outputsSha256).toBe(first.outputsSha256)
    const resumed = await runSteps(options(h, { to: 'stills' }))
    expect(resumed.outcomes.map((o) => o.action)).toEqual(['valid', 'valid', 'valid'])
  })
})

describe('the paid voice', () => {
  const ctxFor = (h: Harness): RunContext => {
    const base = baseFilm()
    return { timeline: base.timeline, cacheDir: join(h.outRoot, 'studio', '.cache'), state: {}, deps: h.deps } as unknown as RunContext
  }

  it('is refused outside step voice: a later step with an empty cache cannot pay for it', async () => {
    const h = makeHarness()
    const voice = countVoice(h)
    await expect(paidVoiceRefused({ text: 'x', voiceId: 'v', model: 'm' })).rejects.toThrow(/runs only in step voice/)
    await expect(filmVoice(ctxFor(h), false)).rejects.toThrow(/runs only in step voice/)
    expect(voice.n).toBe(0)
  })

  it('is paid for once in step voice and then read from the cache by every other step', async () => {
    const h = makeHarness()
    const voice = countVoice(h)
    const paid = await filmVoice(ctxFor(h), true)
    expect(paid?.cached).toBe(false)
    expect(voice.n).toBe(1)
    const later = await filmVoice(ctxFor(h), false)
    expect(later?.cached).toBe(true)
    expect(later?.words).toEqual(paid?.words)
    expect(voice.n).toBe(1)
  })
})

describe('the runner never shells out to npm', () => {
  it('calls the factory\'s own functions, not a command', () => {
    const files = ['run.ts', 'steps/brief.ts', 'steps/voice.ts', 'steps/stills.ts', 'steps/board.ts', 'steps/master.ts', 'steps/unbuilt.ts']
    for (const f of files) {
      // Comments may say "npm run studio"; only code is held to it.
      const text = readFileSync(join(REPO_ROOT, 'lib/content/process', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(/child_process|\bexecSync\b|\bspawnSync\b|npm run/.test(text), f).toBe(false)
    }
  })
})
