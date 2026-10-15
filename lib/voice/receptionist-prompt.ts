/**
 * Voice receptionist copy. Persona and guardrails live in lib/sarah —
 * this file only re-exports them so the SIP session does not fork a second
 * prompt. Counsel Matter #3 greeting is verbatim via sarahGreeting('voice').
 */
import { buildSarahSystemPrompt, sarahGreeting } from '@/lib/sarah/persona'
import { RECORDING_OBJECTION_EN, SARAH_NAME } from '@/lib/sarah/scripts'

const NAME = (process.env.RECEPTIONIST_NAME ?? SARAH_NAME).trim() || SARAH_NAME

/** Counsel inbound greeting. Played by Sarah after the Twilio recording notice. */
export const RECEPTIONIST_GREETING = sarahGreeting('voice')

/** Spoken by Twilio before conference record starts (ORS 165.540 + two-party states). */
export const RECEPTIONIST_RECORDING_NOTICE =
  "This call is recorded and transcribed. Thanks for calling Ryan Realty, this is Sarah, Matt's assistant."

export const RECEPTIONIST_PROMPT = buildSarahSystemPrompt({ channel: 'voice' })

export function transferFailedGreeting(who: string): string {
  const n = who === 'rebecca' ? 'Rebecca' : who === 'paul' ? 'Paul' : 'Matt'
  return `Sorry, ${n} wasn't able to pick up. I'd be happy to take a message and make sure ${n} gets it. What's your name?`
}

export const RECORDING_OBJECTION_LINE = RECORDING_OBJECTION_EN
export { NAME as RECEPTIONIST_DISPLAY_NAME }
