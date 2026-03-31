/**
 * Interactive Site Audit — tests the site like a real user
 * Navigates pages, clicks buttons, fills forms, checks console errors
 * Captures screenshots at every step as evidence
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = process.env.AUDIT_URL || 'http://localhost:3000'
const SCREENSHOT_DIR = '/opt/cursor/artifacts/screenshots/audit'
const TIMEOUT = 45_000

// Track all findings
const findings = []
const consoleErrors = []

function finding(page, severity, description) {
  findings.push({ page, severity, description, timestamp: new Date().toISOString() })
  const icon = severity === 'P0' ? '🔴' : severity === 'P1' ? '🟡' : '⚪'
  console.log(`  ${icon} [${severity}] ${description}`)
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: false })
  return filepath
}

async function screenshotFull(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}-full.png`)
  await page.screenshot({ path: filepath, fullPage: true })
  return filepath
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  })
  
  // Collect console errors globally
  context.on('page', (page) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 200) })
      }
    })
    page.on('pageerror', err => {
      consoleErrors.push({ url: page.url(), text: err.message.slice(0, 200) })
    })
  })

  const page = await context.newPage()

  // ═══════════════════════════════════════════════════════════
  // JOURNEY 1: Home Buyer looking for a home in Bend
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ JOURNEY 1: Home Buyer in Bend ═══\n')

  // Step 1: Homepage
  console.log('Step 1: Homepage')
  const homeStart = Date.now()
  const homeResp = await page.goto(`${BASE}/`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
  const homeDCL = Date.now() - homeStart
  console.log(`  Load time (DOMContentLoaded): ${homeDCL}ms`)
  console.log(`  Status: ${homeResp?.status()}`)
  
  if (homeResp?.status() !== 200) {
    finding('/', 'P0', `Homepage returned ${homeResp?.status()}`)
  }
  
  // Check if hero renders
  const heroVisible = await page.locator('main').first().isVisible().catch(() => false)
  if (!heroVisible) finding('/', 'P0', 'Main content not visible on homepage')
  
  // Check for nav
  const navLinks = await page.locator('header a, header button').count()
  console.log(`  Nav elements: ${navLinks}`)
  if (navLinks < 3) finding('/', 'P1', `Only ${navLinks} nav elements found — expected more`)
  
  // Check for "Sign In" or "Log In" button
  const signInBtn = await page.locator('text=Log in, text=Sign in, text=Log In, text=Sign In').first().isVisible().catch(() => false)
  console.log(`  Sign in button visible: ${signInBtn}`)
  if (!signInBtn) finding('/', 'P1', 'No sign-in button visible in header')
  
  await screenshot(page, '01-homepage-top')
  
  // Wait for streaming content to load
  await page.waitForTimeout(5000)
  await screenshotFull(page, '01-homepage')
  
  // Check footer
  const footerVisible = await page.locator('footer').isVisible().catch(() => false)
  console.log(`  Footer visible: ${footerVisible}`)
  if (!footerVisible) finding('/', 'P1', 'Footer not visible on homepage')

  // Step 2: Search for Bend
  console.log('\nStep 2: Navigate to Bend search')
  await page.goto(`${BASE}/homes-for-sale/bend`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await screenshot(page, '02-search-bend-top')
  await screenshotFull(page, '02-search-bend')
  
  const searchStatus = await page.locator('h1, h2').first().textContent().catch(() => '')
  console.log(`  Page heading: "${searchStatus?.trim().slice(0, 60)}"`)
  
  // Check if listings appear
  const listingCards = await page.locator('[class*="ListingTile"], [class*="listing"], a[href*="/homes-for-sale/listing/"]').count()
  console.log(`  Listing cards/links found: ${listingCards}`)
  if (listingCards === 0) finding('/homes-for-sale/bend', 'P0', 'No listing cards visible on Bend search page')
  
  // Step 3: Click a listing (if any exist)
  console.log('\nStep 3: Click a listing')
  const listingLink = page.locator('a[href*="/homes-for-sale/"]').filter({ hasNotText: /bend|redmond|sisters/i }).first()
  const listingHref = await listingLink.getAttribute('href').catch(() => null)
  
  if (listingHref) {
    console.log(`  Clicking: ${listingHref}`)
    await page.goto(`${BASE}${listingHref}`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await screenshot(page, '03-listing-detail-top')
    await screenshotFull(page, '03-listing-detail')
    
    const listingTitle = await page.locator('h1').first().textContent().catch(() => '')
    console.log(`  Listing title: "${listingTitle?.trim().slice(0, 80)}"`)
    
    // Check for photos
    const photoCount = await page.locator('img[src*="photos"], img[src*="Photo"], img[src*="spark"]').count()
    console.log(`  Photos found: ${photoCount}`)
    if (photoCount === 0) finding(listingHref, 'P1', 'No listing photos visible')
    
    // Check for price
    const priceText = await page.locator('text=$').first().textContent().catch(() => '')
    console.log(`  Price visible: ${!!priceText}`)
    
    // Check for key facts (beds, baths, sqft)
    const keyFacts = await page.locator('text=/\\d+\\s*(bed|bath|sq|acre)/i').count()
    console.log(`  Key facts found: ${keyFacts}`)
    
    // Try "Schedule a Showing" button
    const scheduleBtn = await page.locator('button:has-text("Schedule"), button:has-text("showing"), button:has-text("Showing")').first()
    const scheduleBtnVisible = await scheduleBtn.isVisible().catch(() => false)
    console.log(`  Schedule showing button: ${scheduleBtnVisible}`)
    if (scheduleBtnVisible) {
      await scheduleBtn.click().catch(() => {})
      await page.waitForTimeout(1000)
      await screenshot(page, '03b-schedule-modal')
      // Check if modal opened
      const modalVisible = await page.locator('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="Dialog"]').isVisible().catch(() => false)
      console.log(`  Modal opened: ${modalVisible}`)
      if (!modalVisible) finding(listingHref, 'P1', 'Schedule showing button did not open a modal')
      // Close modal
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(500)
    }
    
    // Try Share button
    const shareBtn = await page.locator('button:has-text("Share"), button[aria-label*="Share"], button[aria-label*="share"]').first()
    const shareBtnVisible = await shareBtn.isVisible().catch(() => false)
    console.log(`  Share button: ${shareBtnVisible}`)

    // Check for map
    const mapVisible = await page.locator('[class*="map"], [class*="Map"], [id*="map"]').first().isVisible().catch(() => false)
    console.log(`  Map visible: ${mapVisible}`)

    // Check for similar listings
    const similarSection = await page.locator('text=/similar|recommended/i').first().isVisible().catch(() => false)
    console.log(`  Similar listings section: ${similarSection}`)
    
  } else {
    finding('/homes-for-sale/bend', 'P0', 'Could not find any listing links to click')
  }

  // ═══════════════════════════════════════════════════════════
  // JOURNEY 2: Check key pages
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ JOURNEY 2: Key Pages ═══\n')
  
  const pagesToCheck = [
    { path: '/team', name: 'Team', checks: ['broker cards', 'photos'] },
    { path: '/contact', name: 'Contact', checks: ['form'] },
    { path: '/sell', name: 'Sell', checks: ['CTA'] },
    { path: '/about', name: 'About', checks: ['content'] },
    { path: '/housing-market', name: 'Housing Market', checks: ['cities'] },
    { path: '/blog', name: 'Blog', checks: ['posts'] },
    { path: '/login', name: 'Login', checks: ['form'] },
    { path: '/tools/mortgage-calculator', name: 'Mortgage Calc', checks: ['calculator'] },
  ]
  
  for (const p of pagesToCheck) {
    console.log(`Checking: ${p.name} (${p.path})`)
    const resp = await page.goto(`${BASE}${p.path}`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.waitForTimeout(1500)
    
    const status = resp?.status() ?? 'error'
    console.log(`  Status: ${status}`)
    if (status !== 200 && status !== 304) {
      finding(p.path, 'P0', `Page returned ${status}`)
    }
    
    // Check for error boundary
    const hasError = await page.locator('text="Something went wrong"').isVisible().catch(() => false)
    if (hasError) finding(p.path, 'P0', 'Error boundary is showing')
    
    const idx = pagesToCheck.indexOf(p)
    await screenshot(page, `04-${String(idx).padStart(2, '0')}-${p.name.toLowerCase().replace(/\s+/g, '-')}`)
    
    // Page-specific checks
    if (p.path === '/contact') {
      const formInputs = await page.locator('input, textarea').count()
      console.log(`  Form inputs: ${formInputs}`)
      if (formInputs < 2) finding(p.path, 'P1', 'Contact form has fewer than 2 inputs')
    }
    
    if (p.path === '/team') {
      const brokerCards = await page.locator('[class*="broker"], [class*="Broker"], [class*="agent"], [class*="Agent"]').count()
      const teamImages = await page.locator('img[alt*="broker"], img[alt*="agent"], img[src*="broker"]').count()
      console.log(`  Broker elements: ${brokerCards}, Team images: ${teamImages}`)
    }
    
    if (p.path === '/login') {
      const emailInput = await page.locator('input[type="email"], input[name="email"]').isVisible().catch(() => false)
      const passwordInput = await page.locator('input[type="password"]').isVisible().catch(() => false)
      const googleBtn = await page.locator('button:has-text("Google"), button[aria-label*="Google"]').isVisible().catch(() => false)
      console.log(`  Email input: ${emailInput}, Password: ${passwordInput}, Google OAuth: ${googleBtn}`)
      if (!emailInput || !passwordInput) finding(p.path, 'P1', 'Login form missing email or password input')
    }
    
    if (p.path === '/housing-market') {
      // Check that it shows Central Oregon cities, not random ones
      const hasAdams = await page.locator('text="Adams"').isVisible().catch(() => false)
      const hasBend = await page.locator('text="Bend"').isVisible().catch(() => false)
      console.log(`  Shows "Bend": ${hasBend}, Shows "Adams" (bad): ${hasAdams}`)
      if (hasAdams) finding(p.path, 'P1', 'Housing market still showing non-Central-Oregon cities')
      if (!hasBend) finding(p.path, 'P1', 'Housing market not showing Bend')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // JOURNEY 3: Mobile audit
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ JOURNEY 3: Mobile Audit ═══\n')
  
  await page.setViewportSize({ width: 390, height: 844 })
  
  // Mobile homepage
  console.log('Mobile: Homepage')
  await page.goto(`${BASE}/`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await screenshot(page, '05-mobile-homepage')
  
  // Check for hamburger menu
  const hamburger = await page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button:has(svg)').first()
  const hamburgerVisible = await hamburger.isVisible().catch(() => false)
  console.log(`  Hamburger menu: ${hamburgerVisible}`)
  
  if (hamburgerVisible) {
    await hamburger.click().catch(() => {})
    await page.waitForTimeout(500)
    await screenshot(page, '05b-mobile-menu-open')
    const mobileNavLinks = await page.locator('nav a, [role="dialog"] a, [class*="Sheet"] a').count()
    console.log(`  Mobile nav links: ${mobileNavLinks}`)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)
  }
  
  // Mobile listing detail
  if (listingHref) {
    console.log('Mobile: Listing detail')
    await page.goto(`${BASE}${listingHref}`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await screenshot(page, '06-mobile-listing')
    await screenshotFull(page, '06-mobile-listing')
  }
  
  // Mobile contact
  console.log('Mobile: Contact')
  await page.goto(`${BASE}/contact`, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await screenshot(page, '07-mobile-contact')

  // ═══════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════')
  console.log('AUDIT RESULTS')
  console.log('═══════════════════════════════════════════\n')
  
  const p0 = findings.filter(f => f.severity === 'P0')
  const p1 = findings.filter(f => f.severity === 'P1')
  const p2 = findings.filter(f => f.severity === 'P2')
  
  console.log(`Findings: ${p0.length} P0 (critical), ${p1.length} P1 (important), ${p2.length} P2 (polish)`)
  console.log(`Console errors: ${consoleErrors.length}`)
  
  if (p0.length > 0) {
    console.log('\n🔴 P0 — CRITICAL:')
    p0.forEach(f => console.log(`  ${f.page}: ${f.description}`))
  }
  if (p1.length > 0) {
    console.log('\n🟡 P1 — IMPORTANT:')
    p1.forEach(f => console.log(`  ${f.page}: ${f.description}`))
  }
  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors (unique):')
    const unique = [...new Set(consoleErrors.map(e => `${e.url}: ${e.text}`))]
    unique.slice(0, 20).forEach(e => console.log(`  ${e}`))
  }
  
  // Write results to file
  fs.writeFileSync('/opt/cursor/artifacts/audit-results.json', JSON.stringify({
    findings,
    consoleErrors: [...new Set(consoleErrors.map(e => JSON.stringify(e)))].map(e => JSON.parse(e)),
    timestamp: new Date().toISOString(),
  }, null, 2))
  
  await browser.close()
  console.log('\nScreenshots saved to:', SCREENSHOT_DIR)
  console.log('Results saved to: /opt/cursor/artifacts/audit-results.json')
}

main().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
