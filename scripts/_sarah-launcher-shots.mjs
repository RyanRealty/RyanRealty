#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { chromium } from './lib/marked-playwright.mjs'

const OUT = process.env.SARAH_LAUNCHER_SHOTS || '/opt/cursor/artifacts/sarah-launcher'
const TARGET = process.argv[2] || 'http://127.0.0.1:3010/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  for (const [name, size] of [
    ['closed-375', { width: 375, height: 812 }],
    ['closed-1440', { width: 1440, height: 900 }],
  ]) {
    const page = await browser.newPage({ viewport: size })
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-sarah="launcher"]', { timeout: 30_000 })
    await page.screenshot({ path: `${OUT}/${name}.png` })
    await page.close()
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.click('[data-sarah="launcher"]')
  await page.waitForSelector('[data-sarah="panel"]')
  await page.evaluate(() => {
    const stage = document.querySelector('[data-sarah="voice-stage"]')
    const orb = document.querySelector('[data-sarah="mic"]')
    const hint = document.querySelector('[data-sarah="voice-hint"]')
    stage?.setAttribute('data-sarah-voice', 'listening')
    orb?.setAttribute('data-sarah-voice', 'listening')
    if (hint) hint.textContent = 'Just start talking. Tap to end'
    const wave = document.createElement('span')
    wave.className = 'v3-sarah__voice-wave'
    wave.setAttribute('aria-hidden', 'true')
    wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i>'
    if (orb && !orb.querySelector('.v3-sarah__voice-wave')) {
      orb.querySelector('svg')?.remove()
      orb.prepend(wave)
    }
  })
  await page.screenshot({ path: `${OUT}/listening-390.png` })
  await page.evaluate(() => {
    document.querySelector('[data-sarah="voice-stage"]')?.setAttribute('data-sarah-voice', 'speaking')
    document.querySelector('[data-sarah="mic"]')?.setAttribute('data-sarah-voice', 'speaking')
    const hint = document.querySelector('[data-sarah="voice-hint"]')
    if (hint) hint.textContent = 'Sarah is talking. Tap to end'
  })
  await page.screenshot({ path: `${OUT}/speaking-390.png` })
  await page.close()
  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2))
} finally {
  await browser.close()
}
