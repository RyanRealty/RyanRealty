/**
 * Sarah public panel lock (Matt 2026-10-15).
 *
 * Intent chips, no broker chrome row, one extra public floater allowed
 * (cookie settings, legally required). Sarah's disc is the only marketing FAB.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SARAH_PANEL_GATE = 'ci:sarah-panel'
export const SARAH_PANEL_SCRIPT = 'scripts/check-sarah-panel.mjs'

const PATHS = Object.freeze({
  layout: 'app/layout.tsx',
  sarah: 'components/site/v3/V3SarahAssistant.client.tsx',
  css: 'components/site/v3/V3SarahAssistant.css',
  capture: 'app/actions/sarah-capture.ts',
  flow: 'lib/sarah/intent-flow.ts',
  cookie: 'components/CookieConsentBanner.tsx',
  chrome: 'components/site/v3/V3Chrome.tsx',
  globals: 'app/globals.css',
  provider: 'components/site/providers/RootProvider.tsx',
  publicLayer: 'components/layout/PublicClientLayer.tsx',
})

const INTENT_LABELS = [
  "I'm looking for a home",
  'Thinking of selling',
  "What's my home worth?",
  'I have a question',
]

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function sarahPanelProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const layout = readRel(root, PATHS.layout, files.layout)
  const sarah = readRel(root, PATHS.sarah, files.sarah)
  const css = readRel(root, PATHS.css, files.css)
  const capture = readRel(root, PATHS.capture, files.capture)
  const flow = readRel(root, PATHS.flow, files.flow)
  const cookie = readRel(root, PATHS.cookie, files.cookie)
  const chrome = readRel(root, PATHS.chrome, files.chrome)
  const globals = readRel(root, PATHS.globals, files.globals)
  const provider = readRel(root, PATHS.provider, files.provider)
  const publicLayer = readRel(root, PATHS.publicLayer, files.publicLayer)

  if (layout == null) p.push(`${PATHS.layout}: missing.`)
  else {
    if (!layout.includes('<V3SarahAssistant')) {
      p.push(`${PATHS.layout}: public layout must mount <V3SarahAssistant />.`)
    }
    if (/<V3DogFloater[\s/>]/.test(layout) || layout.includes('<V3PhoneDock')) {
      p.push(`${PATHS.layout}: a second floating dock came back. Sarah is the public FAB.`)
    }
    if (layout.includes('HelpButton')) {
      p.push(`${PATHS.layout}: admin HelpButton must not mount on the public layout.`)
    }
  }

  if (sarah == null) p.push(`${PATHS.sarah}: missing.`)
  else {
    if (/Your broker is/.test(sarah) || sarah.includes('v3-sarah__desk-actions') || sarah.includes('Book a time')) {
      p.push(`${PATHS.sarah}: broker row (Your broker is / Call / Text / Message / Book) must stay out of the chrome.`)
    }
    if (sarah.includes('v3-sarah__desk-who') || sarah.includes('desk.fullName') || /with \{desk\.firstName\}/.test(sarah)) {
      p.push(`${PATHS.sarah}: broker header / broker row must stay out. Offer the assigned broker in conversation.`)
    }
    if (!sarah.includes('SARAH_AVATAR_SRCSET') || !sarah.includes('srcSet')) {
      p.push(`${PATHS.sarah}: launcher avatar must use the 2x/3x srcset.`)
    }
    if (!sarah.includes('scrollToLatest') || !sarah.includes('scrollIntoView')) {
      p.push(`${PATHS.sarah}: messages must auto-scroll to the newest line.`)
    }
    if (!sarah.includes('data-sarah="intent-chips"')) {
      p.push(`${PATHS.sarah}: opening chips must render as data-sarah="intent-chips".`)
    }
    if (!sarah.includes('WEB_BRINGS_YOU_HERE_EN') || !sarah.includes('SARAH_INTENT_CHIPS')) {
      p.push(`${PATHS.sarah}: panel must ask what brings them here and mount the intent chips.`)
    }
    if (!sarah.includes('data-sarah="mic"') || !sarah.includes('mintSarahVoiceToken') || !sarah.includes('startSarahVoiceSession')) {
      p.push(`${PATHS.sarah}: Eve mic must mint a realtime token and start the browser session.`)
    }
    if (sarah.includes('v3-sarah__ai-tag')) {
      p.push(`${PATHS.sarah}: AI strip must stay off the launcher photo. Keep the panel line and aria-label.`)
    }
    if (!sarah.includes('data-sarah="voice-stage"') || !sarah.includes('WEB_VOICE_HINT_LISTEN_EN') || !sarah.includes('WEB_VOICE_HINT_END_EN')) {
      p.push(`${PATHS.sarah}: hands-free voice needs a visible stage, Just start talking, and Tap to end.`)
    }
    if (!sarah.includes('captureSarahLead')) {
      p.push(`${PATHS.sarah}: qualifying flows must write through captureSarahLead.`)
    }
    if (!sarah.includes('answerSarahChat') || !sarah.includes('shouldAnswerFromPage')) {
      p.push(`${PATHS.sarah}: page-aware questions must call answerSarahChat from current page facts.`)
    }
  }

  if (flow == null) p.push(`${PATHS.flow}: missing.`)
  else {
    for (const label of INTENT_LABELS) {
      if (!flow.includes(label)) p.push(`${PATHS.flow}: missing intent chip ${JSON.stringify(label)}.`)
    }
    if (!flow.includes('decideSarahStage') || !flow.includes('captured:by-sarah')) {
      p.push(`${PATHS.flow}: CRM capture contract (stage + by Sarah audit) missing.`)
    }
  }

  if (capture == null) p.push(`${PATHS.capture}: missing.`)
  else {
    if (!capture.includes("from '@/lib/cma/build'") || !capture.includes('createCmaRequest') || !capture.includes('kickCmaBuild')) {
      p.push(`${PATHS.capture}: draft CMA must go through createCmaRequest + buildCma/kick.`)
    }
    if (!capture.includes("requestSource: 'sarah-chat'") || !capture.includes('notifyLead: false')) {
      p.push(`${PATHS.capture}: Sarah CMA stays a draft. Do not send.`)
    }
    if (!capture.includes('sendEvent') || !capture.includes('enrichNativeLead') || !capture.includes('applySarahPersonStage')) {
      p.push(`${PATHS.capture}: CRM write must use sendEvent, enrichNativeLead, and the no-downgrade stage helper.`)
    }
  }

  if (css == null) p.push(`${PATHS.css}: missing.`)
  else {
    if (!css.includes('--v3-sarah-panel-radius') || !css.includes('--v3-sarah-glow')) {
      p.push(`${PATHS.css}: panel must stay a rounded card with the Sarah glow.`)
    }
    if (!css.includes('.v3-sarah__mic[data-sarah-voice=')) {
      p.push(`${PATHS.css}: mic listening state is missing.`)
    }
    if (!css.includes('--v3-sarah-mic')) {
      p.push(`${PATHS.css}: mic must stay a large circular control.`)
    }
    if (!css.includes('.v3-sarah__voice-orb') || !css.includes('.v3-sarah__voice-wave')) {
      p.push(`${PATHS.css}: listening/speaking orb motion is missing.`)
    }
    if (!css.includes('--v3-sarah-inset') || !css.includes('--v3-sarah-fab')) {
      p.push(`${PATHS.css}: launcher must stay inset from the corner and sized from --v3-sarah-fab.`)
    }
    if (css.includes('.v3-sarah__desk-actions') || css.includes('.v3-sarah__desk-who')) {
      p.push(`${PATHS.css}: desk-actions / desk-who chrome must not return.`)
    }
    if (!css.includes('--v3-sarah-face') || !css.includes('object-fit: cover')) {
      p.push(`${PATHS.css}: every Sarah avatar must cover and sit on --v3-sarah-face.`)
    }
    if (!css.includes('.v3-chrome__overlay[hidden]') || !css.includes(':not([hidden])')) {
      p.push(`${PATHS.css}: hidden chrome dialog must not blank the disc; visible modals still hide it.`)
    }
  }

  if (chrome == null) p.push(`${PATHS.chrome}: missing.`)
  else if (chrome.includes('aria-modal="true"')) {
    p.push(`${PATHS.chrome}: aria-modal must stay off while the always-mounted menu is hidden.`)
  }

  if (globals == null) p.push(`${PATHS.globals}: missing.`)
  else if (!globals.includes("[aria-modal='true']:not([hidden])")) {
    p.push(`${PATHS.globals}: F19 hide-on-modal must ignore a [hidden] chrome dialog.`)
  }

  if (cookie == null) p.push(`${PATHS.cookie}: missing.`)
  else if (!cookie.includes('data-cookie-settings="icon"') || !cookie.includes('Cookie settings')) {
    p.push(`${PATHS.cookie}: cookie settings control is legally required. Keep the icon.`)
  }

  for (const [rel, src] of [
    [PATHS.provider, provider],
    [PATHS.publicLayer, publicLayer],
  ]) {
    if (src == null) {
      p.push(`${rel}: missing.`)
      continue
    }
    if (src.includes('HelpButton') || src.includes('V3DogFloater') || src.includes('V3PhoneDock')) {
      p.push(`${rel}: extra floating dock/help button on the public tree.`)
    }
  }

  return p
}
