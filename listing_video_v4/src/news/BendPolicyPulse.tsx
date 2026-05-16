// BendPolicyPulse v4 — Bend Council electrification fee, 3-part news series.
// 1080×1920 portrait, 30fps. Each video 50–66s.
//
// Architecture (per Matt directive 2026-05-10, updated 2026-05-10):
//   - FULL-BLEED video (no headers, footers, badges, slamlines)
//   - Optional top-right B-roll / still credit (BrollCredit) per broll/manifest.json
//   - Real Council/Cassie speaker bites at 1.0x audio interleaved with Victoria
//     bridges at 1.0x. Speaker bites are pre-extracted to portrait MP4s with
//     blurred-fill background (TikTok-style). Bridges play over Council b-roll
//     muted to ~0.05x ambient.
//   - TikTok-style word-pop captions (single word at a time, Anton font,
//     bottom third, big with strong outline + shadow)
//   - Captions track ElevenLabs / Whisper word timestamps. NEVER stretched.
//
// Source meeting recordings (Bend Granicus archive, public record):
//   - Feb 11 2026 City Council Work Session, clip_id=865 (Electrification
//     Policy Process Fee Options, 75-min agenda item). All Council/Cassie
//     speaker bites are extracted from this recording.
//
// Verification trace and per-bite manifest:
//   public/source_clips/bend_pulse/long/bites_inventory.json
//   public/source_clips/bend_pulse/bites/<label>.{mp4,json,captions.json}
//
// Caption layer canonical source: src/news/TikTokWordPop.tsx
// VO bridges canonical source: scripts/synth_bend_pulse_v4_bridges.py
// Speaker bites canonical source: scripts/extract_speaker_bites.py
// Bite captions canonical source: scripts/extract_bite_captions.py
// Establishing stills and meeting B-roll credits: public/source_clips/bend_pulse/broll/manifest.json
// On-frame attribution: src/news/BrollCredit.tsx (top right; avoids caption band).
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
import { BrollCredit } from './BrollCredit';
import { creditForBrollSlug, creditForStill } from './bendPulseBrollCredits';
import { SentenceCaption, type CaptionWord } from './SentenceCaption';
import { StatPop, type StatPopItem } from './StatPop';
import { TitleCard, TITLE_CARD_SEC } from './TitleCard';

const FPS = 30;

// Per-bite caption tokens (Whisper word-level timestamps from
// extract_bite_captions.py — { text, start, end } in seconds from bite start).
import p1CassieCalcCaps from '../../public/source_clips/bend_pulse/bites/p1_cassie_calc.captions.json';
import p1CassieSccCaps from '../../public/source_clips/bend_pulse/bites/p1_cassie_scc.captions.json';
import p2BinaryCaps from '../../public/source_clips/bend_pulse/bites/p2_council_false_binary.captions.json';
import p2ChewCaps from '../../public/source_clips/bend_pulse/bites/p2_council_walk_chew.captions.json';
import p2NudgeCaps from '../../public/source_clips/bend_pulse/bites/p2_council_nudge.captions.json';
import p3QuestionsCaps from '../../public/source_clips/bend_pulse/bites/p3_cassie_questions.captions.json';
import p3ThreeQsCaps from '../../public/source_clips/bend_pulse/bites/p3_cassie_three_questions.captions.json';
import p3StakeCaps from '../../public/source_clips/bend_pulse/bites/p3_cassie_stakeholder.captions.json';
import p3TcepCaps from '../../public/source_clips/bend_pulse/bites/p3_cassie_tcep.captions.json';

