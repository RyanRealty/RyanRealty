import { chromium } from 'playwright';

const SITE = 'https://ryanrealty.vercel.app';
const SCREENSHOTS = '/opt/cursor/artifacts/screenshots';

async function screenshot(page, name) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: false });
}

async function screenshotFull(page, name) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
}

// ===========================
// UJ-001: Land on Homepage
// ===========================
async function uj001(page) {
  console.log('\n========== UJ-001: Land on Homepage from Google ==========');
  const start = Date.now();
  await page.goto(SITE + '/', { waitUntil: 'load', timeout: 60000 });
  const loadTime = Date.now() - start;
  console.log(`Load time: ${loadTime}ms (target: <3000ms) ${loadTime < 3000 ? '✅' : '⚠️ SLOW'}`);

  await screenshot(page, 'uj001_homepage');

  // Title
  const title = await page.title();
  const hasRyanRealty = title.includes('Ryan Realty');
  const hasCentralOregon = title.includes('Central Oregon');
  console.log(`Title: "${title}"`);
  console.log(`  Contains "Ryan Realty": ${hasRyanRealty ? '✅' : '❌ FAIL'}`);
  console.log(`  Contains "Central Oregon": ${hasCentralOregon ? '✅' : '❌ FAIL'}`);

  // Meta description
  const metaDesc = await page.getAttribute('meta[name="description"]', 'content');
  console.log(`Meta description: ${metaDesc ? (metaDesc.length > 50 ? '✅ ' + metaDesc.length + ' chars' : '❌ TOO SHORT') : '❌ MISSING'}`);

  // OG tags
  const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
  const ogDesc = await page.getAttribute('meta[property="og:description"]', 'content');
  const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
  const ogUrl = await page.getAttribute('meta[property="og:url"]', 'content');
  console.log(`OG title: ${ogTitle ? '✅' : '❌ MISSING'}`);
  console.log(`OG image: ${ogImage ? '✅ ' + ogImage : '❌ MISSING'}`);
  console.log(`OG url: ${ogUrl || 'MISSING'}`);
  console.log(`  Uses https: ${ogUrl?.startsWith('https://') ? '✅' : '❌ FAIL - uses http'}`);

  // Hero section
  const h1 = await page.textContent('h1');
  console.log(`H1 text: "${h1?.trim() || 'NONE'}"`);
  console.log(`  H1 exists: ${h1 ? '✅' : '❌ FAIL'}`);

  // Search bar
  const searchInput = await page.$('input[type="search"], input[placeholder*="Search" i], input[placeholder*="city" i], [role="combobox"], input[aria-label*="search" i]');
  console.log(`Search bar: ${searchInput ? '✅ Found' : '❌ MISSING'}`);

  // Section headings
  const h2s = await page.$$eval('h2', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log(`H2 sections (${h2s.length}): ${JSON.stringify(h2s)}`);

  // Check for key sections
  const bodyText = await page.textContent('body');
  const hasMarketPulse = bodyText.toLowerCase().includes('market') && bodyText.toLowerCase().includes('pulse');
  const hasActivityFeed = bodyText.toLowerCase().includes('activity') || bodyText.toLowerCase().includes('recent');
  const hasCommunities = bodyText.toLowerCase().includes('communit');
  console.log(`  Market pulse section: ${hasMarketPulse ? '✅' : '⚠️ Not found'}`);
  console.log(`  Activity/recent section: ${hasActivityFeed ? '✅' : '⚠️ Not found'}`);
  console.log(`  Communities section: ${hasCommunities ? '✅' : '⚠️ Not found'}`);

  // Nav links
  const navLinks = await page.$$eval('header a, nav a', links =>
    links.map(l => ({ text: l.textContent?.trim(), href: l.getAttribute('href') }))
      .filter(l => l.text && l.href && l.text.length < 50)
  );
  console.log(`Nav links: ${JSON.stringify(navLinks.slice(0, 12))}`);
  const expectedNavItems = ['Home', 'About', 'Team'];
  for (const item of expectedNavItems) {
    const found = navLinks.some(l => l.text?.toLowerCase().includes(item.toLowerCase()));
    console.log(`  Nav "${item}": ${found ? '✅' : '❌ MISSING'}`);
  }

  // Footer
  const footer = await page.$('footer');
  console.log(`Footer: ${footer ? '✅' : '❌ MISSING'}`);
  if (footer) {
    const footerText = await footer.textContent();
    console.log(`  Has contact info: ${footerText.includes('@') || footerText.includes('541') ? '✅' : '⚠️ No contact info'}`);
  }

  // CLS
  const cls = await page.evaluate(() => {
    return new Promise(resolve => {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve(clsValue), 1500);
    });
  });
  console.log(`CLS: ${cls} ${cls < 0.1 ? '✅' : '❌ TOO HIGH'}`);
}

