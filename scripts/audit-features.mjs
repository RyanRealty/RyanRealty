/**
 * Full interactive feature audit against production
 */
import { chromium } from 'playwright'

const BASE = 'https://ryanrealty.vercel.app'
const results = []

function log(test, pass, detail) {
  results.push({ test, pass, detail })
  console.log((pass ? '✅' : '❌') + ' ' + test + (detail ? ' — ' + detail : ''))
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })

  // ═══ LISTING DETAIL ═══
  console.log('\n=== LISTING DETAIL ===')
  const lp = await context.newPage()
  await lp.goto(`${BASE}/homes-for-sale/listing/20251001174016347970000000`, { timeout: 60000, waitUntil: 'networkidle' })

  log('Save button', await lp.locator('button[aria-label*="save" i], button[aria-label*="Save"]').first().isVisible().catch(() => false))
  log('Share button', await lp.locator('button:has-text("Share"), [aria-label*="Share"]').first().isVisible().catch(() => false))

  // Click share
  const shareBtn = lp.locator('button:has-text("Share"), [aria-label*="Share"]').first()
  if (await shareBtn.isVisible().catch(() => false)) {
    await shareBtn.click().catch(() => {})
    await lp.waitForTimeout(500)
    log('Share dialog opens', await lp.locator('[role="dialog"], [data-state="open"]').isVisible().catch(() => false))
    await lp.keyboard.press('Escape').catch(() => {})
  }

  log('Schedule showing', await lp.locator('a:has-text("Schedule a showing"), button:has-text("Schedule")').first().isVisible().catch(() => false))
  log('Ask a question', await lp.locator('a:has-text("Ask a question"), button:has-text("Ask")').first().isVisible().catch(() => false))
  log('Google Map', await lp.locator('.gm-style, [class*="map-container"]').first().isVisible().catch(() => false))
  log('Similar listings', await lp.locator('text=Similar').first().isVisible().catch(() => false))
  log('Monthly payment section', await lp.locator('text=Monthly Payment').first().isVisible().catch(() => false))
  log('Vacation rental section', await lp.locator('text=Vacation rental').first().isVisible().catch(() => false))
  log('Area market context', await lp.locator('text=Area market context').first().isVisible().catch(() => false))
  log('Activity feed', await lp.locator('text=happening nearby').first().isVisible().catch(() => false))
  await lp.close()

  // ═══ CONTACT FORM ═══
  console.log('\n=== CONTACT FORM ===')
  const cp = await context.newPage()
  await cp.goto(`${BASE}/contact`, { timeout: 30000, waitUntil: 'networkidle' })
  log('Name input', await cp.locator('input[name="name"], input[placeholder*="name" i]').first().isVisible().catch(() => false))
  log('Email input', await cp.locator('input[type="email"]').first().isVisible().catch(() => false))
  log('Message textarea', await cp.locator('textarea').first().isVisible().catch(() => false))
  log('Submit button', await cp.locator('button[type="submit"], button:has-text("Send"), button:has-text("Submit")').first().isVisible().catch(() => false))
  await cp.close()

  // ═══ SEARCH ═══
  console.log('\n=== SEARCH ===')
  const sp = await context.newPage()
  await sp.goto(`${BASE}/homes-for-sale/bend`, { timeout: 60000, waitUntil: 'domcontentloaded' })
  await sp.waitForTimeout(3000)
  log('Price filter', await sp.locator('text=Price').first().isVisible().catch(() => false))
  log('Beds filter', await sp.locator('text=Beds').first().isVisible().catch(() => false))
  log('View on map', await sp.locator('text=View on map').first().isVisible().catch(() => false))
  log('Share button', await sp.locator('button:has-text("Share")').first().isVisible().catch(() => false))
  log('Listing cards present', (await sp.locator('a[href*="/homes-for-sale/listing/"]').count()) > 0)
  await sp.close()

  // ═══ LOGIN ═══
  console.log('\n=== LOGIN ===')
  const login = await context.newPage()
  await login.goto(`${BASE}/login`, { timeout: 30000, waitUntil: 'networkidle' })
  log('Google OAuth', await login.locator('button:has-text("Google")').first().isVisible().catch(() => false))
  log('Facebook OAuth', await login.locator('button:has-text("Facebook")').first().isVisible().catch(() => false))
  log('Email input', await login.locator('input[type="email"]').first().isVisible().catch(() => false))
  log('Password input', await login.locator('input[type="password"]').first().isVisible().catch(() => false))
  log('Sign in button', await login.locator('button:has-text("Sign in")').first().isVisible().catch(() => false))
  await login.close()

  // ═══ MORTGAGE CALCULATOR ═══
  console.log('\n=== MORTGAGE CALCULATOR ===')
  const mc = await context.newPage()
  await mc.goto(`${BASE}/tools/mortgage-calculator`, { timeout: 30000, waitUntil: 'networkidle' })
  const inputs = await mc.locator('input').count()
  log('Has calculator inputs', inputs >= 3, `${inputs} inputs`)
  await mc.close()

  // ═══ CHAT WIDGET ═══
  console.log('\n=== CHAT WIDGET ===')
  const chat = await context.newPage()
  await chat.goto(`${BASE}/`, { timeout: 60000, waitUntil: 'domcontentloaded' })
  await chat.waitForTimeout(3000)
  const chatBtn = chat.locator('button:has-text("Chat"), [aria-label*="chat" i]').first()
  log('Chat button visible', await chatBtn.isVisible().catch(() => false))
  if (await chatBtn.isVisible().catch(() => false)) {
    await chatBtn.click().catch(() => {})
    await chat.waitForTimeout(1000)
    log('Chat opens', await chat.locator('textarea, input[placeholder*="message" i]').isVisible().catch(() => false))
  }
  await chat.close()

  // ═══ HOME VALUATION ═══
  console.log('\n=== HOME VALUATION ===')
  const val = await context.newPage()
  await val.goto(`${BASE}/sell/valuation`, { timeout: 30000, waitUntil: 'networkidle' })
  log('Valuation page loads', await val.locator('h1, h2').first().isVisible().catch(() => false))
  log('Has form/inputs', (await val.locator('input, textarea, select').count()) > 0)
  await val.close()

  // ═══ COOKIE CONSENT ═══
  console.log('\n=== COOKIE CONSENT ===')
  const cookie = await context.newPage()
  await cookie.goto(`${BASE}/about`, { timeout: 30000, waitUntil: 'networkidle' })
  log('Accept All button', await cookie.locator('button:has-text("Accept All")').first().isVisible().catch(() => false))
  log('Manage Preferences', await cookie.locator('button:has-text("Manage Preferences")').first().isVisible().catch(() => false))
  log('Essential only', await cookie.locator('button:has-text("Essential only")').first().isVisible().catch(() => false))
  await cookie.close()

  // ═══ SUMMARY ═══
  console.log('\n═══════════════════════════════')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`TOTAL: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('\nFAILED:')
    results.filter(r => !r.pass).forEach(r => console.log('  ❌ ' + r.test))
  }

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
