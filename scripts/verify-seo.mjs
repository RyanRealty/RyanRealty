import { chromium } from 'playwright';

const SITE = 'https://ryanrealty.vercel.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('========== Section D: SEO & Crawler Verification ==========');

  // UJ-070: Sitemap Validation
  console.log('\n--- UJ-070: Sitemap ---');
  const sitemapRes = await page.goto(SITE + '/sitemap.xml', { waitUntil: 'load', timeout: 60000 });
  console.log('  Status:', sitemapRes?.status());
  const sitemapContent = await page.content();
  const urlCount = (sitemapContent.match(/<url>/g) || []).length;
  console.log('  URL count:', urlCount);

  const httpUrls = (sitemapContent.match(/http:\/\/ryanrealty/g) || []).length;
  const httpsUrls = (sitemapContent.match(/https:\/\/ryanrealty/g) || []).length;
  console.log('  http:// URLs:', httpUrls, httpUrls > 0 ? '❌ FAIL' : '✅');
  console.log('  https:// URLs:', httpsUrls);

  const locs = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) || [];
  const uniqueLocs = new Set(locs);
  console.log('  Duplicate URLs:', locs.length - uniqueLocs.size, locs.length - uniqueLocs.size > 0 ? '⚠️' : '✅');

  // UJ-071: Meta Tags per page type
  console.log('\n--- UJ-071: Meta Tags on Key Pages ---');
  const pagesToCheck = [
    '/',
    '/homes-for-sale/bend',
    '/team',
    '/about',
    '/housing-market',
    '/contact',
    '/guides',
    '/sell/valuation',
  ];

  for (const path of pagesToCheck) {
    try {
      await page.goto(SITE + path, { waitUntil: 'load', timeout: 30000 });
      const title = await page.title();
      const desc = await page.getAttribute('meta[name="description"]', 'content');
      const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
      const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
      const canonical = await page.getAttribute('link[rel="canonical"]', 'href');

      const issues = [];
      if (!title || title.length < 10) issues.push('no/short title');
      if (!desc || desc.length < 50) issues.push('no/short desc');
      if (!ogTitle) issues.push('no og:title');
      if (!ogImage) issues.push('no og:image');
      if (canonical && canonical.startsWith('http://')) issues.push('canonical uses http://');

      console.log('  ' + path + ': ' + (issues.length === 0 ? '✅' : '❌ ' + issues.join(', ')));
    } catch {
      console.log('  ' + path + ': TIMEOUT');
    }
  }

  // UJ-072: Structured Data on listing
  console.log('\n--- UJ-072: Structured Data ---');
  await page.goto(SITE + '/homes-for-sale/bend', { waitUntil: 'load', timeout: 30000 });
  const listingLinks = await page.$$eval('a[href*="/homes-for-sale/bend/"]', links =>
    links.map(l => l.getAttribute('href')).filter(h => h && h.match(/-\d{5}$/))
  );
  if (listingLinks.length > 0) {
    await page.goto(SITE + listingLinks[0], { waitUntil: 'load', timeout: 30000 });
    const jsonLdScripts = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent));
    console.log('  JSON-LD blocks:', jsonLdScripts.length);
    for (const script of jsonLdScripts) {
      try {
        const parsed = JSON.parse(script);
        const type = parsed['@type'];
        console.log('    Type:', Array.isArray(type) ? type.join(', ') : type);
        const hasHttp = script.includes('http://ryanrealty');
        if (hasHttp) console.log('    ❌ Contains http:// URLs');
      } catch {
        console.log('    ❌ Invalid JSON');
      }
    }
  }

  // UJ-073: AI Crawler Access
  console.log('\n--- UJ-073: AI Crawler Access ---');
  await page.goto(SITE + '/robots.txt', { waitUntil: 'load', timeout: 15000 });
  const robotsContent = await page.content();
  const aiCrawlers = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended'];
  for (const crawler of aiCrawlers) {
    console.log('  ' + crawler + ': ' + (robotsContent.includes(crawler) ? '✅ Allowed' : '❌ Not mentioned'));
  }

  await browser.close();
}

main().catch(console.error);