// ===========================
// UJ-002: Search by City Name
// ===========================
async function uj002(page) {
  console.log('\n========== UJ-002: Search by City Name ==========');
  await page.goto(SITE + '/', { waitUntil: 'load', timeout: 60000 });

  // Find search input
  const searchInput = await page.$('input[type="search"], input[placeholder*="Search" i], input[placeholder*="city" i], [role="combobox"], input[aria-label*="search" i]');
  if (!searchInput) {
    console.log('❌ FAIL: No search input found on homepage');
    return;
  }
  console.log('Search input found: ✅');

  // Type "Bend"
  await searchInput.click();
  await searchInput.fill('Bend');
  await page.waitForTimeout(2000);

  await screenshot(page, 'uj002_search_typing');

  // Check for autocomplete dropdown
  const dropdown = await page.$('[role="listbox"], [class*="dropdown"], [class*="autocomplete"], [class*="suggest"], [class*="Combobox"], ul[role="listbox"]');
  console.log(`Autocomplete dropdown: ${dropdown ? '✅ Visible' : '⚠️ Not found (may need different selector)'}`);

  // Check dropdown items
  if (dropdown) {
    const items = await dropdown.$$eval('[role="option"], li, a', els =>
      els.map(e => e.textContent?.trim()).filter(Boolean)
    );
    console.log(`  Dropdown items: ${JSON.stringify(items.slice(0, 5))}`);
    const hasBend = items.some(i => i.toLowerCase().includes('bend'));
    console.log(`  Contains "Bend": ${hasBend ? '✅' : '❌'}`);
  }

  // Navigate to search results
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });

  await screenshot(page, 'uj002_search_results');

  const title = await page.title();
  console.log(`Search page title: "${title}"`);
  console.log(`  Contains "Bend": ${title.toLowerCase().includes('bend') ? '✅' : '❌ FAIL'}`);

  // Check for listing count
  const bodyText = await page.textContent('body');
  const countMatch = bodyText.match(/(\d[\d,]*)\s*(active|listing|homes?\s+for\s+sale)/i);
  console.log(`Listing count text: ${countMatch ? '✅ "' + countMatch[0] + '"' : '⚠️ Count text not found'}`);

  // Check for listing cards/tiles
  const listingCards = await page.$$('[class*="listing"], [class*="card"], [class*="tile"], article');
  console.log(`Listing cards visible: ${listingCards.length > 0 ? '✅ ' + listingCards.length + ' cards' : '❌ NO CARDS'}`);

  // Check filter bar
  const filterBar = await page.$('[class*="filter"], [class*="Filter"], select, [role="combobox"]');
  console.log(`Filter bar: ${filterBar ? '✅' : '⚠️ Not found'}`);

  // Check for map toggle
  const mapToggle = await page.$('button:has-text("Map"), [aria-label*="map" i], [class*="map-toggle"]');
  console.log(`Map toggle: ${mapToggle ? '✅' : '⚠️ Not found via text match'}`);
}

// ===========================
// UJ-003: Apply Filters to Search
// ===========================
async function uj003(page) {
  console.log('\n========== UJ-003: Apply Filters to Search ==========');
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });

  // Look for filter controls
  const priceFilter = await page.$('[class*="price" i], select[name*="price" i], button:has-text("Price"), [aria-label*="price" i]');
  const bedFilter = await page.$('[class*="bed" i], select[name*="bed" i], button:has-text("Bed"), [aria-label*="bed" i]');
  const bathFilter = await page.$('[class*="bath" i], select[name*="bath" i], button:has-text("Bath"), [aria-label*="bath" i]');
  const moreFilters = await page.$('button:has-text("More"), button:has-text("Filter"), [aria-label*="filter" i]');

  console.log(`Price filter: ${priceFilter ? '✅' : '❌ MISSING'}`);
  console.log(`Bed filter: ${bedFilter ? '✅' : '❌ MISSING'}`);
  console.log(`Bath filter: ${bathFilter ? '✅' : '❌ MISSING'}`);
  console.log(`More/Filters button: ${moreFilters ? '✅' : '⚠️ Not found'}`);

  // Check URL params
  await page.goto(SITE + '/homes-for-sale/bend?minPrice=300000&maxPrice=500000&minBeds=3', { waitUntil: 'load', timeout: 60000 });
  const url = page.url();
  console.log(`Filter URL params preserved: ${url.includes('minPrice') || url.includes('minBeds') ? '✅' : '❌ PARAMS LOST'}`);

  await screenshot(page, 'uj003_filtered');

  // Check that results are present
  const cards = await page.$$('[class*="listing"], [class*="card"], article');
  console.log(`Filtered results: ${cards.length} cards visible`);
}

