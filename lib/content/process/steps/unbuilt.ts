/**
 * Steps phase 1 does not build: animatic and generated motion.
 *
 * The animatic needs the renderer to draw a cheap draft with the real voice
 * under it; the factory cannot yet, so the step records `status: 'not built'`
 * and stops the run unless the person passes `--allow-unbuilt-step animatic`,
 * which is written into the stamp. Generated motion is needed only when the
 * brief lists an Imagine plate; with none, the step has nothing to do. Either
 * way the step is there, so the order is already the real one.
 *
 * (certify and approve are not built either; they always refuse, and the runner
 * says so without writing a stamp: see run.ts.)
 */
import { classify } from '../classify'
import type { RunContext, StepDef, StepResult } from '../context'
import type { StepId } from '../rules'

/** Does the brief list generated footage (an Imagine plate)? Then step motion has work to do. */
export function needsGeneratedMotion(brief: unknown): boolean {
  const footage = (brief as { footage?: unknown } | null)?.footage
  return Array.isArray(footage) && footage.some((f) => f && typeof f === 'object' && ((f as { kind?: unknown }).kind === 'imagine_plate' || (f as { source?: unknown }).source === 'imagine_subscription'))
}

function unbuilt(ctx: RunContext, step: StepId, what: string): StepResult {
  if (ctx.allowUnbuilt.includes(step)) {
    ctx.log(`${step}: not built; passed with --allow-unbuilt-step ${step} (logged in the stamp)`)
    return { problems: [], outputs: { built: false, allowed: true, what }, status: 'not built', allowUnbuilt: true }
  }
  return {
    problems: [classify(`step ${step} is not built yet (${what}); the run stops here. Pass --allow-unbuilt-step ${step} to go past it: that is written into the stamp.`)],
    outputs: { built: false, allowed: false, what },
    status: 'not built',
  }
}

export const animaticStep: StepDef = {
  id: 'animatic',
  async parts() {
    return {}
  },
  async run(ctx) {
    return unbuilt(ctx, 'animatic', 'the renderer cannot draw a cheap draft with the real voice yet')
  },
}

export const motionStep: StepDef = {
  id: 'motion',
  async parts() {
    return {}
  },
  async run(ctx) {
    if (!needsGeneratedMotion(ctx.brief)) return { problems: [], outputs: { built: true, needed: false }, status: 'not needed' }
    return unbuilt(ctx, 'motion', 'generated motion goes through the Imagine web UI by hand; the process does not drive it yet')
  },
}
