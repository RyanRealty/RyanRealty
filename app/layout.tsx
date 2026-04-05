import type { Metadata, Viewport } from "next";
import { validateEnv, logOptionalEnv } from "@/lib/env";
import { Suspense } from "react";
import "./globals.css";
import { getSession } from "./actions/auth";
import { getBrokerageSettings } from "./actions/brokerage";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import JsonLd from "../components/JsonLd";
import CookieConsentBanner from "../components/CookieConsentBanner";
import SignInPrompt from "../components/SignInPrompt";
import VisitTracker from "../components/VisitTracker";
import AuthCodeRedirect from "../components/AuthCodeRedirect";
import AuthErrorRedirect from "../components/AuthErrorRedirect";
import FubIdentityBridge from "../components/FubIdentityBridge";
import AgentAttributionBridge from "../components/AgentAttributionBridge";
import GoogleAnalytics from "../components/GoogleAnalytics";
import MetaPixel from "../components/MetaPixel";
import SignUpTracker from "../components/tracking/SignUpTracker";
import AdminHashRedirect from "../components/AdminHashRedirect";
import GTMHead from "../components/GTMHead";
import GTMBody from "../components/GTMBody";
import InstallPrompt from "../components/pwa/InstallPrompt";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import ComparisonTray from "@/components/comparison/ComparisonTray";
import LazyChatWidget from "@/components/chat/LazyChatWidget";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import { getCanonicalSiteUrl } from "@/lib/share-metadata";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";

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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#102742",
};

function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 1200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/* Async components that fetch their own data — layout doesn't block on them */
async function HeaderAsync({
  sessionPromise,
  brokeragePromise,
}: {
  sessionPromise: Promise<Awaited<ReturnType<typeof getSession>>>
  brokeragePromise: Promise<Awaited<ReturnType<typeof getBrokerageSettings>>>
}) {
  const [session, brokerage] = await Promise.all([sessionPromise, brokeragePromise])
  const brokerageName = brokerage?.name ?? 'Ryan Realty'
  const headerLogoUrl = brokerage?.logo_url?.trim() || '/logo-header-white.png'
  return <Header user={session?.user} brokerageName={brokerageName} headerLogoUrl={headerLogoUrl} />
}

async function FooterAsync({
  brokeragePromise,
}: {
  brokeragePromise: Promise<Awaited<ReturnType<typeof getBrokerageSettings>>>
}) {
  const brokerage = await brokeragePromise
  const brokerageName = brokerage?.name ?? 'Ryan Realty'
  const brokerageLogoUrl = brokerage?.logo_url?.trim() || null
  const brokerageAddress =
    brokerage?.address_line1 || brokerage?.city
      ? [brokerage?.address_line1, brokerage?.address_line2, brokerage?.city, brokerage?.state, brokerage?.postal_code]
          .filter(Boolean)
          .join(', ')
      : null
  return <Footer brokerageName={brokerageName} brokerageLogoUrl={brokerageLogoUrl} brokerageEmail={brokerage?.primary_email ?? null} brokeragePhone={brokerage?.primary_phone ?? null} brokerageAddress={brokerageAddress} />
}

async function SignInPromptAsync({
  sessionPromise,
}: {
  sessionPromise: Promise<Awaited<ReturnType<typeof getSession>>>
}) {
  const session = await sessionPromise
  return <SignInPrompt user={session?.user ?? null} />
}

async function VisitTrackerAsync({
  sessionPromise,
}: {
  sessionPromise: Promise<Awaited<ReturnType<typeof getSession>>>
}) {
  const session = await sessionPromise
  return <VisitTracker userId={session?.user?.id ?? null} userEmail={session?.user?.email ?? null} />
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envCheck = validateEnv();
  if (!envCheck.ok) {
    console.error('[env] Missing required build vars:', envCheck.missing.join(', '));
  }
  const sessionPromise = withTimeout(getSession(), null, 700)
  const brokeragePromise = withTimeout(getBrokerageSettings(), null, 1200)

  return (
    <html lang="en" className={cn("font-sans", GeistSans.variable, GeistMono.variable)}>
      <head>
        <GTMHead />
        <link rel="manifest" href="/manifest.json" />
        {/* Preload hero poster for instant LCP — browser starts fetching before HTML stream delivers the <img> */}
        <link rel="preload" as="image" href="/images/hero-poster.webp" fetchPriority="high" />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased">
        <ComparisonProvider>
        <GTMBody />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[100] focus:p-4 focus:bg-card focus:text-primary">
            Skip to main content
          </a>
          <GoogleAnalytics />
          <MetaPixel />
          <JsonLd />
          {/* Header streams in independently — doesn't block page content */}
          <Suspense fallback={<div className="h-16 bg-primary" />}>
            <HeaderAsync sessionPromise={sessionPromise} brokeragePromise={brokeragePromise} />
          </Suspense>
          <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" aria-hidden />}>
            <div id="main-content" tabIndex={-1} className="min-h-[calc(100vh-64px)]">{children}</div>
          </Suspense>
          <Suspense fallback={<div className="min-h-[200px] bg-primary" />}>
            <FooterAsync brokeragePromise={brokeragePromise} />
          </Suspense>
          <CookieConsentBanner />
        <Suspense fallback={null}>
          <SignInPromptAsync sessionPromise={sessionPromise} />
        </Suspense>
        <InstallPrompt />
        <Suspense fallback={null}>
          <VisitTrackerAsync sessionPromise={sessionPromise} />
        </Suspense>
        <Suspense fallback={null}>
          <FubIdentityBridge />
          <AgentAttributionBridge />
          <AuthCodeRedirect />
          <AuthErrorRedirect />
          <SignUpTracker />
          <AdminHashRedirect />
        </Suspense>
        <ComparisonTray />
        <LazyChatWidget />
        <ExitIntentPopup />
        </ComparisonProvider>
        </body>
    </html>
  );
}
