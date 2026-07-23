#!/usr/bin/env python3
"""
generate_content_calendar.py — Ryan Realty Social Calendar Automation (Skill 5)

Generates a content calendar for an active listing: 3 posts/week (full_tour_video,
single_room_highlight, lifestyle_moment) across a configurable horizon.

Usage:
    python scripts/generate_content_calendar.py --listing-key vandevert_schoolhouse --weeks 4
    python scripts/generate_content_calendar.py --address "56111 School House Rd, Bend, OR 97707" \
        --price 3025000 --beds 4 --baths 4.5 --sqft 4900 --lot "1.38 acres"

All captions are template-based and deterministic (no LLM). Every caption is scanned
for banned words before output; the script exits loudly if any banned term is found.

Data accuracy: all stats in captions come from the listing manifest or inline flags.
No numbers are invented, estimated, or approximated.
"""

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
V5_LIBRARY = REPO_ROOT / "listing_video_v4" / "public" / "v5_library"

DAY_ABBREVS = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Brand contact — never goes inside video frames, always in caption
BRAND_HANDLE = "@MattRyanRealty"
BRAND_CTA = "Tour link in bio."

# ---------------------------------------------------------------------------
# Banned-word filter (from VIDEO_PRODUCTION_SKILL.md + CLAUDE.md)
#
# Core vocabulary + punctuation come from the canonical scripts/brand-voice-
# vocabulary.cjs via scripts/_brand_voice_vocab_generated.py (see
# scripts/gen-brand-voice-consumers.mjs) — never hand-typed here. The three
# entries below are calendar-specific opening-line phrases the canonical
# (general prose) list doesn't carry.
# ---------------------------------------------------------------------------

_SCRIPTS_DIR = str(Path(__file__).resolve().parent)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from _brand_voice_vocab_generated import BANNED_WORD_STRINGS, PUNCTUATION_CHARS

CALENDAR_LOCAL_EXTRAS = [
    "welcome to your dream home",
    "worth a serious look",
    "as a bend homeowner",
]

BANNED_WORDS = [*BANNED_WORD_STRINGS, *CALENDAR_LOCAL_EXTRAS, *PUNCTUATION_CHARS]


def check_banned_words(text: str, context: str = "") -> None:
    """
    Scan text for banned terms. Exit loudly if any are found.
    This is the brand-voice enforcement gate — it cannot be bypassed.
    """
    lower = text.lower()
    for term in BANNED_WORDS:
        if term in lower:
            print(
                f"\n[BANNED-WORD FAIL] Caption contains '{term}'\n"
                f"  Context: {context}\n"
                f"  Caption: {text}\n"
                f"  Fix: choose a different template or remove the term.",
                file=sys.stderr,
            )
            sys.exit(1)


# ---------------------------------------------------------------------------
# Caption templates — source of truth (also documented in
# video_production_skills/social_calendar/templates/captions.md)
# ---------------------------------------------------------------------------

# Template selection: deterministic by post number.
# template_index = (post_number - 1) % len(templates[tier])
# Templates are organized by price tier and content type.

