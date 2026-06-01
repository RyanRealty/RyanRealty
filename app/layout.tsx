import type { Metadata, Viewport } from "next";
import { validateEnv } from "@/lib/env";
import { Suspense } from "react";
import "./globals.css";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import { RootProvider } from "../components/site/providers";
import SignInPromptWithSession from "../components/layout/SignInPromptWithSession";
import VisitTrackerWithSession from "../components/layout/VisitTrackerWithSession";
import HideOnLP from "../components/layout/HideOnLP";
import JsonLd from "../components/JsonLd";
import GTMHead from "../components/GTMHead";
import GlobalIntentTracker from "../components/GlobalIntentTracker";
import AuthCodeRedirect from "../components/AuthCodeRedirect";
import AuthErrorRedirect from "../components/AuthErrorRedirect";
import SignUpTracker from "../components/tracking/SignUpTracker";
import AdminHashRedirect from "../components/AdminHashRedirect";
import InstallPrompt from "../components/pwa/InstallPrompt";
import ComparisonTray from "@/components/comparison/ComparisonTray";
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
  alternates: { canonical: getCanonicalSiteUrl() },
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
          {/* Static site v2 chrome. HideOnLP unmounts on /lp/* after hydration. */}
          <HideOnLP>
            <SiteHeader />
          </HideOnLP>
          <div id="main-content" tabIndex={-1} className="min-h-[calc(100vh-64px)]">{children}</div>
          <HideOnLP>
            <SiteFooter />
          </HideOnLP>
          <HideOnLP>
            <SignInPromptWithSession />
          </HideOnLP>
          <HideOnLP>
            <InstallPrompt />
          </HideOnLP>
          <HideOnLP>
            <VisitTrackerWithSession />
          </HideOnLP>
          {/* High-intent micro-event capture (tel:, mailto:, form_start).
              Runs on every page including LPs because form_start on a seller
              LP is one of the strongest pre-submit intent signals we have. */}
          <GlobalIntentTracker />
          <Suspense fallback={null}>
            {/* Auth + sign-up redirects do NOT run on LPs — LP visitors
                aren't authenticating. Identity/attribution bridges DO run
                on LPs (they're inside RootProvider above). */}
            <HideOnLP>
              <AuthCodeRedirect />
              <AuthErrorRedirect />
              <SignUpTracker />
              <AdminHashRedirect />
            </HideOnLP>
          </Suspense>
          <HideOnLP>
            <ComparisonTray />
          </HideOnLP>
        </RootProvider>
      </body>
    </html>
  );
}
