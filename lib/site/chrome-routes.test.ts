import { describe, it, expect } from "vitest"
import { shouldHideDefaultChrome, KB_ROUTES } from "./chrome-routes"

/**
 * These lock the "double nav" contract (Matt reports 2026-06-18, 2026-07-11):
 *  - EVERY /homes-for-sale surface HIDES the default chrome — the index + the
 *    city-form pages render KbNav (solid) via app/search/layout.tsx, and listing
 *    detail via app/listing (design-audit NAV-1). They MUST render KbNav, or the
 *    route would have ZERO headers.
 *  - KB routes + LP/admin/sign/concept + homepage HIDE the default chrome.
 * A regression that flips a search route to `false` would double-render chrome
 * (KbNav from the search layout + the default SiteHeader).
 */
describe("shouldHideDefaultChrome", () => {
  it("HIDES chrome across the whole /homes-for-sale tree (single KbNav)", () => {
    for (const path of [
      "/homes-for-sale",
      "/homes-for-sale/bend",
      "/homes-for-sale/bend/awbrey-butte",
      "/homes-for-sale/bend/awbrey-butte?minPrice=500000", // query stripped in practice
      "/homes-for-sale/bend/on-golf-course",
    ]) {
      const bare = path.split("?")[0]
      expect(shouldHideDefaultChrome(bare), bare).toBe(true)
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

  it("all /homes-for-sale URLs (listing-detail + search) hide chrome (single KbNav)", () => {
    expect(shouldHideDefaultChrome("/homes-for-sale/listing/220189422")).toBe(true)
    expect(shouldHideDefaultChrome("/homes-for-sale/bend/123-nw-main-st-220189422")).toBe(true)
    expect(shouldHideDefaultChrome("/homes-for-sale/bend")).toBe(true)
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
