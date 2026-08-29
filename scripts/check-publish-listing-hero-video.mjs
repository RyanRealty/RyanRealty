#!/usr/bin/env node
/**
 * Listing-detail hero Unmute lock.
 *
 * Unmute is for a native marketing <video>. A Zillow 3D / Matterport pano
 * in details.Videos is a tour. Founding case: 61579 Rockway 220226183.
 *
 *   node scripts/check-publish-listing-hero-video.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-hero-video.ts')
checks.push({
  label: 'SoR names tour URLs and unmute only on video-tag',
  ok:
    /export function isListingVirtualTour/.test(helper) &&
    /export function publishListingHeroVideo/.test(helper) &&
    /export function publishListingHeroUnmute/.test(helper) &&
    helper.includes('zillow.com/view-imx') &&
    helper.includes("embedType === 'video-tag'"),
})

const videos = src('lib/data/videos/getListingVideos.ts')
checks.push({
  label: 'details.Videos 3D rows tag isVirtualTour',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hero-video['"]/.test(videos) &&
    /isListingVirtualTour\(/.test(videos) &&
    videos.includes('isVirtualTour: true') &&
    videos.includes('listing-videos-v12'),
})

const hero = src('components/site/listing-detail/ListingHero.tsx')
checks.push({
  label: 'ListingHero uses publishListingHeroVideo + Unmute',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hero-video['"]/.test(hero) &&
    /publishListingHeroVideo\(videos\)/.test(hero) &&
    /publishListingHeroUnmute\(heroVideo\)/.test(hero) &&
    hero.includes('canUnmute'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-hero-video: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-hero-video: ${checks.length}/${checks.length}`)
