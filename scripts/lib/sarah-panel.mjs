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
  provider: 'components/site/providers/RootProvider.tsx',
  publicLayer: 'components/layout/PublicClientLayer.tsx',
})

const INTENT_LABELS = [
  "I'm looking for a home",
  "I'm thinking of selling",
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
    if (!sarah.includes('data-sarah="intent-chips"')) {
      p.push(`${PATHS.sarah}: opening chips must render as data-sarah="intent-chips".`)
    }
    if (!sarah.includes('WEB_BRINGS_YOU_HERE_EN') || !sarah.includes('SARAH_INTENT_CHIPS')) {
      p.push(`${PATHS.sarah}: panel must ask what brings them here and mount the intent chips.`)
    }
    if (
      !sarah.includes('data-sarah="mic"') ||
      !sarah.includes('mintSarahVoiceToken') ||
      !sarah.includes('startSarahVoiceSession') ||
      !sarah.includes('primeSarahMicrophone')
    ) {
      p.push(`${PATHS.sarah}: Eve mic must ask permission on click, mint a realtime token, and start the browser session.`)
    }
    if (!sarah.includes('SARAH_AVATAR_SRCSET') || !sarah.includes('name="Microphone"') || !sarah.includes('scrollToLatest')) {
      p.push(`${PATHS.sarah}: launcher needs the 2x/3x headshot srcset, a mic icon, and auto-scroll.`)
    }
    if (sarah.includes("{desk.firstName}'s team") || sarah.includes('Your broker is')) {
      p.push(`${PATHS.sarah}: broker header row must stay out of the chrome.`)
    }
    if (!sarah.includes('captureSarahLead')) {
      p.push(`${PATHS.sarah}: qualifying flows must write through captureSarahLead.`)
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
    if (!flow.includes('look at homes')) {
      p.push(`${PATHS.flow}: buyer intent must match "look at homes".`)
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
    if (css.includes('.v3-sarah__desk-actions')) {
      p.push(`${PATHS.css}: desk-actions chrome must not return.`)
    }
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
