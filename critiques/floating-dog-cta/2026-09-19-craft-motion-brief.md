# Floating BR dog CTA — craft / motion brief (Patch)
Date: 2026-09-19  
From: Critiquito via Cos · Matt ask  
Assets (do not invent new art):
- `brand-kit/rasta/blue-dog-transparent.png` (navy etched dog + seal)
- `brand-kit/rasta/white-dog-trans.png` (white cut for dark grounds)
No file edits from Critiquito. HOLD owner email / no buyer-seller names in any copy.

## Job
Sitewide floating affordance: dog head from the logo → tap/click expands a short menu:
1. Sell your home  
2. Buy your home  
3. Text us  
4. Get your home's value  
5. Learn about us  

Must feel **delightful, not gimmicky** — Bend boutique, not Intercom mascot.

## Ranked craft rules

### 1 · Head only in the fab (P0)
Crop / mask to the **dog head** (profile, collar ok). Do **not** float the full “RYAN REALTY · BEND, OREGON” seal as a bouncing badge — that reads sticker/gimmick. Seal can appear once inside the expanded sheet if needed for brand, not on idle.

### 2 · Idle motion = alive, not looping circus (P0)
Pick **one** quiet loop, ≤ ~4s, ease in-out, pause between cycles:
- Soft head tilt 3–6° **or**
- One ear breathe / micro-bob  
Not both. No bounce-bounce, no continuous spin, no blink spam, no sparkles. Respect `prefers-reduced-motion: reduce` → static head, no loop.

### 3 · Expand like a sheet, not a speech bubble party (P0)
- Click/tap fab → panel or radial list **anchored to the fab** (bottom-end on mobile, bottom-end or end on desktop).
- Menu items: plain type, one action each — **no** emoji, no paw icons per row.
- Motion: 150–220ms fade + 8–12px rise (or scale 0.96→1). No overshoot bounce.
- Esc / tap-outside / second tap on dog closes. Focus trap when open.

### 4 · Placement vs locked CTAs (P0)
Matt lock already: **header Work with us** + **listing Tour inline**; sticky Call/Text/Work with us **gone**.  
Dog fab must **not** fight those:
- Default: bottom-end, clear of home-indicator / cookie / Tour button.
- On listing @375: sit above Tour / primary inline row, or hide while Tour sticky-equivalent is in view if collision — prefer offset, don’t stack two fabs.
- Don’t duplicate “Work with us” as a sixth item; map **Sell / Buy / Value / Learn** to real routes; **Text us** = sms link.

### 5 · Contrast & asset choice (P1)
- Light pages: **blue-dog** head on cream/white disc or soft shadow.
- Dark hero / photo: **white-dog** head (or navy disc behind blue-dog).
- Hit target ≥ 44×44; visible head ~40–56px. Shadow soft, 1 elevation — not a glowing orb.

### 6 · Copy voice (P1)
Use Matt’s five labels exactly (plain). No “Woof”, “Let’s fetch”, “Who’s a good seller?”. Expanded title optional: omit, or one quiet word — **Help** — not “Jax says hi”.

## Motion spec (Patch can paint)

| State | Motion |
|-------|--------|
| Idle | One subtle tilt or ear breathe; 0 on reduced-motion |
| Hover (pointer) | Slightly larger tilt range once, or shadow +2 — no new loop |
| Press | Scale 0.96 |
| Open | Panel rise+fade ≤220ms |
| Close | Reverse ≤180ms |

## Done when
- First-look Bend @375: dog readable, doesn’t cover search/H1/Tour.
- Expand shows exactly the five actions, keyboard + screen-reader name (“Ryan Realty menu” / item names).
- Reduced-motion: static, still usable.
- Feels like the logo came to help — not a third-party chat widget.

## Out of scope
New illustration, Lottie from scratch unless derived from these PNGs, owner email, sticky bar revival.
