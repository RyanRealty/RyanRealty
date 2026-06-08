// Canonical URL for the legacy per-geo report. The source page now permanently
// redirects to /housing-market/<city> (the live getMarketPulse market page), so
// only the default export is re-exported here.
export { default, metadata } from '@/app/reports/[slug]/[geoName]/page'