// Per-bridge ElevenLabs forced-alignment word tokens (from
// align_bend_pulse_bridges.py — { text, startSec, endSec }).
import p1B1Align from '../../public/audio/bend_pulse_v4/p1_b1_hook.alignment.json';
import p1B2Align from '../../public/audio/bend_pulse_v4/p1_b2_setup_calc.alignment.json';
import p1B3Align from '../../public/audio/bend_pulse_v4/p1_b3_setup_scc.alignment.json';
import p1B4Align from '../../public/audio/bend_pulse_v4/p1_b4_levels.alignment.json';
import p1B5Align from '../../public/audio/bend_pulse_v4/p1_b5_impact.alignment.json';
import p1B6Align from '../../public/audio/bend_pulse_v4/p1_b6_existing.alignment.json';
import p2B1Align from '../../public/audio/bend_pulse_v4/p2_b1_hook.alignment.json';
import p2B2Align from '../../public/audio/bend_pulse_v4/p2_b2_groups.alignment.json';
import p2B3Align from '../../public/audio/bend_pulse_v4/p2_b3_vote.alignment.json';
import p2B4Align from '../../public/audio/bend_pulse_v4/p2_b4_setup_binary.alignment.json';
import p2B5Align from '../../public/audio/bend_pulse_v4/p2_b5_setup_chew.alignment.json';
import p2B6Align from '../../public/audio/bend_pulse_v4/p2_b6_setup_nudge.alignment.json';
import p2B7Align from '../../public/audio/bend_pulse_v4/p2_b7_landed.alignment.json';
import p3B1Align from '../../public/audio/bend_pulse_v4/p3_b1_hook.alignment.json';
import p3B2Align from '../../public/audio/bend_pulse_v4/p3_b2_setup_qs.alignment.json';
import p3B3Align from '../../public/audio/bend_pulse_v4/p3_b3_setup_three_qs.alignment.json';
import p3B4Align from '../../public/audio/bend_pulse_v4/p3_b4_setup_stake.alignment.json';
import p3B5Align from '../../public/audio/bend_pulse_v4/p3_b5_setup_tcep.alignment.json';
import p3B6Align from '../../public/audio/bend_pulse_v4/p3_b6_dates.alignment.json';
import p3B7Align from '../../public/audio/bend_pulse_v4/p3_b7_start_loc.alignment.json';

// Bite tokens use { text, start, end } — adapt to CaptionWord schema
const adaptBite = (toks: Array<{ text: string; start: number; end: number }>): CaptionWord[] =>
  toks.map((t) => ({ text: t.text, startSec: t.start, endSec: t.end }));

// Bite source paths (portrait, full-bleed, with original audio)
const bite = (slug: string) => `source_clips/bend_pulse/bites/${slug}.mp4`;
// B-roll source paths (portrait full-bleed, no audio — used under Victoria VO)
const broll = (slug: string) => `source_clips/bend_pulse/broll/${slug}.mp4`;
// Bridge VO paths
const vo = (slug: string) => `audio/bend_pulse_v4/${slug}.mp3`;

// ────────────────────────────────────────────────────────────────────────
// Scene helpers
// ────────────────────────────────────────────────────────────────────────

