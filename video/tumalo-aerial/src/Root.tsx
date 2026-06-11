// Tumalo aerial — isolated Remotion project for Photorealistic 3D Tiles
// productions targeted at 19496 Tumalo Reservoir Rd. Sibling of cascade-peaks
// because cascade-peaks/Root.tsx is locked.
//
// 2026-06-09: Added neighborhood flyover compositions — config-driven batch
// for 27 neighborhoods + resort communities. PILOT: Awbrey Butte.
// Batch of 26 added 2026-06-09 via _gen_root_tsx.mjs

import React from 'react';
import { Composition } from 'remotion';

import { EarthZoomTumalo } from './EarthZoomTumalo';
import { FlyoverTumalo } from './FlyoverTumalo';
import { NeighborhoodHero } from './NeighborhoodHero';
import { NeighborhoodSocial } from './NeighborhoodSocial';
import { NeighborhoodHeroGeneric } from './NeighborhoodHeroGeneric';
import { NeighborhoodSocialGeneric } from './NeighborhoodSocialGeneric';
import { AWBREY_BUTTE } from './neighborhoodConfig';

// ── Batch area configs + rings (26 areas)
import { BendRiverWest, BendRiverWest_RING } from './neighborhoodConfig';
import { BendOldBend, BendOldBend_RING } from './neighborhoodConfig';
import { BendSummitWest, BendSummitWest_RING } from './neighborhoodConfig';
import { BendCenturyWest, BendCenturyWest_RING } from './neighborhoodConfig';
import { BendOrchardDistrict, BendOrchardDistrict_RING } from './neighborhoodConfig';
import { BendMountainView, BendMountainView_RING } from './neighborhoodConfig';
import { BendLarkspur, BendLarkspur_RING } from './neighborhoodConfig';
import { BendOldFarmDistrict, BendOldFarmDistrict_RING } from './neighborhoodConfig';
import { BendBoydAcres, BendBoydAcres_RING } from './neighborhoodConfig';
import { BendSouthernCrossing, BendSouthernCrossing_RING } from './neighborhoodConfig';
import { BendSouthwestBend, BendSouthwestBend_RING } from './neighborhoodConfig';
import { BendSoutheastBend, BendSoutheastBend_RING } from './neighborhoodConfig';
import { Tetherow, Tetherow_RING } from './neighborhoodConfig';
import { BrokenTop, BrokenTop_RING } from './neighborhoodConfig';
import { EagleCrest, EagleCrest_RING } from './neighborhoodConfig';
import { Sunriver, Sunriver_RING } from './neighborhoodConfig';
import { Pronghorn, Pronghorn_RING } from './neighborhoodConfig';
import { BlackButteRanch, BlackButteRanch_RING } from './neighborhoodConfig';
import { CalderaSprings, CalderaSprings_RING } from './neighborhoodConfig';
import { AwbreyGlen, AwbreyGlen_RING } from './neighborhoodConfig';
import { NorthwestCrossing, NorthwestCrossing_RING } from './neighborhoodConfig';
import { Crosswater, Crosswater_RING } from './neighborhoodConfig';
import { BrasadaRanch, BrasadaRanch_RING } from './neighborhoodConfig';
import { WidgiCreek, WidgiCreek_RING } from './neighborhoodConfig';
import { VandevertRanch, VandevertRanch_RING } from './neighborhoodConfig';
import { ThreeRivers, ThreeRivers_RING } from './neighborhoodConfig';

