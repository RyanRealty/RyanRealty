// Brand tokens for the Cascade Peaks viral video — per CLAUDE.md design
// system. Navy + gold + cream are the Ryan Realty core palette; the extended
// cool/warm ramps below are used inside the 3D tile scenes for atmospheric
// fog, HUD chrome, and peak label callouts.

export const NAVY = '#102742';
export const NAVY_DEEP = '#0a1a2e';
export const NAVY_SOFT = '#1d3a5c';

export const GOLD = '#D4AF37';
export const GOLD_SOFT = '#e8c964';
export const GOLD_DEEP = '#a88526';

export const CREAM = '#F5EFE2';
export const WHITE = '#FFFFFF';
export const WHITE_SOFT = 'rgba(255,255,255,0.92)';
export const WHITE_GLASS = 'rgba(255,255,255,0.12)';

// HUD + callout text shadow for legibility over bright snow / dark sky.
export const TEXT_SHADOW =
  '0 0 12px rgba(10,23,40,0.95), 0 0 24px rgba(10,23,40,0.75), 0 2px 4px rgba(0,0,0,0.9)';

// IG safe zones for 1080x1920 frame: text stays inside y=280..1520.
// Top margin accounts for IG reels header overlay; bottom for caption pill.
export const SAFE_TOP = 280;
export const SAFE_BOTTOM = 1520;
export const SAFE_LEFT = 60;
export const SAFE_RIGHT = 1020;

// Fonts: Google Fonts (see fonts.ts). Names must match CSS family strings.
export const FONT_SERIF = 'Cormorant Garamond';
export const FONT_BODY = 'Barlow';

// Ryan Realty contact line (appears on the closing card only — NOT on
// interior scenes per the "no branding in viral video" rule, though the
// closing card is where it's expected and accepted).
export const IG_HANDLE = '@MattRyanRealty';
export const DOMAIN = 'ryan-realty.com';
export const PHONE = '541.213.6706';