// ===========================
// UJ-004: Sort Search Results
// ===========================
async function uj004(page) {
  console.log('\n========== UJ-004: Sort Search Results ==========');
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });

  // Find sort control
  const sortButton = await page.$('button:has-text("Sort"), select[name*="sort" i], [class*="sort" i], [aria-label*="sort" i]');
  console.log(`Sort control: ${sortButton ? '✅ Found' : '❌ MISSING'}`);

  if (sortButton) {
    await sortButton.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'uj004_sort_dropdown');

    // Check sort options
    const options = await page.$$eval('[role="option"], [role="menuitem"], option, [class*="sort"] li, [class*="Sort"] button', els =>
      els.map(e => e.textContent?.trim()).filter(Boolean)
    );
    console.log(`Sort options: ${JSON.stringify(options.slice(0, 10))}`);
    console.log(`  Has 8+ options: ${options.length >= 8 ? '✅' : '⚠️ Only ' + options.length}`);
  }

  // Check sort via URL
  await page.goto(SITE + '/homes-for-sale/bend?sort=price_desc', { waitUntil: 'load', timeout: 60000 });
  const url = page.url();
  console.log(`Sort in URL: ${url.includes('sort=') ? '✅' : '⚠️ Sort not in URL'}`);
}

// ===========================
// UJ-005: Map View
// ===========================
async function uj005(page) {
  console.log('\n========== UJ-005: Map and Map/List View ==========');
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });

  // Check for map
  const mapContainer = await page.$('[class*="gm-style"], [class*="map"], [id*="map"], iframe[src*="maps"]');
  console.log(`Map container: ${mapContainer ? '✅ Found' : '❌ MISSING'}`);

  // Check for map/list toggle
  const toggleButtons = await page.$$eval('button', btns =>
    btns.map(b => b.textContent?.trim()).filter(t => t && (t.toLowerCase().includes('map') || t.toLowerCase().includes('list') || t.toLowerCase().includes('grid')))
  );
  console.log(`Map/List toggle buttons: ${JSON.stringify(toggleButtons)}`);

  await screenshot(page, 'uj005_map_view');
}

