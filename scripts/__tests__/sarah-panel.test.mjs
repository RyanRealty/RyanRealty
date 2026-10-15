import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sarahPanelProblems, SARAH_PANEL_GATE } from '../lib/sarah-panel.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  layout: readFileSync(join(REPO, 'app/layout.tsx'), 'utf8'),
  sarah: readFileSync(join(REPO, 'components/site/v3/V3SarahAssistant.client.tsx'), 'utf8'),
  css: readFileSync(join(REPO, 'components/site/v3/V3SarahAssistant.css'), 'utf8'),
  capture: readFileSync(join(REPO, 'app/actions/sarah-capture.ts'), 'utf8'),
  flow: readFileSync(join(REPO, 'lib/sarah/intent-flow.ts'), 'utf8'),
  cookie: readFileSync(join(REPO, 'components/CookieConsentBanner.tsx'), 'utf8'),
  chrome: readFileSync(join(REPO, 'components/site/v3/V3Chrome.tsx'), 'utf8'),
  globals: readFileSync(join(REPO, 'app/globals.css'), 'utf8'),
  provider: readFileSync(join(REPO, 'components/site/providers/RootProvider.tsx'), 'utf8'),
  publicLayer: readFileSync(join(REPO, 'components/layout/PublicClientLayer.tsx'), 'utf8'),
}

describe('ci:sarah-panel', () => {
  it('passes the live tree', () => {
    expect(sarahPanelProblems({ root: REPO })).toEqual([])
  })

  it('fails if the broker row returns', () => {
    const p = sarahPanelProblems({
      root: REPO,
      files: {
        ...live,
        sarah: `${live.sarah}\n<p>Your broker is Matt Ryan</p>\n<nav className="v3-sarah__desk-actions"><button>Book a time</button></nav>`,
      },
    })
    expect(p.join('\n')).toMatch(/broker row/)
  })

  it('fails if the chrome menu stays aria-modal while hidden', () => {
    const p = sarahPanelProblems({
      root: REPO,
      files: { ...live, chrome: live.chrome.replace('aria-modal={menuHidden ? undefined : true}', 'aria-modal="true"') },
    })
    expect(p.join('\n')).toMatch(/aria-modal/)
  })

  it('fails if F19 hides Sarah for a hidden chrome dialog', () => {
    const p = sarahPanelProblems({
      root: REPO,
      files: {
        ...live,
        globals: live.globals.replaceAll("[aria-modal='true']:not([hidden])", "[aria-modal='true']"),
      },
    })
    expect(p.join('\n')).toMatch(/F19 hide-on-modal/)
  })

  it('fails if cookie settings is removed', () => {
    const p = sarahPanelProblems({
      root: REPO,
      files: { ...live, cookie: live.cookie.replace('data-cookie-settings="icon"', '') },
    })
    expect(p.join('\n')).toMatch(/cookie settings/)
  })

  it('ci:sarah-panel exits 0 on HEAD', () => {
    const r = spawnSync('node', [join(REPO, 'scripts/check-sarah-panel.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(SARAH_PANEL_GATE)
  })
})
