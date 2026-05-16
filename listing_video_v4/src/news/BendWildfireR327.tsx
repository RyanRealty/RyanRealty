// BendWildfireR327 — standalone news clip, ~45s.
//
// Topic: Pine Mountain Fire (USFS prescribed burn that escaped 2026-05-07,
// 14 miles SE of Bend) intersected with Bend's new wildfire mitigation
// building code (Section R-327, effective 2026-05-15).
//
// Architecture:
//   - Intro: TitleCard with hidePartPill (3.0s) — market-report style
//   - 11 body beats: Victoria VO over Unsplash stills (Ken Burns) and
//     2 Council b-roll clips (jan7_dais, feb4_dais) for the policy beats.
//     SentenceCaption renders full-sentence captions with active-word
//     gold highlight (canonical caption layer per CLAUDE.md §0.5).
//   - Outro: RyanRealtyOutro (3.0s) — navy + white stacked logo + phone,
//     mirrors locked S12 spec from market-data-video SKILL §11.
//
// Beat durations are VO-driven (no padding) per market-data-video SKILL §18.
//
// Verification trace lives at:
//   listing_video_v4/out/bend_wildfire_r327/citations.json
// Skill: video_production_skills/news-video/SKILL.md

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SentenceCaption, type CaptionWord } from './SentenceCaption';
import { StatPop, type StatPopItem } from './StatPop';
import { TitleCard } from './TitleCard';
import { RyanRealtyOutro, RYAN_REALTY_OUTRO_SEC } from './RyanRealtyOutro';

import b1Align from '../../public/audio/bend_wildfire_r327/b1_hook.alignment.json';
import b2Align from '../../public/audio/bend_wildfire_r327/b2_acres.alignment.json';
import b3Align from '../../public/audio/bend_wildfire_r327/b3_started.alignment.json';
import b4Align from '../../public/audio/bend_wildfire_r327/b4_contained.alignment.json';
import b5Align from '../../public/audio/bend_wildfire_r327/b5_pivot.alignment.json';
import b6Align from '../../public/audio/bend_wildfire_r327/b6_code.alignment.json';
import b7Align from '../../public/audio/bend_wildfire_r327/b7_what.alignment.json';
import b8Align from '../../public/audio/bend_wildfire_r327/b8_sisters.alignment.json';
import b9Align from '../../public/audio/bend_wildfire_r327/b9_new_only.alignment.json';
import b10Align from '../../public/audio/bend_wildfire_r327/b10_smoke.alignment.json';
import b11Align from '../../public/audio/bend_wildfire_r327/b11_cta.alignment.json';

const FPS = 30;

// VO durations (seconds) — measured from the synthesized MP3s with ffprobe.
// Beat visual durations equal these exactly (no padding) so SentenceCaption's
// word timestamps stay locked to the visual beats.
const VO = {
  b1_hook:      3.605,
  b2_acres:     5.016,
  b3_started:   5.564,
  b4_contained: 2.456,
  b5_pivot:     2.456,
  b6_code:      5.616,
  b7_what:      3.892,
  b8_sisters:   4.598,
  b9_new_only:  1.515,
  b10_smoke:    2.116,
  b11_cta:      1.985,
};

const INTRO_SEC = 3.0;
const OUTRO_SEC = RYAN_REALTY_OUTRO_SEC; // 3.0s
const VO_TOTAL_SEC = Object.values(VO).reduce((a, b) => a + b, 0);

export const BEND_WILDFIRE_R327_TOTAL_SEC = INTRO_SEC + VO_TOTAL_SEC + OUTRO_SEC;

const F = (s: number) => Math.round(s * FPS);

// Sequence-overlap buffer (frames). Each body Sequence's duration is extended
// by this amount so adjacent sequences overlap by ~0.3s. Combined with
// transparent inner backgrounds on the Bridge components, this guarantees the
// previous beat is rendered underneath the next beat for the first few frames
// — eliminating 1-frame black flashes when a Video seeks or an Img decodes.
// Per VIDEO_PRODUCTION_SKILL §7 #1.
const OVERLAP_FRAMES = 9;

// Sequential beat offsets (seconds), starting after the intro card.
const OFF: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let t = INTRO_SEC;
  for (const [slug, dur] of Object.entries(VO)) {
    out[slug] = t;
    t += dur;
  }
  out.outro = t;
  return out;
})();

