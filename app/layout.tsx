import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
import GoogleAnalytics from "../components/GoogleAnalytics";
import MetaPixel from "../components/MetaPixel";
import SignUpTracker from "../components/tracking/SignUpTracker";
import AdminHashRedirect from "../components/AdminHashRedirect";
import GTMHead from "../components/GTMHead";
import GTMBody from "../components/GTMBody";
import { ComparisonProvider } from "../contexts/ComparisonContext";
import ComparisonTray from "../components/comparison/ComparisonTray";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ryanrealty.com'

/** Always render with fresh data so production matches localhost (no stale static build). */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
    url: siteUrl,
    siteName: "Ryan Realty",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ryan Realty — Central Oregon Real Estate",
    description: "Find your next home in Bend and Central Oregon. Expert real estate service and listings.",
  },
  robots: "index, follow",
  alternates: { canonical: siteUrl },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, brokerage] = await Promise.all([
    getSession(),
    getBrokerageSettings(),
  ]);

  const brokerageName = brokerage?.name ?? 'Ryan Realty'
  const brokerageLogoUrl = brokerage?.logo_url ?? null
  const brokerageAddress =
    brokerage?.address_line1 || brokerage?.city
      ? [brokerage?.address_line1, brokerage?.address_line2, brokerage?.city, brokerage?.state, brokerage?.postal_code]
          .filter(Boolean)
          .join(', ')
      : null

  return (
    <html lang="en">
      <head>
        <GTMHead />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden antialiased`}
      >
        <GTMBody />
        <ComparisonProvider>
          <GoogleAnalytics />
          <MetaPixel />
          <JsonLd />
          <Header user={session?.user} brokerageName={brokerageName} brokerageLogoUrl={brokerageLogoUrl} />
          <div className="min-h-[calc(100vh-120px)]">{children}</div>
          <Footer brokerageName={brokerageName} brokerageEmail={brokerage?.primary_email ?? null} brokeragePhone={brokerage?.primary_phone ?? null} brokerageAddress={brokerageAddress} />
          <ComparisonTray />
          <CookieConsentBanner />
        <Suspense fallback={null}>
          <SignInPrompt user={session?.user ?? null} />
        </Suspense>
        <VisitTracker userId={session?.user?.id ?? null} userEmail={session?.user?.email ?? null} />
        <Suspense fallback={null}>
          <FubIdentityBridge />
          <AuthCodeRedirect />
          <AuthErrorRedirect />
          <SignUpTracker />
          <AdminHashRedirect />
        </Suspense>
        </ComparisonProvider>
      </body>
    </html>
  );
}