// Render a Victoria bridge: b-roll (slide or dais, muted), Victoria VO,
// TikTok-style word-pop captions split evenly across the VO duration.
// Adds a slow Ken Burns scale over the bridge for visual motion. Default
// zoom is subtle (1.00 → 1.04) to keep slide content fully visible. Pass
// stronger `zoomStart`/`zoomEnd` for chamber clips that need the residual
// source letterbox cropped (e.g. zoomStart=1.10, zoomEnd=1.20).
const Bridge: React.FC<{
  voSlug: string;
  voDurSec: number;
  /** Council / slide B-roll (muted video under Victoria). */
  brollSlug?: string;
  brollStartSec?: number;
  /** Registered Bend still from broll_stills/*.jpg — Ken Burns instead of video. */
  stillSlug?: string;
  /** On-screen source credit (from broll/manifest.json). */
  credit?: string;
  text: string;
  zoomOrigin?: string;
  zoomStart?: number;
  zoomEnd?: number;
  /** Kinetic stat overlays linked to specific moments in the VO (e.g. when
   *  Victoria says "$1,954" pop "$1,954" big at that timestamp). */
  pops?: StatPopItem[];
  /** ElevenLabs forced-alignment word tokens for full-sentence captions. */
  alignment?: { words: CaptionWord[] };
}> = ({
  voSlug,
  voDurSec,
  brollSlug,
  stillSlug,
  brollStartSec = 0,
  credit,
  text,
  zoomOrigin = 'center center',
  zoomStart = 1.00,
  zoomEnd = 1.04,
  pops,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const totalFrames = Math.max(1, Math.round(voDurSec * FPS));
  const t = Math.min(1, Math.max(0, frame / totalFrames));
  const scale = zoomStart + t * (zoomEnd - zoomStart);

  // Caption words: prefer ElevenLabs forced-alignment if provided, else fall
  // back to even per-word timing across the bridge duration.
  const captionWords: CaptionWord[] =
    alignment?.words?.length
      ? alignment.words
      : (() => {
          const words = text.split(/\s+/).filter(Boolean);
          const per = voDurSec / Math.max(1, words.length);
          return words.map((w, i) => ({
            text: w,
            startSec: i * per,
            endSec: (i + 1) * per,
          }));
        })();

  const useStill = Boolean(stillSlug);
  const useVideo = Boolean(brollSlug);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {useStill ? (
        <Img
          src={staticFile(`source_clips/bend_pulse/broll_stills/${stillSlug}.jpg`)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: zoomOrigin,
          }}
        />
      ) : useVideo ? (
        <Video
          src={staticFile(broll(brollSlug!))}
          startFrom={Math.round(brollStartSec * FPS)}
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: zoomOrigin,
          }}
        />
      ) : null}
      {credit ? <BrollCredit text={credit} /> : null}
      <Audio src={staticFile(vo(voSlug))} />
      {pops && pops.length > 0 ? <StatPop items={pops} /> : null}
      <SentenceCaption words={captionWords} />
    </AbsoluteFill>
  );
};

// Render a Council/Cassie speaker bite: full-bleed portrait clip with original
// audio at 1.0x. Full-sentence captions track Whisper word timestamps.
const Bite: React.FC<{
  biteSlug: string;
  /** Whisper word tokens — { text, start, end } in seconds from bite start. */
  tokens: Array<{ text: string; start: number; end: number }>;
  durationSec: number;
}> = ({ biteSlug, tokens }) => {
  const captionWords: CaptionWord[] = tokens.map((t) => ({
    text: t.text,
    startSec: t.start,
    endSec: t.end,
  }));
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Video
        src={staticFile(bite(biteSlug))}
        volume={1.0}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <SentenceCaption words={captionWords} />
    </AbsoluteFill>
  );
};

// Convert seconds → frames (rounded)
const F = (s: number) => Math.round(s * FPS);

// ────────────────────────────────────────────────────────────────────────
// PART 1 — What Bend is actually proposing (~62s)
// ────────────────────────────────────────────────────────────────────────

// Sequence (all in seconds, cumulative):
// 0.0–3.66    Bridge: hook ("Bend just put a price on natural gas...")
// 3.66–15.68  Bridge: setup_calc (intro to Cassie)
// 15.68–20.28 Bite:   p1_cassie_calc ("So the fee is calculated on a per appliance basis.")
// 20.28–23.81 Bridge: setup_scc
// 23.81–31.61 Bite:   p1_cassie_scc (definition of social cost of carbon)
// 31.61–44.70 Bridge: levels (the $1,954 / $9,771 numbers)
// 44.70–51.20 Bridge: impact (0.23 → 1.15%)
// 51.20–61.31 Bridge: existing (existing homes off the table)

