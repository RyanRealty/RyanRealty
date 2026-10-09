/**
 * /blog/<town>-housing-market-guide URLs listed in /llms.txt that 404.
 * 301 to the live /housing-market page for that town (cityMarketPath), only
 * where that target is a real market page (not a hop, not a not-found shell).
 */
export const BLOG_HOUSING_MARKET_GUIDE_REDIRECTS: ReadonlyArray<{
  source: string
  destination: string
}> = [
  { source: '/blog/bend-housing-market-guide', destination: '/housing-market/bend' },
  { source: '/blog/black-butte-ranch-housing-market-guide', destination: '/housing-market/sisters/black-butte-ranch' },
  { source: '/blog/camp-sherman-housing-market-guide', destination: '/housing-market/camp-sherman' },
  { source: '/blog/culver-housing-market-guide', destination: '/housing-market/culver' },
  { source: '/blog/la-pine-housing-market-guide', destination: '/housing-market/la-pine' },
  { source: '/blog/madras-housing-market-guide', destination: '/housing-market/madras' },
  { source: '/blog/powell-butte-housing-market-guide', destination: '/housing-market/powell-butte' },
  { source: '/blog/prineville-housing-market-guide', destination: '/housing-market/prineville' },
  { source: '/blog/redmond-housing-market-guide', destination: '/housing-market/redmond' },
  { source: '/blog/sisters-housing-market-guide', destination: '/housing-market/sisters' },
  { source: '/blog/sunriver-housing-market-guide', destination: '/housing-market/sunriver' },
  { source: '/blog/terrebonne-housing-market-guide', destination: '/housing-market/terrebonne' },
  // /housing-market/tumalo is a not-found shell; the live door is the city page.
  { source: '/blog/tumalo-housing-market-guide', destination: '/cities/tumalo' },
  // Crooked River Ranch has no market report; the community page is live.
  { source: '/blog/crooked-river-ranch-housing-market-guide', destination: '/communities/crooked-river-ranch' },
]
