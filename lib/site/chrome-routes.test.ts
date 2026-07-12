import { describe, it, expect } from "vitest"
import { shouldHideDefaultChrome, KB_ROUTES } from "./chrome-routes"

/**
 * These lock the "double nav" contract (Matt reports 2026-06-18, 2026-07-11):
 *  - Search URLs (/homes-for-sale + city/filter variants) KEEP the default
 *    chrome — they must return false so exactly one SiteHeader renders.
 *  - KB routes + LP/admin/sign/concept + homepage HIDE the default chrome.
 * A regression that flips /homes-for-sale to `true` (hidden) would strip the
 * only header; flipping a KB route to `false` would double-render chrome.
 */
describe("shouldHideDefaultChrome", () => {
  it("KEEPS default chrome on the search surface (exactly one SiteHeader)", () => {
    for (const path of [
      "/homes-for-sale",
      "/homes-for-sale/bend",
      "/homes-for-sale/bend/awbrey-butte",
      "/homes-for-sale?currentUse=Timber&keywords=61192+tall", // Matt's screenshot URL (path only in practice)
    ]) {
      // usePathname never carries the query string, but guard the bare path too.
      const bare = path.split("?")[0]
      expect(shouldHideDefaultChrome(bare), bare).toBe(false)
    }
  })

  it("HIDES default chrome on the homepage and its own-chrome surfaces", () => {
    for (const path of ["/", "/lp/seller-home-value", "/admin", "/admin/approval-queue", "/sign/abc123", "/concept/x"]) {
      expect(shouldHideDefaultChrome(path), path).toBe(true)
    }
  })

  it("HIDES on KB routes but KEEPS on their non-KB siblings", () => {
    // KB (own chrome) → hidden
    for (const path of ["/about", "/cities/bend", "/communities/tetherow", "/listing/220189422", "/sell", "/sell/valuation", "/reports/explore", "/housing-market", "/housing-market/central-oregon"]) {
      expect(shouldHideDefaultChrome(path), `KB ${path}`).toBe(true)
    }
    // non-KB siblings → default chrome kept
    for (const path of ["/team/rebecca-peterson/edit", "/housing-market/bend/awbrey-butte", "/reports/sales-report/bend", "/listing/by-address/foo"]) {
      expect(shouldHideDefaultChrome(path), `non-KB ${path}`).toBe(false)
    }
  })

  it("listing-detail URLs under /homes-for-sale hide chrome, search URLs do not", () => {
    expect(shouldHideDefaultChrome("/homes-for-sale/listing/220189422")).toBe(true)
    expect(shouldHideDefaultChrome("/homes-for-sale/bend/123-nw-main-st-220189422")).toBe(true)
    expect(shouldHideDefaultChrome("/homes-for-sale/bend")).toBe(false)
  })

  it("defaults to SHOWING chrome when the pathname is unknown", () => {
    expect(shouldHideDefaultChrome(null)).toBe(false)
    expect(shouldHideDefaultChrome(undefined)).toBe(false)
    expect(shouldHideDefaultChrome("")).toBe(false)
  })

  it("KB_ROUTES are all anchored regexes (no accidental substring matches)", () => {
    for (const re of KB_ROUTES) {
      expect(re.source.startsWith("^"), re.source).toBe(true)
      expect(re.source.endsWith("$"), re.source).toBe(true)
    }
  })
})