const P1_DURATIONS = {
  hook: 8.02,
  calc_bridge: 12.25,
  calc_bite: 4.60,
  scc_bridge: 11.65,
  scc_bite: 7.80,
  levels: 13.87,
  impact: 12.62,
  existing: 12.72,
};
const P1_TOTAL_SEC =
  TITLE_CARD_SEC +
  P1_DURATIONS.hook +
  P1_DURATIONS.calc_bridge +
  P1_DURATIONS.calc_bite +
  P1_DURATIONS.scc_bridge +
  P1_DURATIONS.scc_bite +
  P1_DURATIONS.levels +
  P1_DURATIONS.impact +
  P1_DURATIONS.existing;
export const BEND_PULSE_P1_TOTAL_SEC = P1_TOTAL_SEC;

const P1_OFFSETS = (() => {
  const o: Record<string, number> = {};
  let t = TITLE_CARD_SEC; // intro card before content
  o.hook = t;          t += P1_DURATIONS.hook;
  o.calc_bridge = t;   t += P1_DURATIONS.calc_bridge;
  o.calc_bite = t;     t += P1_DURATIONS.calc_bite;
  o.scc_bridge = t;    t += P1_DURATIONS.scc_bridge;
  o.scc_bite = t;      t += P1_DURATIONS.scc_bite;
  o.levels = t;        t += P1_DURATIONS.levels;
  o.impact = t;        t += P1_DURATIONS.impact;
  o.existing = t;      t += P1_DURATIONS.existing;
  return o;
})();