// Source-clip path helpers
const photo = (slug: string) => `source_clips/news_wildfire_r327/${slug}.jpg`;
const broll = (slug: string) => `source_clips/bend_pulse/broll/${slug}.mp4`;
const vo = (slug: string) => `audio/bend_wildfire_r327/${slug}.mp3`;

// ────────────────────────────────────────────────────────────────────────
// PhotoBridge — still image with Ken Burns motion, Victoria VO, captions
// ────────────────────────────────────────────────────────────────────────

type Move =
  | { kind: 'push_in';      from?: number; to?: number; origin?: string }
  | { kind: 'push_counter'; from?: number; to?: number; origin?: string }
  | { kind: 'slow_pan';     direction?: 'lr' | 'rl'; amount?: number; scale?: number }
  | { kind: 'parallax';     scale?: number };

const PhotoBridge: React.FC<{
  voSlug: string;
  voDurSec: number;
  imageSlug: string;
  text: string;
  alignment: { words: CaptionWord[] };
  move?: Move;
  pops?: StatPopItem[];
}> = ({ voSlug, voDurSec, imageSlug, text, alignment, move = { kind: 'push_in' }, pops }) => {
  const frame = useCurrentFrame();
  const totalFrames = Math.max(1, Math.round(voDurSec * FPS));
  const t = Math.min(1, Math.max(0, frame / totalFrames));

  let scale = 1;
  let translateX = 0;
  let origin = move.kind === 'push_in' ? (('origin' in move && move.origin) || 'center center')
              : move.kind === 'push_counter' ? (('origin' in move && move.origin) || 'right top')
              : 'center center';

  if (move.kind === 'push_in') {
    const from = move.from ?? 1.04;
    const to   = move.to   ?? 1.14;
    scale = from + (to - from) * t;
  } else if (move.kind === 'push_counter') {
    const from = move.from ?? 1.14;
    const to   = move.to   ?? 1.05;
    scale = from + (to - from) * t;
  } else if (move.kind === 'slow_pan') {
    const dir = move.direction ?? 'lr';
    const amount = move.amount ?? 80;
    scale = move.scale ?? 1.10;
    translateX = (dir === 'lr' ? -amount : amount) + (dir === 'lr' ? 1 : -1) * (2 * amount * t);
  } else if (move.kind === 'parallax') {
    scale = (move.scale ?? 1.06) + 0.06 * t;
  }

  const transform = `translate(${translateX.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;

  // Background is transparent so that during a 1-frame Img-decode hiccup at
  // the scene boundary, the previous Sequence (extended by overlap frames)
  // shows through instead of pure black. Per VIDEO_PRODUCTION_SKILL §7 #1.
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <Img
        src={staticFile(photo(imageSlug))}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform,
          transformOrigin: origin,
        }}
      />
      {/* Subtle dark vignette so captions read on any image */}
      <AbsoluteFill style={{
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.00) 35%, rgba(0,0,0,0.00) 60%, rgba(0,0,0,0.55) 100%)',
      }} />
      <Audio src={staticFile(vo(voSlug))} />
      {pops && pops.length > 0 ? <StatPop items={pops} /> : null}
      <SentenceCaption words={alignment.words} />
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────────────────────
// VideoBridge — Council b-roll clip, Victoria VO, captions
// ────────────────────────────────────────────────────────────────────────

const VideoBridge: React.FC<{
  voSlug: string;
  voDurSec: number;
  brollSlug: string;
  brollStartSec?: number;
  zoomStart?: number;
  zoomEnd?: number;
  text: string;
  alignment: { words: CaptionWord[] };
  pops?: StatPopItem[];
}> = ({
  voSlug,
  voDurSec,
  brollSlug,
  brollStartSec = 0,
  zoomStart = 1.10,
  zoomEnd = 1.20,
  text,
  alignment,
  pops,
}) => {
  const frame = useCurrentFrame();
  const totalFrames = Math.max(1, Math.round(voDurSec * FPS));
  const t = Math.min(1, Math.max(0, frame / totalFrames));
  const scale = zoomStart + t * (zoomEnd - zoomStart);

  // Transparent background — Video can take a frame to seek/decode at scene
  // boundaries; overlap-with-previous-Sequence keeps the previous beat
  // painted underneath as a fallback. Per VIDEO_PRODUCTION_SKILL §7 #1.
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <Video
        src={staticFile(broll(brollSlug))}
        startFrom={Math.round(brollStartSec * FPS)}
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      />
      <AbsoluteFill style={{
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.00) 35%, rgba(0,0,0,0.00) 60%, rgba(0,0,0,0.55) 100%)',
      }} />
      <Audio src={staticFile(vo(voSlug))} />
      {pops && pops.length > 0 ? <StatPop items={pops} /> : null}
      <SentenceCaption words={alignment.words} />
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Composition
// ────────────────────────────────────────────────────────────────────────

export const BendWildfireR327: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {/* Intro title card — market-report style, no PART pill.
        Extended by OVERLAP_FRAMES so it stays painted while B1 starts. */}
    <Sequence from={0} durationInFrames={F(INTRO_SEC) + OVERLAP_FRAMES}>
      <TitleCard
        series="BEND WILDFIRE WATCH"
        title="Code Drops May 15"
        subtitle="PINE MOUNTAIN FIRE · SECTION R-327"
        hidePartPill
        backgroundImage={photo('b1_hook')}
        durationSec={INTRO_SEC}
      />
    </Sequence>

    {/* B1 — Hook: smoke imagery + opening punch */}
    <Sequence from={F(OFF.b1_hook)} durationInFrames={F(VO.b1_hook) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b1_hook"
        voDurSec={VO.b1_hook}
        imageSlug="b1_hook"
        text="A government burn just escaped fourteen miles from Bend."
        alignment={b1Align as { words: CaptionWord[] }}
        move={{ kind: 'push_in', from: 1.04, to: 1.14 }}
        pops={[{ text: '14 MILES FROM BEND', sub: 'PINE MOUNTAIN', start: 0.5, end: 3.4, color: 'gold' }]}
      />
    </Sequence>

    {/* B2 — Acres + smoke over town */}
    <Sequence from={F(OFF.b2_acres)} durationInFrames={F(VO.b2_acres) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b2_acres"
        voDurSec={VO.b2_acres}
        imageSlug="b2_acres"
        text="Twenty five hundred acres on Pine Mountain. Smoke over town."
        alignment={b2Align as { words: CaptionWord[] }}
        move={{ kind: 'slow_pan', direction: 'lr', amount: 70, scale: 1.10 }}
        pops={[
          { text: '2,589 ACRES',  sub: 'PINE MOUNTAIN FIRE', start: 0.4, end: 3.6, color: 'gold' },
        ]}
      />
    </Sequence>

    {/* B3 — Started Thursday, conditions they did not expect */}
    <Sequence from={F(OFF.b3_started)} durationInFrames={F(VO.b3_started) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b3_started"
        voDurSec={VO.b3_started}
        imageSlug="b3_started"
        text="Started Thursday when a Forest Service prescribed burn hit conditions they did not expect."
        alignment={b3Align as { words: CaptionWord[] }}
        move={{ kind: 'push_counter', from: 1.16, to: 1.04 }}
        pops={[
          { text: 'STARTED THU MAY 7', sub: 'PRESCRIBED BURN ESCAPED', start: 0.4, end: 4.4, color: 'white' },
        ]}
      />
    </Sequence>

    {/* B4 — 70% contained */}
    <Sequence from={F(OFF.b4_contained)} durationInFrames={F(VO.b4_contained) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b4_contained"
        voDurSec={VO.b4_contained}
        imageSlug="b4_contained"
        text="Seventy percent contained this morning."
        alignment={b4Align as { words: CaptionWord[] }}
        move={{ kind: 'parallax', scale: 1.06 }}
        pops={[{ text: '70% CONTAINED', sub: 'AS OF MAY 10 9:20 AM', start: 0.2, end: 2.4, color: 'gold' }]}
      />
    </Sequence>

    {/* B5 — Pivot to policy: council b-roll.
        Source clips have heavy baked-in letterbox: jan7_dais has a HARD black
        band at the top + blurred backdrop top/bottom; feb4_dais has only the
        blurred backdrop. At 1.85+ we fully crop both. */}
    <Sequence from={F(OFF.b5_pivot)} durationInFrames={F(VO.b5_pivot) + OVERLAP_FRAMES}>
      <VideoBridge
        voSlug="b5_pivot"
        voDurSec={VO.b5_pivot}
        brollSlug="jan7_dais"
        brollStartSec={1}
        zoomStart={1.88}
        zoomEnd={1.95}
        text="Here is what nobody is talking about."
        alignment={b5Align as { words: CaptionWord[] }}
        pops={[{ text: "WHAT NO ONE'S SAYING", sub: undefined, start: 0.0, end: 2.4, color: 'white' }]}
      />
    </Sequence>

    {/* B6 — The code: council b-roll (feb4_dais). Same aggressive crop. */}
    <Sequence from={F(OFF.b6_code)} durationInFrames={F(VO.b6_code) + OVERLAP_FRAMES}>
      <VideoBridge
        voSlug="b6_code"
        voDurSec={VO.b6_code}
        brollSlug="feb4_dais"
        brollStartSec={2}
        zoomStart={1.78}
        zoomEnd={1.88}
        text="In five days, every new house Bend builds has to follow Section R three twenty seven."
        alignment={b6Align as { words: CaptionWord[] }}
        pops={[
          { text: 'MAY 15',          sub: '5 DAYS AWAY',     start: 0.4, end: 3.0, color: 'gold' },
          { text: 'SECTION R-327',   sub: 'NEW BUILDS',      start: 3.0, end: 5.5, color: 'white' },
        ]}
      />
    </Sequence>

    {/* B7 — What it requires */}
    <Sequence from={F(OFF.b7_what)} durationInFrames={F(VO.b7_what) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b7_what"
        voDurSec={VO.b7_what}
        imageSlug="b7_siding"
        text="Ignition resistant siding. Hardened roofing. Sealed vents."
        alignment={b7Align as { words: CaptionWord[] }}
        move={{ kind: 'slow_pan', direction: 'rl', amount: 60, scale: 1.10 }}
        pops={[
          { text: 'IGNITION-RESISTANT', sub: 'SIDING · ROOFING · VENTS', start: 0.4, end: 3.7, color: 'gold' },
        ]}
      />
    </Sequence>

    {/* B8 — Sisters has it. Deschutes has it. Bend joins them. */}
    <Sequence from={F(OFF.b8_sisters)} durationInFrames={F(VO.b8_sisters) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b8_sisters"
        voDurSec={VO.b8_sisters}
        imageSlug="b8_cascade"
        text="Sisters has it. Deschutes County has it. Bend joins them May fifteenth."
        alignment={b8Align as { words: CaptionWord[] }}
        move={{ kind: 'push_in', from: 1.05, to: 1.13 }}
        pops={[
          { text: 'SISTERS ✓',       sub: undefined,            start: 0.2, end: 1.6, color: 'white' },
          { text: 'DESCHUTES CO ✓',  sub: undefined,            start: 1.6, end: 3.0, color: 'white' },
          { text: 'BEND → MAY 15',   sub: 'CATCHING UP',        start: 3.0, end: 4.5, color: 'gold' },
        ]}
      />
    </Sequence>

    {/* B9 — Only new permits */}
    <Sequence from={F(OFF.b9_new_only)} durationInFrames={F(VO.b9_new_only) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b9_new_only"
        voDurSec={VO.b9_new_only}
        imageSlug="b8_cascade"
        text="But only new permits."
        alignment={b9Align as { words: CaptionWord[] }}
        move={{ kind: 'parallax', scale: 1.16 }}
        pops={[{ text: 'ONLY NEW PERMITS', sub: undefined, start: 0.1, end: 1.5, color: 'gold' }]}
      />
    </Sequence>

    {/* B10 — Existing homes get the smoke */}
    <Sequence from={F(OFF.b10_smoke)} durationInFrames={F(VO.b10_smoke) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b10_smoke"
        voDurSec={VO.b10_smoke}
        imageSlug="b10_smoke"
        text="Existing homes just get the smoke."
        alignment={b10Align as { words: CaptionWord[] }}
        move={{ kind: 'slow_pan', direction: 'lr', amount: 50, scale: 1.10 }}
        pops={[
          { text: 'EXISTING HOMES', sub: 'JUST THE SMOKE', start: 0.2, end: 2.1, color: 'white' },
        ]}
      />
    </Sequence>

    {/* B11 — CTA: question close. Extended to overlap with the outro so the
        photo is still painted underneath as the navy outro fades in. */}
    <Sequence from={F(OFF.b11_cta)} durationInFrames={F(VO.b11_cta) + OVERLAP_FRAMES}>
      <PhotoBridge
        voSlug="b11_cta"
        voDurSec={VO.b11_cta}
        imageSlug="b11_skyline"
        text="What would you spend to harden yours?"
        alignment={b11Align as { words: CaptionWord[] }}
        move={{ kind: 'push_in', from: 1.06, to: 1.14 }}
      />
    </Sequence>

    {/* Outro — market-report-style brand close */}
    <Sequence from={F(OFF.outro)} durationInFrames={F(OUTRO_SEC)}>
      <RyanRealtyOutro durationSec={OUTRO_SEC} />
    </Sequence>
  </AbsoluteFill>
);