// ===========================
// UJ-007: View Listing Detail Page
// ===========================
async function uj007(page) {
  console.log('\n========== UJ-007: View Listing Detail Page ==========');
  
  // Go to search, click first listing
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });
  
  // Find first listing link
  const listingLinks = await page.$$eval('a[href*="/homes-for-sale/"], a[href*="/listing/"]', links =>
    links.map(l => ({ href: l.getAttribute('href'), text: l.textContent?.trim()?.substring(0, 50) }))
      .filter(l => l.href && (l.href.includes('-9770') || l.href.includes('-9773') || l.href.includes('/listing/')))
  );
  console.log(`Listing links found: ${listingLinks.length}`);
  
  if (listingLinks.length === 0) {
    console.log('❌ FAIL: No listing links found on search page');
    return;
  }
  
  const firstLink = listingLinks[0].href;
  console.log(`First listing: ${firstLink}`);
  
  // Navigate to listing detail
  const fullUrl = firstLink.startsWith('http') ? firstLink : SITE + firstLink;
  await page.goto(fullUrl, { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj007_listing_detail');
  
  // Check photo gallery
  const photos = await page.$$('img[src*="sparkplatform"], img[src*="cdn.resize"], img[src*="photo"], [class*="gallery"] img');
  console.log(`Photos: ${photos.length > 0 ? '✅ ' + photos.length + ' images' : '❌ NO PHOTOS'}`);
  
  // Check price
  const priceText = await page.$$eval('*', els => {
    for (const el of els) {
      const t = el.textContent?.trim();
      if (t && /^\$[\d,]+$/.test(t) && t.length > 5) return t;
    }
    return null;
  });
  console.log(`Price displayed: ${priceText ? '✅ ' + priceText : '❌ NO PRICE'}`);
  
  // Check address
  const h1El = await page.$('h1');
  const h1 = h1El ? await h1El.textContent() : null;
  console.log(`H1 (address): "${h1?.trim() || 'NONE'}"`);
  
  // Check key facts (beds, baths, sqft)
  await page.waitForTimeout(2000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasBeds = /\d+\s*(bed|bd)/i.test(bodyText);
  const hasBaths = /\d+\s*(bath|ba)/i.test(bodyText);
  const hasSqft = /[\d,]+\s*(sq\s*ft|sqft)/i.test(bodyText);
  console.log(`Key facts - Beds: ${hasBeds ? '✅' : '❌'}, Baths: ${hasBaths ? '✅' : '❌'}, Sqft: ${hasSqft ? '✅' : '❌'}`);
  
  // Check description
  const descSection = await page.$('[class*="description"], [class*="Description"]');
  console.log(`Description section: ${descSection ? '✅' : '⚠️ Not found by class'}`);
  
  // Check map
  const map = await page.$('[class*="gm-style"], [class*="map"], iframe[src*="maps"]');
  console.log(`Property map: ${map ? '✅' : '❌ MISSING'}`);
  
  // Check payment estimate
  const hasPayment = bodyText.toLowerCase().includes('monthly payment') || bodyText.toLowerCase().includes('estimated');
  console.log(`Payment estimate: ${hasPayment ? '✅' : '❌ MISSING'}`);
  
  // Check similar listings
  const hasSimilar = bodyText.toLowerCase().includes('similar') || bodyText.toLowerCase().includes('nearby');
  console.log(`Similar listings: ${hasSimilar ? '✅' : '⚠️ Not found'}`);
  
  // Check contact/schedule buttons  
  const contactBtn = await page.$('button:has-text("Schedule"), button:has-text("Contact"), button:has-text("Ask"), a:has-text("Schedule"), a:has-text("Contact"), a:has-text("Ask")');
  console.log(`Contact/Schedule button: ${contactBtn ? '✅' : '❌ MISSING'}`);
  
  // Check save button
  const saveBtn = await page.$('button:has-text("Save"), button[aria-label*="save" i], button[aria-label*="Save" i]');
  console.log(`Save button: ${saveBtn ? '✅' : '⚠️ Not found'}`);
  
  // Check share button  
  const shareBtn = await page.$('button:has-text("Share"), button[aria-label*="share" i]');
  console.log(`Share button: ${shareBtn ? '✅' : '⚠️ Not found'}`);

  // Scroll down to check lower sections
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await screenshot(page, 'uj007_listing_bottom');
}

// ===========================
// UJ-008: Browse Photo Gallery
// ===========================
async function uj008(page) {
  console.log('\n========== UJ-008: Browse Photo Gallery ==========');
  
  // Navigate to a listing
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });
  const listingLinks = await page.$$eval('a[href*="/homes-for-sale/bend/"]', links =>
    links.map(l => l.getAttribute('href')).filter(h => h && h.match(/-\d{5}$/))
  );
  
  if (listingLinks.length === 0) {
    console.log('❌ Cannot find listing to test gallery');
    return;
  }
  
  await page.goto(SITE + listingLinks[0], { waitUntil: 'load', timeout: 60000 });
  
  // Click main photo to open lightbox
  const mainPhoto = await page.$('img[src*="sparkplatform"], img[src*="cdn.resize"]');
  if (!mainPhoto) {
    console.log('❌ No main photo found');
    return;
  }
  
  console.log('Main photo found: ✅');
  await mainPhoto.click();
  await page.waitForTimeout(1000);
  
  await screenshot(page, 'uj008_lightbox');
  
  // Check if lightbox opened
  const lightbox = await page.$('[class*="lightbox"], [class*="Lightbox"], [class*="modal"], [class*="overlay"], [role="dialog"]');
  console.log(`Lightbox opened: ${lightbox ? '✅' : '❌ FAIL'}`);
  
  if (lightbox) {
    // Check for navigation arrows
    const nextBtn = await page.$('button[aria-label*="next" i], button[aria-label*="right" i], [class*="next"], [class*="arrow"]');
    const prevBtn = await page.$('button[aria-label*="prev" i], button[aria-label*="left" i], [class*="prev"]');
    console.log(`Navigation arrows: ${(nextBtn || prevBtn) ? '✅' : '⚠️ Not found by selector'}`);
    
    // Check photo count
    const countText = await page.textContent('[class*="count"], [class*="counter"], [class*="index"]');
    console.log(`Photo count display: ${countText ? '✅ "' + countText.trim() + '"' : '⚠️ Not found'}`);
    
    // Try Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const lightboxAfterEsc = await page.$('[class*="lightbox"], [class*="Lightbox"], [role="dialog"]');
    console.log(`Escape closes lightbox: ${!lightboxAfterEsc ? '✅' : '⚠️ Still open'}`);
  }
}