export const BendPulsePart1: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence from={0} durationInFrames={F(TITLE_CARD_SEC)}>
      <TitleCard
        title="What Bend Is Proposing"
        subtitle="CLIMATE POLLUTION FEE · NEW HOMES"
        part={1}
        totalParts={3}
        backgroundImage="source_clips/bend_pulse/broll_stills/cascade_road_bend_mick_haupt.jpg"
        creditLine={creditForStill('cascade_road_bend_mick_haupt')}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.hook)} durationInFrames={F(P1_DURATIONS.hook)}>
      <Bridge
        voSlug="p1_b1_hook"
        voDurSec={P1_DURATIONS.hook}
        stillSlug="cascade_road_bend_mick_haupt"
        credit={creditForStill('cascade_road_bend_mick_haupt')}
        zoomOrigin="55% 35%"
        text="Bend is finalizing a climate pollution fee on new homes. It is the biggest housing policy decision the city has made in years."
        zoomStart={1.00}
        zoomEnd={1.08}
        alignment={p1B1Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.calc_bridge)} durationInFrames={F(P1_DURATIONS.calc_bridge)}>
      <Bridge
        voSlug="p1_b2_setup_calc"
        voDurSec={P1_DURATIONS.calc_bridge}
        brollSlug="feb11_fee_design"
        brollStartSec={2}
        credit={creditForBrollSlug('feb11_fee_design')}
        text="On February eleventh, City Council met for a final work session before the public hearing. The city's electrification project manager Cassie Lacy walked them through how the fee actually works."
        alignment={p1B2Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.calc_bite)} durationInFrames={F(P1_DURATIONS.calc_bite)}>
      <Bite
        biteSlug="p1_cassie_calc"
        tokens={p1CassieCalcCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P1_DURATIONS.calc_bite}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.scc_bridge)} durationInFrames={F(P1_DURATIONS.scc_bridge)}>
      <Bridge
        voSlug="p1_b3_setup_scc"
        voDurSec={P1_DURATIONS.scc_bridge}
        brollSlug="feb11_fee_design"
        brollStartSec={6}
        credit={creditForBrollSlug('feb11_fee_design')}
        text="Each gas appliance in a new house gets the fee. The calculation starts with what economists call the social cost of carbon. A dollar value put on every ton of CO2."
        alignment={p1B3Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.scc_bite)} durationInFrames={F(P1_DURATIONS.scc_bite)}>
      <Bite
        biteSlug="p1_cassie_scc"
        tokens={p1CassieSccCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P1_DURATIONS.scc_bite}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.levels)} durationInFrames={F(P1_DURATIONS.levels)}>
      <Bridge
        voSlug="p1_b4_levels"
        voDurSec={P1_DURATIONS.levels}
        brollSlug="feb11_fee_levels"
        brollStartSec={0}
        credit={creditForBrollSlug('feb11_fee_levels')}
        text="Council had three fee levels in front of them that day. Low, reduced, and maximum. Per home, that's one thousand nine hundred fifty four dollars on the low end, up to nine thousand seven hundred seventy one on the high end."
        pops={[
          { text: '3 FEE LEVELS', sub: 'WEIGHED FEB 11',     start: 0.5, end: 4.5,  color: 'gold' },
          { text: '$1,954',        sub: 'LOW · MAX PER HOME', start: 5.4, end: 8.4,  color: 'white' },
          { text: '$9,771',        sub: 'MAX · MAX PER HOME', start: 8.5, end: 13.0, color: 'white' },
        ]}
        alignment={p1B4Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.impact)} durationInFrames={F(P1_DURATIONS.impact)}>
      <Bridge
        voSlug="p1_b5_impact"
        voDurSec={P1_DURATIONS.impact}
        brollSlug="feb11_fee_levels"
        brollStartSec={6}
        credit={creditForBrollSlug('feb11_fee_levels')}
        text="And here's what city staff projected those fee levels would do to the price of a new home. A zero point two three to one point one five percent bump in housing cost, depending on which level Council picks."
        pops={[
          { text: '0.23 → 1.15%', sub: 'BUMP IN HOUSING COST', start: 5.0, end: 9.5, color: 'gold' },
        ]}
        alignment={p1B5Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P1_OFFSETS.existing)} durationInFrames={F(P1_DURATIONS.existing)}>
      <Bridge
        voSlug="p1_b6_existing"
        voDurSec={P1_DURATIONS.existing}
        brollSlug="jan7_dais"
        brollStartSec={5}
        credit={creditForBrollSlug('jan7_dais')}
        zoomStart={1.10}
        zoomEnd={1.20}
        text="Important to know. This only applies to new construction. If you already own a Bend home with gas appliances, nothing changes for you. The fee covers new single family homes, duplexes, townhouses, and ADUs."
        pops={[
          { text: 'NEW CONSTRUCTION',                 sub: 'ONLY',          start: 1.0, end: 3.5,  color: 'gold' },
          { text: 'EXISTING HOMES',                   sub: 'NOT AFFECTED',  start: 3.5, end: 7.7,  color: 'white' },
          { text: 'SFR · DUPLEX · TOWNHOUSE · ADU',   sub: 'WHO PAYS',      start: 8.0, end: 12.5, color: 'gold' },
        ]}
        alignment={p1B6Align as { words: CaptionWord[] }}
      />
    </Sequence>
  </AbsoluteFill>
);

// ────────────────────────────────────────────────────────────────────────
// PART 2 — What people are arguing about (~66s)
// ────────────────────────────────────────────────────────────────────────

const P2_DURATIONS = {
  hook: 7.52,
  groups: 14.45,
  vote: 9.80,
  binary_bridge: 5.20,
  binary_bite: 9.26,
  chew_bridge: 7.34,
  chew_bite: 7.76,
  nudge_bridge: 6.82,
  nudge_bite: 9.48,
  landed: 8.67,
};
const P2_TOTAL_SEC = TITLE_CARD_SEC + Object.values(P2_DURATIONS).reduce((a, b) => a + b, 0);
export const BEND_PULSE_P2_TOTAL_SEC = P2_TOTAL_SEC;

const P2_OFFSETS = (() => {
  const o: Record<string, number> = {};
  let t = TITLE_CARD_SEC;
  for (const [k, v] of Object.entries(P2_DURATIONS)) { o[k] = t; t += v; }
  return o;
})();

