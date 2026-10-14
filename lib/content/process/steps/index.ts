/** The steps by name. certify and approve have no definition: they are not built, and the runner says so. */
import type { StepDef } from '../context'
import type { StepId } from '../rules'
import { boardStep } from './board'
import { briefStep } from './brief'
import { masterStep } from './master'
import { stillsStep } from './stills'
import { animaticStep, motionStep } from './unbuilt'
import { voiceStep } from './voice'

export const STEP_DEFS: Partial<Record<StepId, StepDef>> = {
  brief: briefStep,
  voice: voiceStep,
  stills: stillsStep,
  board: boardStep,
  animatic: animaticStep,
  motion: motionStep,
  master: masterStep,
}
