import { chromium } from 'playwright';

const BASE = 'http://localhost:3021';
const OUT = '/Users/matthewryan/RyanRealty/docs/design-audit/assets';

const pages = [
  { slug: 'home', path: '/' },
  { slug: 'search', path: '/homes-for-sale' },
  { slug: 'search-bend', path: '/homes-for-sale/bend' },
  { slug: 'listing', path: '/homes-for-sale/bend/19077-mount-mcloughlin-220224613' },
  { slug: 'housing-market', path: '/housing-market' },
  { slug: 'sell', path: '/sell' },
  { slug: 'valuation', path: '/sell/valuation' },
  { slug: 'buy', path: '/buy' },
  { slug: 'contact', path: '/contact' },
  { slug: 'team', path: '/team' },
  { slug: 'communities', path: '/communities' },
  { slug: 'blog', path: '/blog' },
  { slug: 'about', path: '/about' },
  { slug: 'open-houses', path: '/open-houses' },
  { slug: '404', path: '/definitely-not-a-real-page' },
];

const mobilePages = ['home', 'search', 'listing', 'sell', 'housing-market', 'contact'];

const browser = await chromium.launch();

async function shoot(viewport, suffix, list, fullPage) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1.5,
    isMobile: suffix === 'mobile',
    hasTouch: suffix === 'mobile',
    userAgent: suffix === 'mobile'
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  // pre-dismiss cookie banner via consent cookie? Instead click it on first page.
  const page = await ctx.newPage();
  for (const { slug, path } of list) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 });
    } catch { /* keep going; capture whatever rendered */ }
    await page.waitForTimeout(2500);
    // dismiss cookie banner if present
    try {
      const btn = page.getByRole('button', { name: 'Accept All' });
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(400);
      }
    } catch {}
    // nudge lazy sections
    try {
      await page.evaluate(async () => {
        const h = document.body.scrollHeight;
        for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800);
    } catch {}
    await page.screenshot({ path: `${OUT}/${slug}-${suffix}.png` });
    if (fullPage) {
      await page.screenshot({ path: `${OUT}/${slug}-${suffix}-full.png`, fullPage: true });
    }
    console.log(`done ${slug}-${suffix}`);
  }
  await ctx.close();
}

await shoot({ width: 1440, height: 900 }, 'desktop', pages, true);
await shoot({ width: 390, height: 844 }, 'mobile', pages.filter(p => mobilePages.includes(p.slug)), true);

await browser.close();
console.log('ALL DONE');
