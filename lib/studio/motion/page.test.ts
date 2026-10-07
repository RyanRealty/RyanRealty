import { describe, expect, it } from 'vitest'
import { buildMotionPage, drivenIds } from './page'
import { planMotion, type MotionSubject } from './cues'
import type { MotionAssets } from './assets'

const assets: MotionAssets = {
  fonts: {
    amboqia: 'data:font/otf;base64,AAAA',
    amboqiaI: 'data:font/woff2;base64,AAAA',
    azo: 'data:font/ttf;base64,AAAA',
    geist400: 'data:font/woff2;base64,AAAA',
    geist500: 'data:font/woff2;base64,AAAA',
    geist600: 'data:font/woff2;base64,AAAA',
  },
  wordmark: 'data:image/png;base64,AAAA',
  headshots: { '/images/brokers/ryan-matt.png': 'data:image/png;base64,BBBB' },
}

const subject: MotionSubject = {
  label: 'Bend, Oregon',
  figures: { 'months of supply': '4.1' },
  citations: [{ figure: '4.1', computed_at: '2026-10-06T14:00:00.000Z' }],
}

const listing: MotionSubject = {
  label: '1 <Main> St, Bend',
  heading: { eyebrow: 'Bend', line: '1 <Main> St' },
  figures: { 'list price': '$500,000' },
  citations: [{ figure: '$500,000', fetched_at: '2026-10-07T15:00:00.000Z' }],
  agent: { name: 'Matt Ryan', headshotPath: '/images/brokers/ryan-matt.png' },
}

describe('buildMotionPage', () => {
  const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject, duration: 6 })
  const html = buildMotionPage({ plan, width: 1080, height: 1920, assets })

  it('has an element for every part the renderer drives', () => {
    for (const id of drivenIds(plan)) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('id="lead1-marker"')
  })

  it('is self-contained: no network reference anywhere in the page', () => {
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toMatch(/@import/)
  })

  it('uses the two brand colours and nothing else', () => {
    const hexes = new Set((html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))
    expect([...hexes].sort()).toEqual(['#102742', '#faf8f4'])
    const rgba = html.match(/rgba\((\d+),(\d+),(\d+),[\d.]+\)/g) ?? []
    for (const value of rgba) expect(value).toMatch(/^rgba\((16,39,66|250,248,244),/)
  })

  it('routes the capital I through the patch face and keeps figures in Geist', () => {
    expect(html).toContain('unicode-range:U+0049')
    expect(html).toMatch(/\.value\{font:600 [\d.]+px\/1 'RR Geist'/)
    expect(html).toMatch(/\.line\{font:400 [\d.]+px\/1\.02 'RR Amboqia I','RR Amboqia'/)
  })

  it('escapes text and draws the agent card with the headshot', () => {
    const listingPlan = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject: listing, duration: 6 })
    const page = buildMotionPage({ plan: listingPlan, width: 1080, height: 1920, assets })
    expect(page).toContain('1 &lt;Main&gt; St')
    expect(page).not.toContain('1 <Main> St')
    expect(page).toContain('data:image/png;base64,BBBB')
    expect(page).toContain('Listed by')
  })

  it('lights the zone the verdict names, even at exactly 4.0', () => {
    const at4 = planMotion({
      spec: { lead: 'market', closer: 'brand' },
      subject: { ...subject, figures: { 'months of supply': '4.0' }, citations: [{ figure: '4.0', computed_at: '2026-10-06T14:00:00.000Z' }] },
      duration: 6,
    })
    const page = buildMotionPage({ plan: at4, width: 1080, height: 1920, assets })
    expect(page).toMatch(/class="zone on"[^>]*>Seller's</)
    expect(page).not.toMatch(/class="zone on"[^>]*>Balanced</)
  })

  it('draws the agent card without a portrait when there is no file for that broker', () => {
    const noPortrait = { ...listing, agent: { name: 'Paula Example', headshotPath: null } }
    const plan2 = planMotion({ spec: { lead: 'listing', closer: 'listing-agent' }, subject: noPortrait, duration: 6 })
    const page = buildMotionPage({ plan: plan2, width: 1080, height: 1920, assets })
    expect(page).toContain('Paula Example')
    expect(page).not.toContain('class="headshot"')
  })

  it('scales its geometry with the frame width', () => {
    const half = buildMotionPage({ plan, width: 540, height: 960, assets })
    expect(half).toContain('left:45px')
    expect(html).toContain('left:90px')
  })
})
