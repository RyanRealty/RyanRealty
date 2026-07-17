import type { Metadata, Viewport } from "next";
import { validateEnv } from "@/lib/env";
import { Suspense } from "react";
import "./globals.css";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import { RootProvider } from "../components/site/providers";
import HideOnLP, { HideChrome } from "../components/layout/HideOnLP";
// PublicClientLayer bundles the interactive public client components (prompts,
// comparison tray, visitor/intent trackers, auth bridges) behind route-aware
// dynamic imports so their chunks never load on /admin (RC3 drop-public-bundle).
import PublicClientLayer from "../components/layout/PublicClientLayer";
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
    template: "%s | Ryan Realty — Central Oregon Real Estate",
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

/* Site v2 chrome is fully static — no brokerage fetch, no server-side cookie
 * read, no Suspense wrapper required. SiteHeader + SiteFooter render
 * synchronously and the static shell stays cacheable at the Vercel edge. */

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
        {/* Preload hero poster for instant LCP. LP routes don't use it but
            the extra preload is cheap (browser drops on no-match). Keeping
            this in the static shell preserves the prerender. */}
        <link rel="preload" as="image" href="/images/hero-poster.webp" fetchPriority="high" />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased">
        {/* Evict any stale service worker left by the pre-cutover site on this
            domain. Runs on every route (outside HideOnLP). No-op for the 99%
            of visitors with a clean browser. */}
        <StaleServiceWorkerReset />
        <RootProvider>
          <HideOnLP>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[100] focus:p-4 focus:bg-card focus:text-primary">
              Skip to main content
            </a>
          </HideOnLP>
          <HideOnLP>
            <JsonLd />
          </HideOnLP>
          {/* Static site v2 chrome. HideChrome unmounts header+footer on /lp/*,
              /admin, /sign/*, and the "/" homepage (which carries its own KbNav +
              KB footer). The site-wide JSON-LD + VisitTracker + auth bridges below
              stay on plain HideOnLP so they keep running on the homepage. */}
          <HideChrome>
            <SiteHeader />
          </HideChrome>
          <div id="main-content" tabIndex={-1} className="min-h-[calc(100vh-64px)]">{children}</div>
          <HideChrome>
            <SiteFooter />
          </HideChrome>
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
