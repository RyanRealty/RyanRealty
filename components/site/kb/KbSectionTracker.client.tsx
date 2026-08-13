/**
 * Compat alias. Public pages mount V3SectionTracker from the v3 barrel.
 * Leftover non-page files (LeadLandingPage, city/community wrappers) may keep
 * this name. Implementation lives in components/site/v3 — do not grow a second
 * tracker.
 */
export { V3SectionTracker as KbSectionTracker } from '@/components/site/v3/V3SectionTracker.client'
