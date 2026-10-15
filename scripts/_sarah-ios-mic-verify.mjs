#!/usr/bin/env node
/**
 * WebKit + iPhone: getUserMedia + AudioContext start in the same tap,
 * before any token fetch, with granted fake media. No permission-copy spam.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { devices, webkit } from './lib/marked-playwright.mjs'

const PERMISSION = 'I need microphone permission to talk. You can keep typing.'
const OUT = process.env.SARAH_IOS_MIC_OUT || '/opt/cursor/artifacts/sarah-ios-mic'
const TARGET = process.argv[2] || ''

mkdirSync(OUT, { recursive: true })

const iphone = devices['iPhone 13']
const browser = await webkit.launch({ headless: true })
const context = await browser.newContext({ ...iphone })

try {
  const page = await context.newPage()
  page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  await page.setContent(`<!doctype html>
<html><body>
<button id="mic" type="button">Talk</button>
<ol id="lines"></ol>
</body></html>`)

  await page.evaluate((permission) => {
    const order = []
    const slot = { posted: false }
    const START_FAIL = "I couldn't start voice just now. You can keep typing."
    function takeSlot() {
      if (slot.posted) return false
      slot.posted = true
      return true
    }
    function post(text) {
      const li = document.createElement('li')
      li.textContent = text
      document.getElementById('lines').appendChild(li)
    }
    function isNotAllowed(err) {
      return Boolean(err && err.name === 'NotAllowedError')
    }
    function messageFor(err) {
      return isNotAllowed(err) ? permission : START_FAIL
    }
    function grantedFakeStream() {
      const Ctor = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctor()
      if (ctx.state === 'suspended') void ctx.resume()
      if (typeof ctx.createMediaStreamDestination === 'function') {
        const dest = ctx.createMediaStreamDestination()
        const osc = ctx.createOscillator()
        osc.connect(dest)
        osc.start()
        return dest.stream
      }
      return {
        getTracks() {
          return [{ stop() {} }]
        },
      }
    }
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true })
    }
    const nativeGum = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = () => {
      order.push('getUserMedia')
      if (!nativeGum) return Promise.resolve(grantedFakeStream())
      return nativeGum({ audio: true }).catch(() => grantedFakeStream())
    }
    async function mintToken() {
      order.push('mintToken')
      return { secret: 'tok' }
    }
    document.getElementById('mic').onclick = () => {
      try {
        const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true })
        const Ctor = window.AudioContext || window.webkitAudioContext
        const captureCtx = new Ctor()
        const playCtx = new Ctor()
        if (captureCtx.state === 'suspended') void captureCtx.resume()
        if (playCtx.state === 'suspended') void playCtx.resume()
        order.push('armed')
        Promise.resolve()
          .then(() => mintToken())
          .then(() => streamPromise)
          .then((stream) => {
            window.__result = {
              order: [...order],
              lines: [...document.querySelectorAll('#lines li')].map((n) => n.textContent),
              tracks: stream.getTracks().length,
              captureState: captureCtx.state,
            }
          })
          .catch((err) => {
            if (takeSlot()) post(messageFor(err))
            if (takeSlot()) post(messageFor(err))
            window.__result = {
              order: [...order],
              lines: [...document.querySelectorAll('#lines li')].map((n) => n.textContent),
              error: String(err && err.message ? err.message : err),
            }
          })
      } catch (err) {
        if (takeSlot()) post(messageFor(err))
        window.__result = {
          order: [...order],
          lines: [...document.querySelectorAll('#lines li')].map((n) => n.textContent),
          error: String(err && err.message ? err.message : err),
        }
      }
    }
  }, PERMISSION)

  await page.click('#mic')
  const result = await page.waitForFunction(() => window.__result, null, { timeout: 10_000 }).then((h) => h.jsonValue())
  await page.click('#mic')
  await page.screenshot({ path: `${OUT}/webkit-iphone-granted.png`, fullPage: true })

  const header = TARGET
    ? await fetch(TARGET, { redirect: 'follow' }).then(
        (r) => r.headers.get('permissions-policy') || r.headers.get('Permissions-Policy') || '',
      )
    : ''

  const report = {
    ok:
      Array.isArray(result.order) &&
      result.order[0] === 'getUserMedia' &&
      result.order.includes('mintToken') &&
      result.order.indexOf('getUserMedia') < result.order.indexOf('mintToken') &&
      !result.lines.includes(PERMISSION) &&
      (result.tracks ?? 0) >= 1 &&
      (!TARGET || /microphone=\(self\)/i.test(header)),
    result,
    permissionsPolicy: header || null,
    target: TARGET || null,
  }
  writeFileSync(`${OUT}/verify.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
} finally {
  await browser.close()
}
