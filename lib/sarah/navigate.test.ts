import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSarahSystemPrompt } from './persona'
import {
  NAVIGATE_TOOL,
  SARAH_NAVIGATE_VOICE,
  isPublicSarahHref,
  looksLikeNavigate,
  resolveSarahNavigate,
  runNavigate,
} from './navigate'

const SISTERS_SHOW = 'show me homes in Sisters'

describe('Sarah navigate', () => {
  it('takes show me homes in Sisters to the Sisters search', () => {
    expect(looksLikeNavigate(SISTERS_SHOW)).toBe(true)
    expect(looksLikeNavigate("I'm looking for three bedrooms in Sisters")).toBe(false)
    const dest = resolveSarahNavigate(SISTERS_SHOW)
    expect(dest?.href).toBe('/homes-for-sale/sisters')
    expect(dest?.voice).toBe('Taking you there now')
    expect(dest?.voice).toBe(SARAH_NAVIGATE_VOICE)
    expect(dest?.reply).toMatch(/Taking you there now/)
    expect(dest?.reply).toMatch(/Sisters/)
    expect(dest?.reply).not.toMatch(/[\u2013\u2014]/)
  })

  it('resolves sell, home value, contact, community, and listing pages', () => {
    expect(resolveSarahNavigate('take me to the sell page')?.href).toBe('/sell')
    expect(resolveSarahNavigate('open the home value page')?.href).toBe('/sell/valuation')
    expect(resolveSarahNavigate('go to contact')?.href).toBe('/contact')
    expect(resolveSarahNavigate('take me to Tetherow')?.href).toBe('/communities/tetherow')
    expect(resolveSarahNavigate('show me listing 220226741')?.href).toBe('/homes-for-sale/listing/220226741')
    expect(resolveSarahNavigate('show me three bedrooms in Sisters')?.href).toBe(
      '/homes-for-sale/sisters?beds=3',
    )
  })

  it('refuses admin and off-site hrefs', () => {
    expect(isPublicSarahHref('/homes-for-sale/sisters')).toBe(true)
    expect(isPublicSarahHref('/admin/crm')).toBe(false)
    expect(isPublicSarahHref('https://example.com')).toBe(false)
    expect(isPublicSarahHref('//evil.test')).toBe(false)
    expect(runNavigate('/admin/crm')).toBeNull()
    expect(NAVIGATE_TOOL.name).toBe('navigate')
  })
})

describe('Sarah navigate wiring', () => {
  it('uses router.push, keeps the panel and voice session, and does not claim she cannot navigate', () => {
    const panel = readFileSync(resolve('components/site/v3/V3SarahAssistant.client.tsx'), 'utf8')
    const voice = readFileSync(resolve('lib/sarah/web-voice.ts'), 'utf8')
    const persona = readFileSync(resolve('lib/sarah/persona.ts'), 'utf8')
    const prompt = buildSarahSystemPrompt({ channel: 'web' })
    expect(panel).toContain('looksLikeNavigate')
    expect(panel).toContain('resolveSarahNavigate')
    expect(panel).toContain('router.push')
    expect(panel).toMatch(/speakExact\(\s*(?:dest|turn)?\.?voice/)
    expect(panel).toContain('SARAH_NAVIGATE_VOICE')
    const start = panel.indexOf('if (looksLikeNavigate')
    const end = panel.indexOf('if (looksLikeHomeSearch')
    const block = panel.slice(start, end === -1 ? start + 800 : end)
    expect(block).toContain('router.push')
    expect(block).toContain('speakExact(dest.voice)')
    expect(block).not.toContain('.stop()')
    expect(panel).not.toMatch(/location\.(href|assign|replace)/)
    expect(voice).toContain('speakExact')
    expect(prompt).toMatch(/navigate/)
    expect(prompt).toMatch(/Taking you there now/)
    expect(prompt).toMatch(/You can move the visitor to those pages/)
    expect(prompt).not.toMatch(/I can(?:no)?t (navigate|open pages|change (?:the )?page)/i)
    expect(persona).not.toMatch(/I can(?:no)?t (navigate|open pages|change (?:the )?page)/i)
  })
})