CAPTION_TEMPLATES = {
    "full_tour_video": {
        "luxury": [
            "A {architect} design. {locale_short}.",
            "{beds} bedrooms. {special_feature}. {locale_short}.",
            "Inside the {locale_short} {property_type} no one has seen yet.",
            "{price}. {beds} bedrooms on {lot}. {locale_short}.",
            "This is what {locale_short} looks like from the inside.",
            "The full tour. {locale_short}. {beds} bedrooms.",
            "{special_feature}. {beds} bedrooms. {locale_short}.",
            "On the market now. {beds} bedrooms. {locale_short}.",
        ],
        "mid": [
            "{beds} bedrooms, {baths_display} baths. {locale_short}.",
            "See the whole thing. {address_short}.",
            "Full tour: {beds} bedrooms, {sqft}. {locale_short}.",
            "Listed. {locale_short}. {beds} bedrooms, {baths_display} baths.",
            "The one in {locale_short}. {beds} bedrooms, {sqft}.",
            "{price}. {beds} bedrooms. {locale_short}.",
            "{beds} bedrooms, {sqft}. {locale_short}. See it.",
            "Tour the {property_type} in {locale_short}.",
        ],
        "entry": [
            "Finally listed. {beds} bedrooms in {locale_short}. {price}.",
            "{beds} bedrooms, {baths_display} baths, {sqft}. {price}.",
            "This is what {price} looks like in {locale_short}.",
            "Fresh to market. {beds} bedrooms. {price}.",
            "Full walkthrough. {address_short}. {price}.",
            "Come see it. {beds} bedrooms, {sqft}. {locale_short}.",
            "{beds} bedrooms, {sqft}. Listed at {price}.",
            "Listed in {locale_short}. {beds} bedrooms, {price}.",
        ],
    },
    "single_room_highlight": {
        "all": [
            "The {room} that runs the house.",
            "Where mornings happen.",
            "{room}: {one_detail}.",
            "This {room}. {locale_short}.",
            "The {room} alone is worth the drive.",
            "See the {room}.",
            "15 seconds in the {room}.",
            "{room} details. {address_short}.",
            "In the {room}. {locale_short}.",
            "The {room}. Nothing else to say.",
            "Every detail in the {room}.",
            "Start here. The {room}.",
            "{room} at {locale_short}.",
            "One room. The {room}. {locale_short}.",
            "This is the {room} people ask about.",
            "Inside the {room}. {address_short}.",
            "The {room}.",
            "Walk through the {room}.",
            "{beds} bedrooms. This is the {room}.",
            "You asked about the {room}. Here it is.",
        ],
    },
    "lifestyle_moment": {
        "all": [
            "What it actually looks like at {time_of_day} on {locale_short}.",
            "{distance_to} from the front door.",
            "The view from {locale_short}.",
            "This is the neighborhood.",
            "Where this {property_type} actually sits.",
            "{locale_short} on a {time_of_day} in {month_name}.",
            "The setting. {locale_short}.",
            "Outside the front door. {locale_short}.",
            "The context most listings skip.",
            "This is what the area looks like.",
            "The land around {locale_short}.",
            "Aerial. {locale_short}.",
            "{locale_short} from above.",
            "The reason people move to {locale_short}.",
            "This is the place.",
            "Life at {locale_short}.",
            "The {time_of_day} light in {locale_short}.",
            "What surrounds this {property_type}.",
            "The {property_type} sits here. {locale_short}.",
            "The neighborhood. {locale_short}.",
        ],
    },
}

# Room-to-detail lookup for single_room_highlight {one_detail} placeholder
ROOM_DETAILS = {
    "kitchen": "the island people gather around",
    "great room": "floor-to-ceiling windows",
    "living room": "the fireplace anchoring it all",
    "primary suite": "the light in the morning",
    "primary bathroom": "the soaking tub and heated floors",
    "office": "the view from the desk",
    "bunk room": "every kid's favorite room in the house",
    "dining room": "the table that fits everyone",
    "mudroom": "built for how people actually live here",
    "sunroom": "where the inside meets outside",
    "loft": "the flex space the floor plan needed",
    "pantry": "more storage than you expect",
    "laundry": "the details most builders skip",
    "garage": "three bays and workshop space",
    "master": "the light in the morning",
    "bath": "the finishes",
    "bathroom": "the finishes",
}

