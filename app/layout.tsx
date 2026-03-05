import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getBrowseCities, getTotalListingsCount } from "./actions/listings";
import { getSession } from "./actions/auth";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import JsonLd from "../components/JsonLd";
import NoDataBanner from "../components/NoDataBanner";
import CookieConsentBanner from "../components/CookieConsentBanner";
import SignInPrompt from "../components/SignInPrompt";
import VisitTracker from "../components/VisitTracker";
import AuthCodeRedirect from "../components/AuthCodeRedirect";
import AuthErrorRedirect from "../components/AuthErrorRedirect";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ryanrealty.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ryan Realty | Central Oregon Homes for Sale",
    template: "%s | Ryan Realty",
  },
  description:
    "Search Central Oregon homes for sale. Browse listings by city and neighborhood, view maps, and find your next home with Ryan Realty.",
  keywords: ["Central Oregon", "homes for sale", "real estate", "Bend", "Redmond", "Sisters", "listings", "MLS"],
  openGraph: {
    title: "Ryan Realty | Central Oregon Homes for Sale",
    description: "Search Central Oregon homes for sale. Browse listings, maps, and find your next home.",
    type: "website",
    url: siteUrl,
    siteName: "Ryan Realty",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ryan Realty | Central Oregon Homes for Sale",
    description: "Search Central Oregon homes for sale. Browse listings, maps, and find your next home.",
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
  const [cities, totalListings, session] = await Promise.all([
    getBrowseCities(),
    getTotalListingsCount(),
    getSession(),
  ]);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <JsonLd />
        <SiteHeader cities={cities} totalListings={totalListings} user={session?.user} />
        {totalListings === 0 && <NoDataBanner />}
        <div className="min-h-[calc(100vh-120px)]">{children}</div>
        <SiteFooter />
        <CookieConsentBanner />
        <SignInPrompt user={session?.user ?? null} />
        <VisitTracker userId={session?.user?.id ?? null} />
        <Suspense fallback={null}>
          <AuthCodeRedirect />
          <AuthErrorRedirect />
        </Suspense>
      </body>
    </html>
  );
}