export const BendPulsePart2: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence from={0} durationInFrames={F(TITLE_CARD_SEC)}>
      <TitleCard
        title="What People Are Arguing"
        subtitle="INSIDE THE BEND COUNCIL DEBATE"
        part={2}
        totalParts={3}
        backgroundClip="feb4_dais"
        creditLine={creditForBrollSlug('feb4_dais')}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.hook)} durationInFrames={F(P2_DURATIONS.hook)}>
      <Bridge
        voSlug="p2_b1_hook"
        voDurSec={P2_DURATIONS.hook}
        brollSlug="jan7_dais"
        brollStartSec={0}
        credit={creditForBrollSlug('jan7_dais')}
        text="When Bend put this fee on the table, three industries showed up at the Bend Economic Development Board in January to push back."
        zoomStart={1.10}
        zoomEnd={1.20}
        alignment={p2B1Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.groups)} durationInFrames={F(P2_DURATIONS.groups)}>
      <Bridge
        voSlug="p2_b2_groups"
        voDurSec={P2_DURATIONS.groups}
        brollSlug="feb11_grid_impact"
        brollStartSec={0}
        credit={creditForBrollSlug('feb11_grid_impact')}
        text="Central Oregon Builders said the fee will get passed straight to the home buyer. The Bend Chamber of Commerce asked for a time limited pilot before any fee goes live. And the plumbers and steamfitters union flagged grid capacity at Pacific Power."
        alignment={p2B2Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.vote)} durationInFrames={F(P2_DURATIONS.vote)}>
      <Bridge
        voSlug="p2_b3_vote"
        voDurSec={P2_DURATIONS.vote}
        brollSlug="jan7_dais"
        brollStartSec={9}
        credit={creditForBrollSlug('jan7_dais')}
        text="The board voted eight to zero, asking Council for that pilot. But on Council, the debate over fee levels and exemptions got real."
        zoomStart={1.10}
        zoomEnd={1.20}
        alignment={p2B3Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.binary_bridge)} durationInFrames={F(P2_DURATIONS.binary_bridge)}>
      <Bridge
        voSlug="p2_b4_setup_binary"
        voDurSec={P2_DURATIONS.binary_bridge}
        brollSlug="feb4_dais"
        brollStartSec={0}
        credit={creditForBrollSlug('feb4_dais')}
        text="One councilor pushed back hard on how the conversation has been framed in the community."
        zoomStart={1.10}
        zoomEnd={1.20}
        alignment={p2B4Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.binary_bite)} durationInFrames={F(P2_DURATIONS.binary_bite)}>
      <Bite
        biteSlug="p2_council_false_binary"
        tokens={p2BinaryCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P2_DURATIONS.binary_bite}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.chew_bridge)} durationInFrames={F(P2_DURATIONS.chew_bridge)}>
      <Bridge
        voSlug="p2_b5_setup_chew"
        voDurSec={P2_DURATIONS.chew_bridge}
        brollSlug="feb4_dais"
        brollStartSec={4}
        credit={creditForBrollSlug('feb4_dais')}
        text="Another councilor took the same line. Affordability and climate goals, in their view, are not mutually exclusive."
        zoomStart={1.10}
        zoomEnd={1.20}
        alignment={p2B5Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.chew_bite)} durationInFrames={F(P2_DURATIONS.chew_bite)}>
      <Bite
        biteSlug="p2_council_walk_chew"
        tokens={p2ChewCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P2_DURATIONS.chew_bite}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.nudge_bridge)} durationInFrames={F(P2_DURATIONS.nudge_bridge)}>
      <Bridge
        voSlug="p2_b6_setup_nudge"
        voDurSec={P2_DURATIONS.nudge_bridge}
        brollSlug="feb11_tcep"
        brollStartSec={0}
        credit={creditForBrollSlug('feb11_tcep')}
        text="And Council's read on what this fee is actually trying to do. Not a mandate. A signal to start the transition."
        alignment={p2B6Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.nudge_bite)} durationInFrames={F(P2_DURATIONS.nudge_bite)}>
      <Bite
        biteSlug="p2_council_nudge"
        tokens={p2NudgeCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P2_DURATIONS.nudge_bite}
      />
    </Sequence>
    <Sequence from={F(P2_OFFSETS.landed)} durationInFrames={F(P2_DURATIONS.landed)}>
      <Bridge
        voSlug="p2_b7_landed"
        voDurSec={P2_DURATIONS.landed}
        brollSlug="feb11_tcep"
        brollStartSec={4}
        credit={creditForBrollSlug('feb11_tcep')}
        text="Where it landed. A new Temporary Committee on Electrification Policy. Four advisory bodies, one table, working through fee design and incentives together."
        alignment={p2B7Align as { words: CaptionWord[] }}
      />
    </Sequence>
  </AbsoluteFill>
);

