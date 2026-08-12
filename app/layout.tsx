import type { Metadata, Viewport } from "next";
import { validateEnv } from "@/lib/env";
import { Suspense } from "react";
import "./globals.css";
import "@/components/site/kb/kb.css";
import { V3Chrome } from "@/components/site/v3/V3Chrome";
import { RootProvider } from "../components/site/providers";
import HideOnLP from "../components/layout/HideOnLP";
// PublicClientLayer bundles the interactive public client components (prompts,
// comparison tray, visitor/intent trackers, auth bridges) behind route-aware
// dynamic imports so their chunks never load on /admin (RC3 drop-public-bundle).
import PublicClientLayer from "../components/layout/PublicClientLayer";
// Reclaims React's streamed `<div hidden id="S:n">` Suspense content containers
// on tabs that never paint (background tabs, headless renderers). React 19
// defers the first reveal to requestAnimationFrame, which never fires there,
// leaving a second full copy of the page body in the DOM. See the component.
import StreamedBoundaryReclaimer from "../components/layout/StreamedBoundaryReclaimer";
import JsonLd from "../components/JsonLd";
import GTMHead from "../components/GTMHead";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import AdminHashRedirect from "../components/AdminHashRedirect";
import StaleServiceWorkerReset from "@/components/site/StaleServiceWorkerReset";
import { getCanonicalSiteUrl } from "@/lib/share-metadata";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

// Amboqia Boriango — Ryan Realty's locked display face. Used for hero H1s,
// pull quotes, yard-sign text, IG cover titles. Body copy stays Geist.
const amboqia = localFont({
  src: '../public/fonts/Amboqia_Boriango.otf',
  variable: '--font-amboqia',
  display: 'swap',
  weight: '400',
})

/** Revalidate every 60s so pages load instantly from cache but data stays fresh. */
export const revalidate = 60

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalSiteUrl()),
  title: {
    default: "Ryan Realty — Central Oregon Real Estate",
    template: "%s | Ryan Realty — Central Oregon",
  },
  description:
    "Find your next home in Bend, Redmond, Sisters, and across Central Oregon. Ryan Realty offers expert local real estate service, listings, and market insights.",
  keywords: ["Central Oregon", "homes for sale", "real estate", "Bend", "Redmond", "Sisters", "listings", "MLS"],
  openGraph: {
    title: "Ryan Realty — Central Oregon Real Estate",
    description: "Find your next home in Bend and Central Oregon. Expert real estate service, listings, and market insights.",
    type: "website",
    url: getCanonicalSiteUrl(),
    siteName: "Ryan Realty",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ryan Realty — Central Oregon Real Estate",
    description: "Find your next home in Bend and Central Oregon. Expert real estate service and listings.",
  },
  robots: "index, follow",
  // No blanket alternates.canonical here — a root-layout canonical silently
  // masks every page that forgets its own canonical (Google sees the homepage
  // URL as canonical for every route). Each page sets its own canonical.
  // The homepage canonical lives in app/page.tsx.
  other: {
    // Meta Business Portfolio (Ryan Realty LLC) domain verification for ryan-realty.com
    // Required for Meta Pixel/CAPI on owned domain + ads attribution + AEM priority events.
    "facebook-domain-verification": "u2o7h6orbfu10vsgp4rmihm91j3atf",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#102742",
};

/* Public chrome is fully static — no brokerage fetch, no server-side cookie
 * read, no Suspense wrapper required. V3Chrome is the single public header;
 * SiteFooter is route-owned. Static shell stays cacheable at the edge. */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envCheck = validateEnv();
  if (!envCheck.ok) {
    console.error('[env] Missing required build vars:', envCheck.missing.join(', '));
  }

  // No top-level dynamic API calls in this Server Component — every
  // auth-aware island lives inside a <Suspense> + <HideOnLP> below, so
  // the static shell prerenders for every route (the LP-strip flips to
  // a client-side decision via usePathname() inside HideOnLP). This is
  // what unblocks the static prerender for /cities/[slug],
  // /communities/[slug], /zip/[zip], /listing/[listingKey] — the
  // routes whose cold-cache p95 was failing SITE_SPEC §45-47.

  return (
    <html lang="en" className={cn("font-sans", GeistSans.variable, GeistMono.variable, amboqia.variable)}>
      <head>
        <GTMHead />
        <link rel="manifest" href="/manifest.json" />
        {/* NO hero preload here, deliberately (2026-08-02).
            This used to preload /images/hero-poster.webp at fetchPriority=high
            on EVERY route, and no hero renders that file — it is a pulse brand
            card (lib/pulse-brand-cards.ts). The hero the site actually paints is
            KbHero's posterSrc, /images/hero/hero-old-mill-master-4k.jpg at
            685 KB, which had no preload at all.
            Measured consequence, CrUX field data: LCP p75 2,692 ms, of which
            1,239 ms is image resource LOAD DELAY — 46% of the metric spent
            before the request even starts, while a 12 KB file nothing displays
            was fetched at top priority.
            KbHero now preloads its OWN posterSrc, so each route preloads the
            image that route actually paints. React hoists the link into head. */}
        {/* Spark listing photos serve from this CDN on nearly every route
            (homepage tiles, search, listing detail). Preconnect warms the
            TCP+TLS handshake before the first <img> request fires. */}
        <link rel="preconnect" href="https://cdn.resize.sparkplatform.com" />
        <link rel="dns-prefetch" href="https://cdn.resize.sparkplatform.com" />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased">
        {/* Evict any stale service worker left by the pre-cutover site on this
            domain. Runs on every route (outside HideOnLP). No-op for the 99%
            of visitors with a clean browser. */}
        <StaleServiceWorkerReset />
        {/* Drains React's deferred Suspense-reveal queue on tabs that never
            paint, so the streamed body container is not left in the DOM as a
            second full copy of the page. No-op on any visible tab. */}
        <StreamedBoundaryReclaimer />
        <RootProvider>
          <HideOnLP>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[100] focus:p-4 focus:bg-card focus:text-primary">
              Skip to main content
            </a>
          </HideOnLP>
          <HideOnLP>
            <JsonLd />
          </HideOnLP>
          {/* ONE public header: V3Chrome from lib/site-nav.ts (Homes · Places ·
              Market · Sell · About). Self-hides on LP / admin / sign / account /
              dashboard. SiteFooter stays route-owned (check-default-chrome-footer)
              — never mount a hidden global footer. */}
          <V3Chrome />
          <div id="main-content" tabIndex={-1} className="min-h-[calc(100vh-64px)]">{children}</div>
          {/* Real-user Core Web Vitals -> /api/web-vitals + GA4 (field CWV). */}
          <WebVitalsReporter />
          <Suspense fallback={null}>
            {/* AdminHashRedirect catches legacy /#admin-hash bookmarks on public
                routes and forwards them to /admin. Kept in the root (admin-adjacent,
                tiny). */}
            <HideOnLP>
              <AdminHashRedirect />
            </HideOnLP>
          </Suspense>
          {/* Every other interactive public client component — the sign-in /
              install prompts, the visitor + intent trackers, the OAuth/sign-up
              bridges, and the comparison tray — is code-split behind
              PublicClientLayer so /admin never loads their chunks. Non-admin
              behavior is byte-identical (each keeps its HideOnLP / Suspense gate). */}
          <PublicClientLayer />
        </RootProvider>
      </body>
    </html>
  );
}
