/**
 * layout-constants.ts — single source of truth for the global layout dimensions
 * that more than one component depends on. Keeping these here prevents the kind
 * of drift that caused the SectionNav-overlaps-header bug (the header was 72px
 * but the sticky SectionNav offset was hardcoded separately, so any change to
 * one silently broke the other).
 */

/** Height of the sticky global SiteHeader, in px. The SectionNav pins directly
 *  below it using this value. If the header height changes, change it here. */
export const HEADER_HEIGHT_PX = 72
