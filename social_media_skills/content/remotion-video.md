---
name: remotion-video
description: Remotion Programmatic Video — Ryan Realty
---
# Remotion Programmatic Video — Ryan Realty

## Purpose
Generate brand videos programmatically using Remotion (React-based video framework). No manual video editing tools. This is the video production counterpart to the Three.js shader art skill.

## When This Skill Fires
Any request for: programmatic video, Remotion video, animated data visualization video, market update video, listing video with animated overlays, brand intro/outro video, social media video with text animations, automated video pipeline.

## Setup (One-Time)
```bash
npx create-video@latest --template blank-tailwind
cd my-video
npm install
npx remotion studio # opens browser preview
```

Install the official Claude Code skill: `npx skills add remotion`

## Brand Constants
```tsx
export const BRAND = {
  navy: '#102742',
  gold: '#B8860B',
  white: '#FFFFFF',
  font: 'Playfair Display',
  bodyFont: 'Inter',
  name: 'Ryan Realty',
  tagline: 'BEND, OREGON',
  phone: '541.213.6706',
};
```

## Core Animation Patterns

### Spring Animation (primary easing — use everywhere)
```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
const opacity = spring({ frame: frame - 10, fps, config: { damping: 20 } });
```

### Interpolate (frame-based value mapping)
```tsx
import { interpolate, Easing } from 'remotion';

const translateY = interpolate(frame, [0, 30], [50, 0], {
  extrapolateRight: 'clamp',
  easing: Easing.out(Easing.cubic),
});
```

### TransitionSeries (scene-to-scene)
```tsx
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={90}>
    <Scene1 />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={slide({ direction: 'from-right' })}
    timing={linearTiming({ durationInFrames: 15 })}
  />
  <TransitionSeries.Sequence durationInFrames={90}>
    <Scene2 />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### Count-Up Animation (for KPI/stats)
```tsx
const count = interpolate(frame, [0, 60], [0, targetNumber], {
  extrapolateRight: 'clamp',
  easing: Easing.out(Easing.cubic),
});
const displayed = Math.round(count).toLocaleString();
```

### SVG Stroke Drawing
```tsx
const progress = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });
<svg>
  <path
    d="M10 80 Q 52.5 10, 95 80 T 180 80"
    stroke={BRAND.gold}
    strokeWidth={3}
    fill="none"
    strokeDasharray={pathLength}
    strokeDashoffset={pathLength * (1 - progress)}
  />
</svg>
```

## Video Types for Ryan Realty

### 1. Market Update (data-driven)
- KPI hero cards with count-up (median price, inventory, DOM)
- Bar chart with animated bar growth
- Line chart with gradient fill drawing left-to-right
- Source attribution text at bottom
- 30-60 seconds, 1080x1920 (vertical) or 1920x1080 (horizontal)

### 2. Listing Showcase
- Photo sequence with Ken Burns (slow zoom + pan via transform)
- Price reveal with spring animation
- Feature callouts (beds/baths/sqft) animated in sequence
- End card with Matt's contact info
- 15-30 seconds, 1080x1920

### 3. Brand Intro/Outro
- Logo assembly animation (particles → logo using Three.js in Remotion via @remotion/three)
- Navy → gold gradient sweep
- 3-5 seconds

### 4. Education/Tips
- Hook text (large, bold, spring-in)
- Numbered steps appearing sequentially
- Icon animations (SVG stroke drawing)
- CTA end frame ("DM me 'strategy'")

### 5. Neighborhood Spotlight
- Photo grid assembly (photos slide in from edges)
- Area name with letter-by-letter reveal
- Key stats overlay
- Map pin animation

## Rendering
```bash
# Preview
npx remotion studio

# Render single video
npx remotion render src/index.ts MyComposition out/video.mp4

# Render with custom props
npx remotion render src/index.ts MyComposition out/video.mp4 \
  --props='{"title":"Bend Market Update","price":"$650,000"}'
```

## @remotion/three Integration
For Three.js scenes inside Remotion videos:
```tsx
import { ThreeCanvas } from '@remotion/three';

export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <ThreeCanvas linear width={1920} height={1080}>
      <ambientLight intensity={0.5} />
      <ParticleLogoMesh progress={frame / 90} />
    </ThreeCanvas>
  );
};
```

## Output Specs
| Platform | Dimensions | Duration | FPS |
|----------|-----------|----------|-----|
| IG Reels | 1080x1920 | 15-90s | 30 |
| IG Feed | 1080x1350 | 3-60s | 30 |
| IG Stories | 1080x1920 | 15s max | 30 |
| TikTok | 1080x1920 | 15-180s | 30 |
| Facebook | 1080x1080 | 15-120s | 30 |
| YouTube | 1920x1080 | any | 30 |

## Quality Checklist
1. Spring animations on all motion (no linear easing)
2. Brand colors only (navy, gold, white)
3. Playfair Display for headlines, Inter for body
4. DM CTA on every social video ("DM me '[keyword]'")
5. No salesy language — let data/property speak
6. Smooth transitions between scenes (minimum 0.5s)
7. Audio-safe — works with sound off (text overlays for all key info)
8. End card with Ryan Realty branding + phone number