// ===========================
// UJ-010: Share a Listing
// ===========================
async function uj010(page) {
  console.log('\n========== UJ-010: Share a Listing ==========');
  
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });
  const listingLinks = await page.$$eval('a[href*="/homes-for-sale/bend/"]', links =>
    links.map(l => l.getAttribute('href')).filter(h => h && h.match(/-\d{5}$/))
  );
  
  if (listingLinks.length > 0) {
    await page.goto(SITE + listingLinks[0], { waitUntil: 'load', timeout: 60000 });
  }
  
  // Find share button
  const shareBtn = await page.$('button:has-text("Share"), [aria-label*="share" i]');
  console.log(`Share button: ${shareBtn ? '✅ Found' : '❌ MISSING'}`);
  
  if (shareBtn) {
    await shareBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'uj010_share_menu');
    
    // Check share options
    const bodyText = await page.textContent('body');
    const hasCopyLink = bodyText.includes('Copy') || bodyText.includes('copy');
    const hasEmail = bodyText.includes('Email') || bodyText.includes('email');
    const hasText = bodyText.includes('Text') || bodyText.includes('SMS');
    const hasWhatsApp = bodyText.includes('WhatsApp');
    console.log(`  Copy Link: ${hasCopyLink ? '✅' : '❌'}`);
    console.log(`  Email: ${hasEmail ? '✅' : '❌'}`);
    console.log(`  Text/SMS: ${hasText ? '✅' : '❌'}`);
    console.log(`  WhatsApp: ${hasWhatsApp ? '✅' : '⚠️'}`);
  }
}

// ===========================
// UJ-011: Contact Agent from Listing
// ===========================
async function uj011(page) {
  console.log('\n========== UJ-011: Contact Agent from Listing ==========');
  
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });
  const listingLinks = await page.$$eval('a[href*="/homes-for-sale/bend/"]', links =>
    links.map(l => l.getAttribute('href')).filter(h => h && h.match(/-\d{5}$/))
  );
  
  if (listingLinks.length > 0) {
    await page.goto(SITE + listingLinks[0], { waitUntil: 'load', timeout: 60000 });
  }
  
  // Find contact/schedule buttons
  const scheduleBtn = await page.$('a:has-text("Schedule"), button:has-text("Schedule")');
  const askBtn = await page.$('a:has-text("Ask"), button:has-text("Ask")');
  const contactBtn = await page.$('a:has-text("Contact"), button:has-text("Contact")');
  
  console.log(`Schedule button: ${scheduleBtn ? '✅' : '❌ MISSING'}`);
  console.log(`Ask question button: ${askBtn ? '✅' : '❌ MISSING'}`);
  console.log(`Contact button: ${contactBtn ? '✅' : '⚠️ Not found'}`);
  
  // Check where schedule links to
  if (scheduleBtn) {
    const href = await scheduleBtn.getAttribute('href');
    console.log(`  Schedule href: ${href}`);
    console.log(`  Includes listing context: ${href?.includes('listing=') ? '✅' : '❌ NO LISTING CONTEXT'}`);
    
    if (href) {
      // Navigate to the contact page
      await page.goto(SITE + href, { waitUntil: 'load', timeout: 60000 });
      await screenshot(page, 'uj011_contact_form');
      
      // Check form fields
      const nameInput = await page.$('input[name="name"], input[id*="name" i]');
      const emailInput = await page.$('input[name="email"], input[type="email"]');
      const phoneInput = await page.$('input[name="phone"], input[type="tel"]');
      const messageInput = await page.$('textarea, [name="message"]');
      
      console.log(`  Name field: ${nameInput ? '✅' : '❌'}`);
      console.log(`  Email field: ${emailInput ? '✅' : '❌'}`);
      console.log(`  Phone field: ${phoneInput ? '✅' : '❌'}`);
      console.log(`  Message field: ${messageInput ? '✅' : '❌'}`);
      
      // Check if listing context is shown
      const pageText = await page.textContent('body');
      const hasListingRef = pageText.includes('listing') || pageText.includes('Listing') || pageText.includes('showing');
      console.log(`  Listing context preserved: ${hasListingRef ? '⚠️ Some reference' : '❌ NO LISTING CONTEXT IN FORM'}`);
    }
  }
}

