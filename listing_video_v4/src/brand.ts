// Brand v2 — luxury listing video palette.
// Navy is RESERVED for the closing outro only. Body palette is warm, cream,
// sepia, gold — luxury real-estate magazine feel.

export const NAVY = '#102742';            // OUTRO ONLY
export const NAVY_DEEP = '#0a1a2e';
export const NAVY_DARKER = '#06101f';

// Luxury warm palette — primary use across body
export const CHARCOAL = '#1a1714';        // letterbox + cinema bars
export const ESPRESSO = '#2a221d';        // deep warm bg
export const MAHOGANY = '#3a2820';
export const CREAM = '#F2EBDD';           // cream paper / titles bg
export const PARCHMENT = '#E8DDC7';
export const SAND = '#C9B79A';
export const GOLD = '#C8A864';            // softened gold (was #D4AF37 — too yellow for luxury)
export const GOLD_DEEP = '#9C7E3D';
export const GOLD_WARM = '#E0C580';
export const SEPIA_DEEP = '#3a2c1f';
export const SEPIA_MID = '#5a4630';
export const SEPIA_LIGHT = '#a2876a';
export const WHITE = '#FFFFFF';
export const OFF_WHITE = '#F8F4EA';

// Long-form earns the serif. Amboqia for headlines, AzoSans for body.
export const FONT_SERIF = 'Amboqia';
export const FONT_BODY = 'AzoSans';
export const FONT_SANS = 'Montserrat';

export const TEXT_SHADOW = '0 4px 24px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.85)';
export const SUB_SHADOW = '0 2px 10px rgba(0,0,0,0.85)';

// Unified luxury color grade — applied to ALL property photos via CSS filter chain.
// Maps to: subtle warm tint + magazine contrast + gentle desaturation in shadows.
export const LUXURY_GRADE_FILTER =
  'sepia(0.05) saturate(1.08) brightness(0.96) contrast(1.06) hue-rotate(-3deg)';

// Historic B&W treatment — sepia warm tone instead of pure grey.
export const HISTORIC_GRADE_FILTER =
  'sepia(0.55) saturate(0.85) contrast(1.12) brightness(0.92) hue-rotate(-8deg)';

// Subtle vignette gradient applied across BOTH historic and modern shots —
// shared visual treatment is what makes the transition smooth.
export const SHARED_VIGNETTE =
  'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)';
