import { describe, it, expect } from "vitest"
import { shouldHideDefaultChrome, KB_ROUTES } from "./chrome-routes"

/**
 * These lock the "double nav" contract (Matt reports 2026-06-18, 2026-07-11):
 *  - The search INDEX (/homes-for-sale, exact) HIDES the default chrome — it now
 *    renders KbNav (solid) as the single site nav (design-audit NAV-1). It must
 *    render KbNav, or this route would have ZERO headers.
 *  - The /homes-for-sale/<city> search-form pages still KEEP the default chrome
 *    (not yet migrated) — they must return false so exactly one SiteHeader renders.
 *  - KB routes + LP/admin/sign/concept + homepage HIDE the default chrome.
 * A regression that flips a city-form route to `true` while it still renders
 * SiteHeader would strip its only header; flipping a KB route to `false` doubles.
 */
describe("shouldHideDefaultChrome", () => {
  it("HIDES chrome on the search INDEX (KbNav) but KEEPS it on city-form pages", () => {
    // Index → KbNav (own chrome) → hidden
    expect(shouldHideDefaultChrome("/homes-for-sale")).toBe(true)
    // City/filter search-form pages (still SiteHeader) → default chrome kept
    for (const path of [
      "/homes-for-sale/bend",
      "/homes-for-sale/bend/awbrey-butte",
      "/homes-for-sale/bend/awbrey-butte?minPrice=500000", // query stripped in practice
    ]) {
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