// ===========================
// UJ-012: Browse Team Page
// ===========================
async function uj012(page) {
  console.log('\n========== UJ-012: Browse Team Page ==========');
  await page.goto(SITE + '/team', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj012_team');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  // Check for broker cards
  const bodyText = await page.textContent('body');
  const hasMatt = bodyText.includes('Matt Ryan');
  const hasPaul = bodyText.includes('Paul Stevenson');
  const hasRebecca = bodyText.includes('Rebecca');
  console.log(`Matt Ryan: ${hasMatt ? '✅' : '❌ MISSING'}`);
  console.log(`Paul Stevenson: ${hasPaul ? '✅' : '❌ MISSING'}`);
  console.log(`Rebecca: ${hasRebecca ? '✅' : '❌ MISSING'}`);
  
  // Check broker photos
  const brokerImages = await page.$$('img[src*="broker"], img[alt*="broker" i], img[alt*="Matt" i], img[alt*="Paul" i], img[alt*="Rebecca" i]');
  console.log(`Broker photos: ${brokerImages.length > 0 ? '✅ ' + brokerImages.length : '⚠️ Not found by selector'}`);
  
  // Click first broker
  const brokerLinks = await page.$$eval('a[href*="/team/"]', links =>
    links.map(l => ({ href: l.getAttribute('href'), text: l.textContent?.trim()?.substring(0, 30) }))
      .filter(l => l.href && l.href !== '/team' && l.href !== '/team/')
  );
  console.log(`Broker profile links: ${brokerLinks.length > 0 ? '✅ ' + JSON.stringify(brokerLinks) : '❌ NO LINKS'}`);
  
  if (brokerLinks.length > 0) {
    await page.goto(SITE + brokerLinks[0].href, { waitUntil: 'load', timeout: 60000 });
    await screenshot(page, 'uj012_broker_detail');
    
    const profileText = await page.textContent('body');
    const hasBio = profileText.length > 200;
    const hasContactInfo = profileText.includes('@') || profileText.includes('541') || profileText.includes('415');
    console.log(`  Broker profile bio: ${hasBio ? '✅' : '❌ MISSING/SHORT'}`);
    console.log(`  Contact info: ${hasContactInfo ? '✅' : '❌ MISSING'}`);
  }
}

// ===========================
// UJ-014: Browse Market Reports
// ===========================
async function uj014(page) {
  console.log('\n========== UJ-014: Browse Market Reports ==========');
  await page.goto(SITE + '/housing-market', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj014_market_hub');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  const bodyText = await page.textContent('body');
  const hasCityCards = bodyText.includes('Bend') && bodyText.includes('Redmond');
  console.log(`City cards present: ${hasCityCards ? '✅' : '⚠️'}`);
  
  // Navigate to Bend market report
  await page.goto(SITE + '/housing-market/bend', { waitUntil: 'load', timeout: 60000 });
  await screenshot(page, 'uj014_market_bend');
  
  const bendTitle = await page.title();
  console.log(`Bend market title: "${bendTitle}"`);
  
  const bendText = await page.textContent('body');
  const hasMedianPrice = bendText.includes('Median') || bendText.includes('median');
  const hasDOM = bendText.includes('Days') || bendText.includes('DOM') || bendText.includes('days on market');
  const hasChart = await page.$('canvas, svg, [class*="chart"], [class*="Chart"], [class*="recharts"]');
  
  console.log(`Median price: ${hasMedianPrice ? '✅' : '❌ MISSING'}`);
  console.log(`Days on market: ${hasDOM ? '✅' : '❌ MISSING'}`);
  console.log(`Charts: ${hasChart ? '✅' : '❌ MISSING'}`);
}

// ===========================
// UJ-015: Read a Guide
// ===========================
async function uj015(page) {
  console.log('\n========== UJ-015: Read a Guide/Blog Post ==========');
  await page.goto(SITE + '/guides', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj015_guides');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  // Check if guides are listed
  const guideLinks = await page.$$eval('a[href*="/guides/"]', links =>
    links.map(l => ({ href: l.getAttribute('href'), text: l.textContent?.trim()?.substring(0, 60) }))
      .filter(l => l.href && l.href !== '/guides' && l.href !== '/guides/')
  );
  console.log(`Guide links: ${guideLinks.length > 0 ? '✅ ' + guideLinks.length + ' guides' : '❌ NO GUIDES LISTED'}`);
  console.log(`  Sample: ${JSON.stringify(guideLinks.slice(0, 3))}`);
  
  // Check if empty state message
  const bodyText = await page.textContent('body');
  const isEmpty = bodyText.includes('No guides') || bodyText.includes('coming soon') || bodyText.includes('no published');
  console.log(`Empty state: ${isEmpty ? '⚠️ Shows empty state' : '✅ Has content'}`);
}

// ===========================
// UJ-016: Browse Open Houses
// ===========================
async function uj016(page) {
  console.log('\n========== UJ-016: Browse Open Houses ==========');
  await page.goto(SITE + '/open-houses', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj016_open_houses');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  const bodyText = await page.textContent('body');
  const hasOpenHouses = bodyText.includes('Open House') || bodyText.includes('open house');
  const isEmpty = bodyText.toLowerCase().includes('no open houses') || bodyText.toLowerCase().includes('no upcoming');
  console.log(`Open house content: ${hasOpenHouses ? '✅' : '❌ MISSING'}`);
  console.log(`Shows empty state: ${isEmpty ? '⚠️ No open houses data' : '✅ Has data'}`);
}

// ===========================
// UJ-017: Mortgage Calculator
// ===========================
async function uj017(page) {
  console.log('\n========== UJ-017: Use Mortgage Calculator ==========');
  await page.goto(SITE + '/tools/mortgage-calculator', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj017_mortgage_calc');
  
  // Check for input fields
  const priceInput = await page.$('input[name*="price" i], input[id*="price" i], input[placeholder*="price" i]');
  const downInput = await page.$('input[name*="down" i], input[id*="down" i]');
  const rateInput = await page.$('input[name*="rate" i], input[id*="rate" i], input[name*="interest" i]');
  
  console.log(`Price input: ${priceInput ? '✅' : '❌ MISSING'}`);
  console.log(`Down payment input: ${downInput ? '✅' : '❌ MISSING'}`);
  console.log(`Rate input: ${rateInput ? '✅' : '❌ MISSING'}`);
  
  // Check for payment output
  const bodyText = await page.textContent('body');
  const hasPayment = /\$[\d,]+\s*\/\s*mo/i.test(bodyText) || bodyText.includes('Monthly Payment') || bodyText.includes('monthly payment');
  console.log(`Payment display: ${hasPayment ? '✅' : '❌ MISSING'}`);
}

// ===========================
// UJ-018: View Community Page
// ===========================
async function uj018(page) {
  console.log('\n========== UJ-018: View Community Page ==========');
  await page.goto(SITE + '/homes-for-sale/bend/tetherow', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj018_community');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  console.log(`  Mentions community: ${title.toLowerCase().includes('tetherow') ? '✅' : '❌ MISSING'}`);
  
  const bodyText = await page.textContent('body');
  const hasListings = await page.$$('[class*="listing"], [class*="card"], article');
  console.log(`Community listings: ${hasListings.length > 0 ? '✅ ' + hasListings.length : '❌ NO LISTINGS'}`);
  
  const hasDescription = bodyText.length > 500;
  console.log(`Description content: ${hasDescription ? '✅' : '⚠️ Thin content'}`);
}

// ===========================
// UJ-019: Navigate Between Pages
// ===========================
async function uj019(page) {
  console.log('\n========== UJ-019: Navigate Between Pages ==========');
  
  const routes = [
    { path: '/', name: 'Home' },
    { path: '/about', name: 'About' },
    { path: '/team', name: 'Team' },
    { path: '/homes-for-sale', name: 'Listings' },
    { path: '/housing-market', name: 'Market Reports' },
    { path: '/contact', name: 'Contact' },
    { path: '/sell', name: 'Sell' },
    { path: '/buy', name: 'Buy' },
    { path: '/guides', name: 'Guides' },
    { path: '/open-houses', name: 'Open Houses' },
    { path: '/tools/mortgage-calculator', name: 'Mortgage Calculator' },
    { path: '/communities', name: 'Communities' },
    { path: '/sell/valuation', name: 'Valuation' },
    { path: '/blog', name: 'Blog' },
    { path: '/privacy', name: 'Privacy' },
    { path: '/terms', name: 'Terms' },
  ];
  
  for (const route of routes) {
    try {
      const response = await page.goto(SITE + route.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = response?.status();
      const finalUrl = page.url();
      const isRedirect = !finalUrl.endsWith(route.path) && !finalUrl.endsWith(route.path + '/');
      console.log(`${route.name} (${route.path}): ${status === 200 ? '✅' : '❌ ' + status}${isRedirect ? ' → ' + finalUrl : ''}`);
    } catch (e) {
      console.log(`${route.name} (${route.path}): ❌ ERROR - ${e.message?.substring(0, 50)}`);
    }
  }
}

// ===========================
// UJ-020: Mobile Experience
// ===========================
async function uj020(browser) {
  console.log('\n========== UJ-020: Mobile Experience (375px) ==========');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await mobileContext.newPage();
  
  // Homepage
  await page.goto(SITE + '/', { waitUntil: 'load', timeout: 60000 });
  await screenshot(page, 'uj020_mobile_home');
  
  // Check for horizontal overflow
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`Horizontal overflow: ${hasHorizontalOverflow ? '❌ OVERFLOW DETECTED' : '✅ No overflow'}`);
  
  // Check for hamburger menu
  const hamburger = await page.$('button[aria-label*="menu" i], button[aria-label*="nav" i], [class*="hamburger"], [class*="mobile-menu"], button:has(svg)');
  console.log(`Hamburger menu: ${hamburger ? '✅' : '⚠️ Not found by selector'}`);
  
  if (hamburger) {
    await hamburger.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'uj020_mobile_menu');
    
    const menuItems = await page.$$eval('[role="dialog"] a, [class*="sheet"] a, [class*="Sheet"] a, nav a', links =>
      links.map(l => l.textContent?.trim()).filter(Boolean)
    );
    console.log(`  Menu items: ${JSON.stringify(menuItems.slice(0, 10))}`);
  }
  
  // Check listing detail on mobile
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 60000 });
  await screenshot(page, 'uj020_mobile_search');
  
  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`Search page overflow: ${mobileOverflow ? '❌ OVERFLOW' : '✅ No overflow'}`);
  
  // Check touch targets
  const smallButtons = await page.$$eval('button, a', els =>
    els.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44) && rect.width < 200;
    }).length
  );
  console.log(`Small touch targets (<44px): ${smallButtons === 0 ? '✅ None' : '⚠️ ' + smallButtons + ' found'}`);
  
  await mobileContext.close();
}