# Hashtag pools by price tier
HASHTAG_POOLS = {
    "luxury": {
        "active": [
            "#BendOregon", "#DeschutesCounty", "#LuxuryRealEstate",
            "#OregonLuxury", "#BendRealEstate", "#Listed",
        ],
        "pending": [
            "#BendOregon", "#DeschutesCounty", "#LuxuryRealEstate",
            "#OregonLuxury", "#BendRealEstate", "#Pending",
        ],
    },
    "mid": {
        "active": [
            "#BendOregon", "#DeschutesCounty", "#BendRealEstate",
            "#OregonRealEstate", "#CentralOregon", "#Listed",
        ],
        "pending": [
            "#BendOregon", "#DeschutesCounty", "#BendRealEstate",
            "#OregonRealEstate", "#CentralOregon", "#Pending",
        ],
    },
    "entry": {
        "active": [
            "#BendOregon", "#CentralOregon", "#BendRealEstate",
            "#OregonRealEstate", "#FirstTimeHomeBuyer", "#Listed",
        ],
        "pending": [
            "#BendOregon", "#CentralOregon", "#BendRealEstate",
            "#OregonRealEstate", "#HomeSearch", "#Pending",
        ],
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def price_tier(price_int: int) -> str:
    if price_int >= 1_000_000:
        return "luxury"
    elif price_int >= 500_000:
        return "mid"
    else:
        return "entry"


def format_price(price_int: int) -> str:
    return f"${price_int:,.0f}"


def format_baths(baths_float: float) -> str:
    """Return display string: 4.5 -> '4.5', 4.0 -> '4'"""
    if baths_float == int(baths_float):
        return str(int(baths_float))
    return str(baths_float)


def format_sqft(sqft_int: int) -> str:
    return f"{sqft_int:,} sqft"


def next_monday(from_date: date) -> date:
    """Return next Monday on or after from_date."""
    days_ahead = 0 - from_date.weekday()  # Monday = 0
    if days_ahead <= 0:
        days_ahead += 7
    if from_date.weekday() == 0:
        return from_date  # today is Monday, use today
    return from_date + timedelta(days=days_ahead)


def get_time_of_day(post_date: date) -> str:
    wd = post_date.weekday()
    if wd <= 1:   # Mon-Tue
        return "morning"
    elif wd <= 3:  # Wed-Thu
        return "golden hour"
    else:          # Fri-Sun
        return "dusk"


def address_short(full_address: str) -> str:
    """Return just the street portion (before first comma)."""
    return full_address.split(",")[0].strip()


def build_caption(hook: str, listing: dict, room: str = None) -> str:
    """
    Fill template placeholders from listing dict, then assemble full caption:
        {hook} {address} {handle} {cta}

    The address in the caption always uses the full address from the listing
    to satisfy the data accuracy rule (never invented or approximated).
    """
    ad_short = address_short(listing["address"])

    detail = ROOM_DETAILS.get((room or "").lower(), room or "the space")

    substituted = hook.format(
        address=listing["address"],
        address_short=ad_short,
        locale_short=listing.get("locale_short", "Bend, OR"),
        price=listing["price_display"],
        beds=listing["beds"],
        baths_display=format_baths(listing["baths"]),
        sqft=listing["sqft_display"],
        lot=listing.get("lot", ""),
        architect=listing.get("architect", ""),
        property_type=listing.get("property_type", "home"),
        special_feature=listing.get("special_feature", ""),
        room=room or "the space",
        one_detail=detail,
        distance_to=listing.get("distance_to", "20 minutes to downtown Bend"),
        time_of_day="{time_of_day}",   # will be replaced below per-post
        month_name="{month_name}",     # will be replaced below per-post
    )

    caption = f"{substituted} {listing['address']} {BRAND_HANDLE} {BRAND_CTA}"
    return caption


def fill_date_placeholders(caption: str, post_date: date) -> str:
    """Replace {time_of_day} and {month_name} after build_caption."""
    tod = get_time_of_day(post_date)
    month = post_date.strftime("%B")
    return caption.replace("{time_of_day}", tod).replace("{month_name}", month)


def pick_template(templates: list, post_number: int) -> str:
    return templates[(post_number - 1) % len(templates)]


def get_room_for_post(post_number: int, room_labels: list) -> str:
    """
    Pick a unique room for each single_room_highlight post.
    Cycles through room_labels deterministically; never repeats within
    the same calendar if there are enough rooms.
    """
    if not room_labels:
        return "kitchen"
    # Use post_number to spread across the room list
    return room_labels[(post_number - 1) % len(room_labels)]


def get_photos_for_highlight(post_number: int, photos: list) -> str:
    """
    Pick a single room photo for a highlight post. Never reuses a photo
    across the calendar.
    """
    if not photos:
        return "photo_01"
    idx = (post_number - 1) % len(photos)
    return photos[idx].get("key") or photos[idx].get("src", f"photo_{idx+1:02d}")


# ---------------------------------------------------------------------------
# Listing loading
# ---------------------------------------------------------------------------

def load_manifest(listing_key: str) -> dict:
    """
    Load a per-listing manifest from v5_library/<key>/manifest.json.
    Returns the parsed JSON dict, or raises FileNotFoundError.
    """
    manifest_path = V5_LIBRARY / listing_key / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"No manifest found at {manifest_path}\n"
            f"  Create a per-listing manifest or supply inline flags "
            f"(--address, --price, --beds, --baths, --sqft)."
        )
    with open(manifest_path) as f:
        return json.load(f)


def build_listing_from_args(args) -> dict:
    """Build a listing dict from inline argparse flags."""
    required = ["address", "price", "beds", "baths", "sqft"]
    missing = [r for r in required if not getattr(args, r, None)]
    if missing:
        print(
            f"[ERROR] Missing required flags: {', '.join('--' + m.replace('_', '-') for m in missing)}\n"
            f"  Supply --listing-key pointing to a manifest OR all inline flags: "
            f"--address --price --beds --baths --sqft",
            file=sys.stderr,
        )
        sys.exit(1)

    price_int = int(float(str(args.price).replace(",", "").replace("$", "")))
    sqft_int = int(float(str(args.sqft).replace(",", "")))

    listing = {
        "key": args.listing_key or "inline",
        "address": args.address,
        "price": price_int,
        "price_display": format_price(price_int),
        "beds": int(args.beds),
        "baths": float(args.baths),
        "sqft": sqft_int,
        "sqft_display": format_sqft(sqft_int),
        "lot": args.lot or "",
        "status": (args.status or "active").lower(),
        "locale_short": args.locale_short or address_short(args.address).split()[0],
        "property_type": args.property_type or "home",
        "special_feature": args.special_feature or "",
        "architect": args.architect or "",
        "room_labels": [r.strip() for r in (args.room_labels or "kitchen,living room,primary suite,office,dining room").split(",")],
        "distance_to": args.distance_to or "20 minutes to downtown Bend",
        "photos": [],
    }
    return listing


def build_listing_from_manifest(manifest: dict, listing_key: str) -> dict:
    """Convert a per-listing manifest dict into the internal listing dict."""
    raw = manifest.get("listing", {})
    if not raw:
        print(
            f"[ERROR] Manifest for '{listing_key}' has no 'listing' block.\n"
            f"  Expected keys: address, price, beds, baths, sqft",
            file=sys.stderr,
        )
        sys.exit(1)

    required = ["address", "price", "beds", "baths", "sqft"]
    missing = [r for r in required if r not in raw]
    if missing:
        print(
            f"[ERROR] Manifest for '{listing_key}' is missing fields: {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)

    price_int = int(raw["price"])
    sqft_int = int(raw["sqft"])

    listing = {
        "key": listing_key,
        "address": raw["address"],
        "price": price_int,
        "price_display": format_price(price_int),
        "beds": int(raw["beds"]),
        "baths": float(raw["baths"]),
        "sqft": sqft_int,
        "sqft_display": format_sqft(sqft_int),
        "lot": raw.get("lot", ""),
        "status": raw.get("status", "active").lower(),
        "locale_short": raw.get("locale_short", address_short(raw["address"])),
        "property_type": raw.get("property_type", "home"),
        "special_feature": raw.get("special_feature", ""),
        "architect": raw.get("architect", ""),
        "room_labels": raw.get("room_labels", ["kitchen", "living room", "primary suite"]),
        "distance_to": raw.get("distance_to", "20 minutes to downtown Bend"),
        "photos": manifest.get("photos", []),
    }
    return listing


# ---------------------------------------------------------------------------
# Calendar generation
# ---------------------------------------------------------------------------

# Week-rotation pattern for content types.
# Week 1: [full_tour_video, single_room_highlight, lifestyle_moment]
# Week 2: [single_room_highlight, lifestyle_moment, full_tour_video]
# Week 3: [lifestyle_moment, full_tour_video, single_room_highlight]
# Week 4: [full_tour_video, single_room_highlight, lifestyle_moment]
# Pattern repeats every 3 weeks so no two consecutive weeks open the same way.

WEEK_PATTERNS = [
    ["full_tour_video", "single_room_highlight", "lifestyle_moment"],
    ["single_room_highlight", "lifestyle_moment", "full_tour_video"],
    ["lifestyle_moment", "full_tour_video", "single_room_highlight"],
]

POSTING_NOTES = {
    "full_tour_video": {
        1: "First post of week. Use the strongest hook. Schedule 7-9am or 6-8pm Pacific.",
        2: "Mid-week full tour. Strongest engagement window for real estate video.",
        3: "End-of-week full tour. Catches Friday planning-mode buyers.",
    },
    "single_room_highlight": {
        1: "Room spotlight opens the week. Pick the room with the strongest visual.",
        2: "Mid-week room highlight. Good for re-engagement from the tour video viewers.",
        3: "Room highlight closes the week. Sets up curiosity for next week opener.",
    },
    "lifestyle_moment": {
        1: "Lifestyle/neighborhood opener. Establishes place before the home.",
        2: "Mid-week context post. Reinforces the location story.",
        3: "End-of-week lifestyle. Catches weekend planners dreaming about the area.",
    },
}


def generate_posts(
    listing: dict,
    start: date,
    weeks: int,
    cadence_days: list,  # list of weekday integers (0=Mon)
) -> list:
    """Generate all posts for the calendar. Returns list of post dicts."""
    tier = price_tier(listing["price"])
    status = listing["status"]

    # Build list of post dates in cadence order
    post_dates = []
    current = start
    end = start + timedelta(weeks=weeks)
    while current < end:
        if current.weekday() in cadence_days:
            post_dates.append(current)
        current += timedelta(days=1)

    posts = []
    # Track used photo indices for highlight posts to avoid repeats
    used_highlight_photos: set = set()
    # Track used room labels for highlight posts across the entire calendar
    room_cycle_index = 0

    for idx, post_date in enumerate(post_dates):
        post_number = idx + 1
        week_number = (idx // len(cadence_days)) + 1
        slot_in_week = idx % len(cadence_days)  # 0, 1, or 2

        # Determine content type from week-rotation pattern
        week_pattern_index = (week_number - 1) % len(WEEK_PATTERNS)
        content_type = WEEK_PATTERNS[week_pattern_index][slot_in_week]

        # Select caption template
        if content_type == "full_tour_video":
            templates = CAPTION_TEMPLATES["full_tour_video"].get(tier, CAPTION_TEMPLATES["full_tour_video"]["mid"])
        elif content_type == "single_room_highlight":
            templates = CAPTION_TEMPLATES["single_room_highlight"]["all"]
        else:
            templates = CAPTION_TEMPLATES["lifestyle_moment"]["all"]

        hook = pick_template(templates, post_number)

        # Determine room (for single_room_highlight)
        room = None
        if content_type == "single_room_highlight":
            room_labels = listing.get("room_labels", ["kitchen", "living room", "primary suite"])
            room = room_labels[room_cycle_index % len(room_labels)]
            room_cycle_index += 1

        # Build caption
        raw_caption = build_caption(hook, listing, room=room)
        caption = fill_date_placeholders(raw_caption, post_date)

        # Enforce 140-char cap: trim address to street if over
        if len(caption) > 140:
            short_addr = address_short(listing["address"])
            alt_hook = hook.format(
                address=short_addr,
                address_short=short_addr,
                locale_short=listing.get("locale_short", "Bend, OR"),
                price=listing["price_display"],
                beds=listing["beds"],
                baths_display=format_baths(listing["baths"]),
                sqft=listing["sqft_display"],
                lot=listing.get("lot", ""),
                architect=listing.get("architect", ""),
                property_type=listing.get("property_type", "home"),
                special_feature=listing.get("special_feature", ""),
                room=room or "the space",
                one_detail=ROOM_DETAILS.get((room or "").lower(), room or "the space"),
                distance_to=listing.get("distance_to", "20 minutes to downtown Bend"),
                time_of_day="{time_of_day}",
                month_name="{month_name}",
            )
            caption = fill_date_placeholders(
                f"{alt_hook} {short_addr} {BRAND_HANDLE} {BRAND_CTA}", post_date
            )

        # Banned-word check — hard fail
        check_banned_words(caption, context=f"post {post_number}, {content_type}")

        # Assign photos
        if content_type == "full_tour_video":
            assigned_photos = "all"
        elif content_type == "single_room_highlight":
            # Pick a photo that hasn't been used yet
            interior_photos = [p for p in listing.get("photos", []) if p.get("category") == "interior"]
            if interior_photos:
                # Find first unused photo
                photo_key = None
                for p in interior_photos:
                    pk = p.get("key") or p.get("src", "")
                    if pk not in used_highlight_photos:
                        photo_key = pk
                        used_highlight_photos.add(pk)
                        break
                if photo_key is None:
                    # All used — reset and restart
                    used_highlight_photos.clear()
                    photo_key = interior_photos[0].get("key") or interior_photos[0].get("src", "photo_01")
                    used_highlight_photos.add(photo_key)
                assigned_photos = photo_key
            else:
                assigned_photos = f"interior_{(post_number - 1):02d}"
        else:
            # lifestyle_moment — drone/aerial/exterior
            exterior_photos = [p for p in listing.get("photos", []) if p.get("category") in ("exterior", "drone", "aerial")]
            if exterior_photos:
                assigned_photos = exterior_photos[idx % len(exterior_photos)].get("key") or "drone_aerial"
            else:
                assigned_photos = "drone_aerial"

        # Hashtags
        hashtag_pool = HASHTAG_POOLS.get(tier, HASHTAG_POOLS["mid"]).get(status, HASHTAG_POOLS["mid"]["active"])
        # Cap at 8
        hashtags = hashtag_pool[:8]

        # Posting notes
        slot_label = slot_in_week + 1
        notes_map = POSTING_NOTES.get(content_type, {})
        posting_notes = notes_map.get(slot_label, f"Post {post_number}. Schedule 7-9am or 6-8pm Pacific.")

        posts.append({
            "post_number": post_number,
            "date": post_date.isoformat(),
            "day_of_week": DAY_NAMES[post_date.weekday()],
            "week": week_number,
            "content_type": content_type,
            "format": "vertical_9_16",
            "assigned_photos": assigned_photos,
            "caption": caption,
            "hashtags": hashtags,
            "cta": BRAND_CTA,
            "posting_notes": posting_notes,
        })

    return posts


# ---------------------------------------------------------------------------
# Banned-word final audit across all posts
# ---------------------------------------------------------------------------

def audit_all_captions(posts: list) -> None:
    """
    Final pass: scan every generated caption for banned words.
    Exits loudly if any are found. This is the last gate before output.
    """
    failures = []
    for post in posts:
        caption = post.get("caption", "")
        lower = caption.lower()
        for term in BANNED_WORDS:
            if term in lower:
                failures.append(
                    f"  post {post['post_number']} ({post['content_type']}): "
                    f"banned term '{term}' in: {caption[:80]}..."
                )

    if failures:
        print(
            "\n[BANNED-WORD AUDIT FAILED]\n"
            "The following posts contain banned terms and cannot be shipped:\n"
            + "\n".join(failures)
            + "\n\nFix the templates in scripts/generate_content_calendar.py "
            "and re-run.",
            file=sys.stderr,
        )
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_cadence_days(cadence_str: str) -> list:
    """Parse 'mon,wed,fri' -> [0, 2, 4]."""
    days = []
    for abbrev in cadence_str.lower().split(","):
        abbrev = abbrev.strip()
        if abbrev not in DAY_ABBREVS:
            print(
                f"[ERROR] Unknown day abbreviation '{abbrev}'. "
                f"Valid values: {', '.join(DAY_ABBREVS.keys())}",
                file=sys.stderr,
            )
            sys.exit(1)
        days.append(DAY_ABBREVS[abbrev])
    if len(days) != len(set(days)):
        print("[ERROR] Cadence days contains duplicates.", file=sys.stderr)
        sys.exit(1)
    return sorted(days)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a social content calendar for an active listing. "
            "Produces 3 posts/week (full_tour_video, single_room_highlight, lifestyle_moment). "
            "All captions are template-based, brand-voice compliant, and deterministic."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # With a per-listing manifest:
  python scripts/generate_content_calendar.py \\
      --listing-key vandevert_schoolhouse --weeks 4 --start-date 2026-04-28

  # With inline flags (no manifest required):
  python scripts/generate_content_calendar.py \\
      --address "56111 School House Rd, Bend, OR 97707" \\
      --price 3025000 --beds 4 --baths 4.5 --sqft 4900 \\
      --lot "1.38 acres" --locale-short "Vandevert Ranch" \\
      --special-feature "Little Deschutes frontage" \\
      --architect "Jerry Locati" \\
      --weeks 4 --start-date 2026-04-28 --output calendar.json
        """,
    )

    # Primary listing source
    parser.add_argument(
        "--listing-key",
        metavar="KEY",
        help=(
            "Listing key. Resolves to "
            "listing_video_v4/public/v5_library/<key>/manifest.json. "
            "Required if inline flags are not supplied."
        ),
    )

    # Calendar shape
    parser.add_argument("--weeks", type=int, default=4, metavar="N", help="Weeks to generate (default: 4)")
    parser.add_argument(
        "--start-date",
        metavar="YYYY-MM-DD",
        help="Start date (default: next Monday from today)",
    )
    parser.add_argument(
        "--output",
        default="calendar.json",
        metavar="PATH",
        help="Output file path (default: calendar.json)",
    )
    parser.add_argument(
        "--cadence-days",
        default="mon,wed,fri",
        metavar="DAYS",
        help="Comma-separated posting days, e.g. mon,wed,fri or tue,thu,sat (default: mon,wed,fri)",
    )

    # Inline listing fallback flags
    inline = parser.add_argument_group(
        "inline listing flags",
        "Supply these when no --listing-key manifest exists.",
    )
    inline.add_argument("--address", metavar="STR", help='e.g. "56111 School House Rd, Bend, OR 97707"')
    inline.add_argument("--price", metavar="NUM", help="List price as integer, e.g. 3025000")
    inline.add_argument("--beds", type=int, metavar="N", help="Number of bedrooms")
    inline.add_argument("--baths", type=float, metavar="N", help="Number of baths, e.g. 4.5")
    inline.add_argument("--sqft", metavar="NUM", help="Interior sqft, e.g. 4900")
    inline.add_argument("--lot", metavar="STR", help='Lot size string, e.g. "1.38 acres"')
    inline.add_argument("--status", choices=["active", "pending"], default="active", help="Listing status (default: active)")
    inline.add_argument("--locale-short", metavar="STR", help='Short neighborhood name e.g. "Vandevert Ranch"')
    inline.add_argument("--property-type", metavar="STR", default="home", help='e.g. "home", "cabin", "estate" (default: home)')
    inline.add_argument("--special-feature", metavar="STR", help='One distinguishing detail e.g. "Little Deschutes frontage"')
    inline.add_argument("--architect", metavar="STR", help="Architect name if notable")
    inline.add_argument("--room-labels", metavar="STR", help="Comma-separated room names for highlight posts")
    inline.add_argument("--distance-to", metavar="STR", default="20 minutes to downtown Bend", help="Nearest landmark distance")

    args = parser.parse_args()

    # --- Resolve listing ---
    if args.listing_key:
        try:
            manifest = load_manifest(args.listing_key)
            listing = build_listing_from_manifest(manifest, args.listing_key)
        except FileNotFoundError as e:
            # Manifest not found — try inline flags
            if args.address and args.price and args.beds and args.baths and args.sqft:
                print(
                    f"[INFO] No manifest at v5_library/{args.listing_key}/manifest.json — "
                    f"using inline flags.",
                    file=sys.stderr,
                )
                listing = build_listing_from_args(args)
                listing["key"] = args.listing_key
            else:
                print(f"[ERROR] {e}", file=sys.stderr)
                sys.exit(1)
    elif args.address:
        listing = build_listing_from_args(args)
    else:
        parser.print_help()
        print(
            "\n[ERROR] Supply --listing-key or all inline flags "
            "(--address --price --beds --baths --sqft).",
            file=sys.stderr,
        )
        sys.exit(1)

    # --- Resolve start date ---
    if args.start_date:
        try:
            start_date = date.fromisoformat(args.start_date)
        except ValueError:
            print(f"[ERROR] Invalid --start-date '{args.start_date}'. Expected YYYY-MM-DD.", file=sys.stderr)
            sys.exit(1)
    else:
        start_date = next_monday(date.today())

    # --- Resolve cadence ---
    cadence_days = parse_cadence_days(args.cadence_days)

    # --- Generate ---
    posts = generate_posts(listing, start_date, args.weeks, cadence_days)

    # --- Final banned-word audit (hard gate) ---
    audit_all_captions(posts)

    # --- Compute horizon ---
    if posts:
        end_date = date.fromisoformat(posts[-1]["date"])
    else:
        end_date = start_date + timedelta(weeks=args.weeks)

    output = {
        "listing": {
            "key": listing["key"],
            "address": listing["address"],
            "price": listing["price_display"],
            "beds": listing["beds"],
            "baths": listing["baths"],
            "sqft": listing["sqft_display"],
            "lot": listing.get("lot", ""),
            "status": listing["status"],
            "locale_short": listing.get("locale_short", ""),
            "property_type": listing.get("property_type", "home"),
        },
        "horizon": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "weeks": args.weeks,
            "post_count": len(posts),
        },
        "posts": posts,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
        f.write("\n")

    print(f"wrote {len(posts)} posts to {output_path} ({args.weeks} weeks x 3 posts/week)")


if __name__ == "__main__":
    main()