const FPS = 30;
const W = 1080;
const H = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EarthZoomTumalo"
        component={EarthZoomTumalo}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="FlyoverTumalo"
        component={FlyoverTumalo}
        durationInFrames={12 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* ─── Neighborhood Flyover PILOT: Awbrey Butte ─────────────────────────
          Hard-coded compositions — pilot approved by Matt 2026-06-09.
          Hero: 16:9 1920×1080 seamless orbital loop for geo-page header.
          Social: 9:16 1080×1920 portrait flyover for Reels/TikTok/Shorts.
          ─────────────────────────────────────────────────────────────────── */}
      <Composition
        id="AwbreyButteHero"
        component={NeighborhoodHero}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AwbreyButteSocial"
        component={NeighborhoodSocial}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />

      {/* ─── Neighborhood Flyover BATCH (26 areas) ───────────────────────────
          Config-driven via NeighborhoodHeroGeneric + NeighborhoodSocialGeneric.
          All data from Supabase — no hand-drawn polygons.
          Generated 2026-06-09 via scripts/_gen_root_tsx.mjs
          ─────────────────────────────────────────────────────────────────── */}
      {/* River West (BendRiverWest) */}
      <Composition
        id="BendRiverWestHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendRiverWest, ring: BendRiverWest_RING }}
      />
      <Composition
        id="BendRiverWestSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendRiverWest, ring: BendRiverWest_RING }}
      />

      {/* Old Bend (BendOldBend) */}
      <Composition
        id="BendOldBendHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendOldBend, ring: BendOldBend_RING }}
      />
      <Composition
        id="BendOldBendSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendOldBend, ring: BendOldBend_RING }}
      />

      {/* Summit West (BendSummitWest) */}
      <Composition
        id="BendSummitWestHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendSummitWest, ring: BendSummitWest_RING }}
      />
      <Composition
        id="BendSummitWestSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendSummitWest, ring: BendSummitWest_RING }}
      />

      {/* Century West (BendCenturyWest) */}
      <Composition
        id="BendCenturyWestHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendCenturyWest, ring: BendCenturyWest_RING }}
      />
      <Composition
        id="BendCenturyWestSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendCenturyWest, ring: BendCenturyWest_RING }}
      />

      {/* Orchard District (BendOrchardDistrict) */}
      <Composition
        id="BendOrchardDistrictHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendOrchardDistrict, ring: BendOrchardDistrict_RING }}
      />
      <Composition
        id="BendOrchardDistrictSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendOrchardDistrict, ring: BendOrchardDistrict_RING }}
      />

      {/* Mountain View (BendMountainView) */}
      <Composition
        id="BendMountainViewHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendMountainView, ring: BendMountainView_RING }}
      />
      <Composition
        id="BendMountainViewSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendMountainView, ring: BendMountainView_RING }}
      />

      {/* Larkspur (BendLarkspur) */}
      <Composition
        id="BendLarkspurHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendLarkspur, ring: BendLarkspur_RING }}
      />
      <Composition
        id="BendLarkspurSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendLarkspur, ring: BendLarkspur_RING }}
      />

      {/* Old Farm District (BendOldFarmDistrict) */}
      <Composition
        id="BendOldFarmDistrictHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendOldFarmDistrict, ring: BendOldFarmDistrict_RING }}
      />
      <Composition
        id="BendOldFarmDistrictSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendOldFarmDistrict, ring: BendOldFarmDistrict_RING }}
      />

      {/* Boyd Acres (BendBoydAcres) */}
      <Composition
        id="BendBoydAcresHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendBoydAcres, ring: BendBoydAcres_RING }}
      />
      <Composition
        id="BendBoydAcresSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendBoydAcres, ring: BendBoydAcres_RING }}
      />

      {/* Southern Crossing (BendSouthernCrossing) */}
      <Composition
        id="BendSouthernCrossingHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendSouthernCrossing, ring: BendSouthernCrossing_RING }}
      />
      <Composition
        id="BendSouthernCrossingSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendSouthernCrossing, ring: BendSouthernCrossing_RING }}
      />

      {/* Southwest Bend (BendSouthwestBend) */}
      <Composition
        id="BendSouthwestBendHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendSouthwestBend, ring: BendSouthwestBend_RING }}
      />
      <Composition
        id="BendSouthwestBendSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendSouthwestBend, ring: BendSouthwestBend_RING }}
      />

      {/* Southeast Bend (BendSoutheastBend) */}
      <Composition
        id="BendSoutheastBendHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BendSoutheastBend, ring: BendSoutheastBend_RING }}
      />
      <Composition
        id="BendSoutheastBendSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BendSoutheastBend, ring: BendSoutheastBend_RING }}
      />

      {/* Tetherow (Tetherow) */}
      <Composition
        id="TetherowHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: Tetherow, ring: Tetherow_RING }}
      />
      <Composition
        id="TetherowSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: Tetherow, ring: Tetherow_RING }}
      />

      {/* Broken Top (BrokenTop) */}
      <Composition
        id="BrokenTopHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BrokenTop, ring: BrokenTop_RING }}
      />
      <Composition
        id="BrokenTopSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BrokenTop, ring: BrokenTop_RING }}
      />

      {/* Eagle Crest (EagleCrest) */}
      <Composition
        id="EagleCrestHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: EagleCrest, ring: EagleCrest_RING }}
      />
      <Composition
        id="EagleCrestSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: EagleCrest, ring: EagleCrest_RING }}
      />

      {/* Sunriver (Sunriver) */}
      <Composition
        id="SunriverHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: Sunriver, ring: Sunriver_RING }}
      />
      <Composition
        id="SunriverSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: Sunriver, ring: Sunriver_RING }}
      />

      {/* Pronghorn (Pronghorn) */}
      <Composition
        id="PronghornHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: Pronghorn, ring: Pronghorn_RING }}
      />
      <Composition
        id="PronghornSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: Pronghorn, ring: Pronghorn_RING }}
      />

      {/* Black Butte Ranch (BlackButteRanch) */}
      <Composition
        id="BlackButteRanchHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BlackButteRanch, ring: BlackButteRanch_RING }}
      />
      <Composition
        id="BlackButteRanchSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BlackButteRanch, ring: BlackButteRanch_RING }}
      />

      {/* Caldera Springs (CalderaSprings) */}
      <Composition
        id="CalderaSpringsHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: CalderaSprings, ring: CalderaSprings_RING }}
      />
      <Composition
        id="CalderaSpringsSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: CalderaSprings, ring: CalderaSprings_RING }}
      />

      {/* Awbrey Glen (AwbreyGlen) */}
      <Composition
        id="AwbreyGlenHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: AwbreyGlen, ring: AwbreyGlen_RING }}
      />
      <Composition
        id="AwbreyGlenSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: AwbreyGlen, ring: AwbreyGlen_RING }}
      />

      {/* NorthWest Crossing (NorthwestCrossing) */}
      <Composition
        id="NorthwestCrossingHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: NorthwestCrossing, ring: NorthwestCrossing_RING }}
      />
      <Composition
        id="NorthwestCrossingSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: NorthwestCrossing, ring: NorthwestCrossing_RING }}
      />

      {/* Crosswater (Crosswater) */}
      <Composition
        id="CrosswaterHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: Crosswater, ring: Crosswater_RING }}
      />
      <Composition
        id="CrosswaterSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: Crosswater, ring: Crosswater_RING }}
      />

      {/* Brasada Ranch (BrasadaRanch) */}
      <Composition
        id="BrasadaRanchHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: BrasadaRanch, ring: BrasadaRanch_RING }}
      />
      <Composition
        id="BrasadaRanchSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: BrasadaRanch, ring: BrasadaRanch_RING }}
      />

      {/* Widgi Creek (WidgiCreek) */}
      <Composition
        id="WidgiCreekHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: WidgiCreek, ring: WidgiCreek_RING }}
      />
      <Composition
        id="WidgiCreekSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: WidgiCreek, ring: WidgiCreek_RING }}
      />

      {/* Vandevert Ranch (VandevertRanch) */}
      <Composition
        id="VandevertRanchHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: VandevertRanch, ring: VandevertRanch_RING }}
      />
      <Composition
        id="VandevertRanchSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: VandevertRanch, ring: VandevertRanch_RING }}
      />

      {/* Three Rivers (ThreeRivers) */}
      <Composition
        id="ThreeRiversHero"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: ThreeRivers, ring: ThreeRivers_RING }}
      />
      <Composition
        id="ThreeRiversSocial"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: ThreeRivers, ring: ThreeRivers_RING }}
      />
    </>
  );
};