// ────────────────────────────────────────────────────────────────────────
// PART 3 — What happens next (~55s)
// ────────────────────────────────────────────────────────────────────────

const P3_DURATIONS = {
  hook: 4.36,
  qs_bridge: 7.34,
  qs_bite: 4.10,
  three_qs_bridge: 3.37,
  three_qs_bite: 3.20,
  stake_bridge: 4.49,
  stake_bite: 5.62,
  tcep_bridge: 3.24,
  tcep_bite: 4.82,
  dates: 12.96,
  start_loc: 12.49,
};
const P3_TOTAL_SEC = TITLE_CARD_SEC + Object.values(P3_DURATIONS).reduce((a, b) => a + b, 0);
export const BEND_PULSE_P3_TOTAL_SEC = P3_TOTAL_SEC;

const P3_OFFSETS = (() => {
  const o: Record<string, number> = {};
  let t = TITLE_CARD_SEC;
  for (const [k, v] of Object.entries(P3_DURATIONS)) { o[k] = t; t += v; }
  return o;
})();

export const BendPulsePart3: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence from={0} durationInFrames={F(TITLE_CARD_SEC)}>
      <TitleCard
        title="What Happens Next"
        subtitle="THE DATES THAT DECIDE IT"
        part={3}
        totalParts={3}
        backgroundClip="jan7_dais"
        creditLine={creditForBrollSlug('jan7_dais')}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.hook)} durationInFrames={F(P3_DURATIONS.hook)}>
      <Bridge
        voSlug="p3_b1_hook"
        voDurSec={P3_DURATIONS.hook}
        brollSlug="jan7_dais"
        brollStartSec={0}
        credit={creditForBrollSlug('jan7_dais')}
        text="Three dates worth putting on your calendar if you live in Bend or own land here."
        zoomStart={1.10}
        zoomEnd={1.20}
        alignment={p3B1Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.qs_bridge)} durationInFrames={F(P3_DURATIONS.qs_bridge)}>
      <Bridge
        voSlug="p3_b2_setup_qs"
        voDurSec={P3_DURATIONS.qs_bridge}
        brollSlug="feb11_approach"
        brollStartSec={0}
        credit={creditForBrollSlug('feb11_approach')}
        text="Before the fee goes to ordinance, three questions still need answers. From Cassie Lacy at that February eleventh meeting."
        alignment={p3B2Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.qs_bite)} durationInFrames={F(P3_DURATIONS.qs_bite)}>
      <Bite
        biteSlug="p3_cassie_questions"
        tokens={p3QuestionsCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P3_DURATIONS.qs_bite}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.three_qs_bridge)} durationInFrames={F(P3_DURATIONS.three_qs_bridge)}>
      <Bridge
        voSlug="p3_b3_setup_three_qs"
        voDurSec={P3_DURATIONS.three_qs_bridge}
        brollSlug="feb11_tcep"
        brollStartSec={5}
        credit={creditForBrollSlug('feb11_tcep')}
        text="And the other two questions Council still has to decide."
        alignment={p3B3Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.three_qs_bite)} durationInFrames={F(P3_DURATIONS.three_qs_bite)}>
      <Bite
        biteSlug="p3_cassie_three_questions"
        tokens={p3ThreeQsCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P3_DURATIONS.three_qs_bite}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.stake_bridge)} durationInFrames={F(P3_DURATIONS.stake_bridge)}>
      <Bridge
        voSlug="p3_b4_setup_stake"
        voDurSec={P3_DURATIONS.stake_bridge}
        brollSlug="feb11_approach"
        brollStartSec={5}
        credit={creditForBrollSlug('feb11_approach')}
        text="The way Council plans to answer all three. Through targeted stakeholder engagement."
        alignment={p3B4Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.stake_bite)} durationInFrames={F(P3_DURATIONS.stake_bite)}>
      <Bite
        biteSlug="p3_cassie_stakeholder"
        tokens={p3StakeCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P3_DURATIONS.stake_bite}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.tcep_bridge)} durationInFrames={F(P3_DURATIONS.tcep_bridge)}>
      <Bridge
        voSlug="p3_b5_setup_tcep"
        voDurSec={P3_DURATIONS.tcep_bridge}
        brollSlug="feb11_tcep"
        brollStartSec={11}
        credit={creditForBrollSlug('feb11_tcep')}
        text="Specifically through the new committee they just created."
        alignment={p3B5Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.tcep_bite)} durationInFrames={F(P3_DURATIONS.tcep_bite)}>
      <Bite
        biteSlug="p3_cassie_tcep"
        tokens={p3TcepCaps as Array<{ text: string; start: number; end: number }>}
        durationSec={P3_DURATIONS.tcep_bite}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.dates)} durationInFrames={F(P3_DURATIONS.dates)}>
      <Bridge
        voSlug="p3_b6_dates"
        voDurSec={P3_DURATIONS.dates}
        brollSlug="feb11_fee_levels"
        brollStartSec={0}
        credit={creditForBrollSlug('feb11_fee_levels')}
        text="Three dates locked in. Late May or early June, the public hearing on the fee. June third, first reading of the ordinance. June seventeenth, second reading. After that, it becomes law."
        pops={[
          { text: 'LATE MAY · EARLY JUNE', sub: 'PUBLIC HEARING', start: 1.5,  end: 5.4,  color: 'gold' },
          { text: 'JUNE 3',                sub: 'FIRST READING',  start: 5.5,  end: 7.7,  color: 'white' },
          { text: 'JUNE 17',               sub: 'SECOND READING', start: 7.8,  end: 9.6,  color: 'white' },
          { text: 'BECOMES LAW',                                  start: 9.7,  end: 12.5, color: 'gold' },
        ]}
        alignment={p3B6Align as { words: CaptionWord[] }}
      />
    </Sequence>
    <Sequence from={F(P3_OFFSETS.start_loc)} durationInFrames={F(P3_DURATIONS.start_loc)}>
      <Bridge
        voSlug="p3_b7_start_loc"
        voDurSec={P3_DURATIONS.start_loc}
        brollSlug="feb4_dais"
        brollStartSec={0}
        credit={creditForBrollSlug('feb4_dais')}
        text="Earliest possible start date for the fee. April first, twenty twenty seven. Bend City Hall, seven ten northwest Wall Street. Public can attend in person or watch online."
        zoomStart={1.10}
        zoomEnd={1.20}
        pops={[
          { text: 'APR 1, 2027',    sub: 'EARLIEST START', start: 3.0, end: 5.0,  color: 'gold' },
          { text: 'BEND CITY HALL', sub: '710 NW WALL ST', start: 5.4, end: 12.0, color: 'white' },
        ]}
        alignment={p3B7Align as { words: CaptionWord[] }}
      />
    </Sequence>
  </AbsoluteFill>
);