// ===========================
// UJ-013: Home Valuation
// ===========================
async function uj013(page) {
  console.log('\n========== UJ-013: Home Valuation Tool ==========');
  await page.goto(SITE + '/sell/valuation', { waitUntil: 'load', timeout: 60000 });
  
  await screenshot(page, 'uj013_valuation');
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  // Check for address input
  const addressInput = await page.$('input[name*="address" i], input[placeholder*="address" i], input[id*="address" i], input[type="text"]');
  console.log(`Address input: ${addressInput ? '✅' : '❌ MISSING'}`);
  
  // Check for submit button
  const submitBtn = await page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Get"), button:has-text("Estimate")');
  console.log(`Submit button: ${submitBtn ? '✅' : '❌ MISSING'}`);
}

// ===========================
// MAIN
// ===========================
async function dismissModals(page) {
  // Dismiss sign-in prompt
  const maybeLater = await page.$('button:has-text("Maybe later")');
  if (maybeLater) {
    await maybeLater.click();
    await page.waitForTimeout(300);
  }
  // Dismiss cookie consent
  const acceptAll = await page.$('button:has-text("Accept All"), button:has-text("Accept")');
  if (acceptAll) {
    await acceptAll.click();
    await page.waitForTimeout(300);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const journeys = [
    () => uj001(page),
    () => dismissModals(page),
    () => uj002(page),
    () => dismissModals(page),
    () => uj003(page),
    () => uj004(page),
    () => uj005(page),
    () => uj007(page),
    () => dismissModals(page),
    () => uj008(page),
    () => uj010(page),
    () => uj011(page),
    () => uj012(page),
    () => uj013(page),
    () => uj014(page),
    () => uj015(page),
    () => uj016(page),
    () => uj017(page),
    () => uj018(page),
    () => uj019(page),
    () => uj020(browser),
  ];
  
  for (const journey of journeys) {
    try {
      await journey();
    } catch (e) {
      console.error('ERROR in journey:', e.message?.substring(0, 200));
    }
  }
  
  await browser.close();
}

main();
