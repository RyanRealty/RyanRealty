#!/usr/bin/env bash
# =============================================================================
# generate_market_report.sh
# Ryan Realty — Automated Market Report Video Generator
# Produces a 9:16 vertical video (1080x1920) suitable for Instagram/TikTok Reels
#
# USAGE:
#   ./generate_market_report.sh --config path/to/config.json
#
# OR inline (for scripted use):
#   ./generate_market_report.sh \
#     --city "Redmond" \
#     --date-label "YTD 2026" \
#     --photos "/path/photo1.jpg,/path/photo2.jpg,/path/photo3.jpg" \
#     --stats "48% of sales had concessions|48%|Buyers are negotiating closing cost help" \
#     --output "/path/to/output.mp4"
#
# DEPENDENCIES:
#   - ffmpeg (brew install ffmpeg or apt install ffmpeg)
#   - jq (brew install jq or apt install jq) — required for --config mode
#
# KEN BURNS HARD RULES (never exceed these):
#   - Max zoom: 1.08x
#   - Zoom formula: zoompan=z='min(pzoom+ZOOM_INC,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'
#   - ZOOM_INC = 0.08 / FRAMES (reaches exactly 1.08 at end of clip)
#   - Stat card duration: 4 seconds (120 frames at 30fps)
#   - Intro / outro cards: 3 seconds each
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# CONSTANTS — do not modify without reviewing Ken Burns hard rules above
# ---------------------------------------------------------------------------
readonly FPS=30
readonly WIDTH=1080
readonly HEIGHT=1920
readonly STAT_DURATION=4          # seconds per stat card
readonly CARD_DURATION=3          # seconds for intro/outro cards
readonly STAT_FRAMES=$((STAT_DURATION * FPS))     # 120 frames
readonly CARD_FRAMES=$((CARD_DURATION * FPS))     # 90 frames
readonly MAX_ZOOM=1.08
readonly ZOOM_INC=$(echo "scale=8; 0.08 / $STAT_FRAMES" | bc)   # ~0.000667 per frame
readonly CARD_ZOOM_INC=$(echo "scale=8; 0.08 / $CARD_FRAMES" | bc)

# Ryan Realty brand colors (hex → ffmpeg expects 0xRRGGBB or 0xAARRGGBB)
readonly NAVY="0x102742"          # Primary brand color
readonly GOLD="0xC9A84C"          # Accent brand color
readonly WHITE="0xFFFFFF"
readonly SHADOW="0x000000@0.6"    # Semi-transparent black for text shadow

# Text overlay font (DejaVu Sans Bold ships with most ffmpeg installs)
# To use Poppins: install it and update this path to the .ttf file
readonly FONT_PATH="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
readonly FONT_FALLBACK="DejaVuSans-Bold"  # fallback if path not found

# Font sizes for text tiers
readonly FONT_HEADLINE=52         # stat name / question line (top third)
readonly FONT_VALUE=84            # the big number (center)
readonly FONT_CONTEXT=36          # supporting context line (bottom third)
readonly FONT_BRAND=48            # city/date on intro card
readonly FONT_OUTRO=40            # Ryan Realty branding on outro

# Fade in/out duration (seconds) for text overlays
readonly FADE_DURATION=0.5
readonly FADE_FRAMES=$((FPS / 2))  # 15 frames at 30fps

# ---------------------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------------------

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --config <file.json>       Load all parameters from a JSON config file (recommended)
  --city <name>              City name (e.g., "Redmond")
  --date-label <label>       Period label (e.g., "YTD 2026")
  --photos <paths>           Comma-separated list of photo file paths
  --stats <stat_entries>     Pipe-separated stat cards: "headline|value|context"
                             Repeat --stats for each card
  --output <path>            Output video file path (default: ./market_report_<city>.mp4)
  --logo <path>              Path to Ryan Realty logo PNG (optional)
  --phone <number>           Phone number for outro card (default: 541.213.6706)
  --help                     Show this help message

JSON Config mode (preferred):
  Pass --config path/to/config.json and all parameters are loaded from the file.
  See market_report_config_example.json for the format.

Examples:
  # Using a config file (recommended):
  ./generate_market_report.sh --config redmond_config.json

  # Inline for quick runs:
  ./generate_market_report.sh \\
    --city "Redmond" \\
    --date-label "YTD 2026" \\
    --photos "/photos/redmond1.jpg,/photos/redmond2.jpg" \\
    --stats "Seller concessions|48%|Nearly half of closings" \\
    --stats "Median home price|\$475,000|188 sales YTD 2026" \\
    --output "/output/redmond_market_report.mp4"
EOF
  exit 0
}

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

check_dependencies() {
  command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg not found. Install with: brew install ffmpeg"
  command -v bc >/dev/null 2>&1 || die "bc not found. Install with: brew install bc"
  if [[ "${CONFIG_FILE:-}" != "" ]]; then
    command -v jq >/dev/null 2>&1 || die "jq not found (required for --config mode). Install: brew install jq"
  fi
}

# Resolve font path — try known system paths, fall back to fontname
resolve_font() {
  local candidates=(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"
    "/System/Library/Fonts/Helvetica.ttc"
    "/Library/Fonts/Arial Bold.ttf"
    "/usr/local/share/fonts/Poppins-Bold.ttf"
    "$HOME/Library/Fonts/Poppins-Bold.ttf"
  )
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      echo "$f"
      return
    fi
  done
  # Return fontname as last resort (ffmpeg will search system font dirs)
  echo "$FONT_FALLBACK"
}

# Escape text for ffmpeg drawtext filter (handle special characters)
escape_text() {
  local text="$1"
  # Escape single quotes, backslashes, and colons for drawtext
  text="${text//\\/\\\\}"
  text="${text//:/\\:}"
  text="${text//'/\\'}"
  echo "$text"
}

# Wrap long text at word boundaries for drawtext (no native word wrap in ffmpeg)
# Returns the text with \n inserted at appropriate points
wrap_text() {
  local text="$1"
  local max_chars="${2:-30}"
  echo "$text" | awk -v max="$max_chars" '
  {
    n = split($0, words, " ")
    line = ""
    for (i = 1; i <= n; i++) {
      if (length(line) + length(words[i]) + 1 > max && line != "") {
        printf "%s\n", line
        line = words[i]
      } else {
        line = (line == "") ? words[i] : line " " words[i]
      }
    }
    if (line != "") printf "%s", line
  }'
}

# ---------------------------------------------------------------------------
# VIDEO CLIP GENERATION FUNCTIONS
# ---------------------------------------------------------------------------

# Generate Ken Burns zoom effect on a single photo
# Args: input_photo output_clip duration_seconds zoom_direction
# zoom_direction: "in" (default, 1.0→1.08) or "out" (1.08→1.0)
generate_ken_burns_clip() {
  local input="$1"
  local output="$2"
  local duration="${3:-$STAT_DURATION}"
  local direction="${4:-in}"
  local frames=$((duration * FPS))
  local zoom_inc
  zoom_inc=$(echo "scale=8; 0.08 / $frames" | bc)

  # Ken Burns zoom formula — hard-capped at 1.08 per spec
  # zoompan filter: z=zoom expression, x/y=center anchor, d=duration in frames, s=output size
  local zoom_expr
  if [[ "$direction" == "out" ]]; then
    # Start zoomed in, slowly zoom out toward 1.0
    zoom_expr="z='if(eq(on\,1)\,1.08\,max(pzoom-${zoom_inc}\,1.0))'"
  else
    # Start at 1.0, slowly zoom in to max 1.08 (default)
    zoom_expr="z='min(pzoom+${zoom_inc}\,${MAX_ZOOM})'"
  fi

  local zoompan_filter="${zoom_expr}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}"

  ffmpeg -y \
    -loop 1 \
    -i "$input" \
    -vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},zoompan=${zoompan_filter}" \
    -t "$duration" \
    -c:v libx264 \
    -preset fast \
    -pix_fmt yuv420p \
    -an \
    "$output" \
    -loglevel error
}

# Add text overlay to an existing clip
# Args: input_clip output_clip headline value context font_path fade_start_frame
add_text_overlay() {
  local input="$1"
  local output="$2"
  local headline
  headline=$(escape_text "$3")
  local value
  value=$(escape_text "$4")
  local context
  context=$(escape_text "$5")
  local font="$6"
  local fade_start="${7:-0}"   # frame at which text fades in

  # Vertical positions (out of 1920px height):
  #   Headline: top third ~640px
  #   Value: center ~880px
  #   Context: bottom third ~1280px
  local y_headline=560
  local y_value=820
  local y_context=1200

  # Text fade-in expression: alpha starts at 0, reaches 1 over FADE_FRAMES
  local fade_expr="if(lt(n-${fade_start}\,${FADE_FRAMES})\,max(0\,(n-${fade_start})/${FADE_FRAMES})\,1)"

  # Build drawtext filter chain for all three text tiers
  # Each tier: shadow first (offset +3px), then the main white text on top
  local drawtext_filter=""

  # --- Headline (top third) ---
  # Shadow
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${headline}'"
  drawtext_filter+=":fontsize=${FONT_HEADLINE}"
  drawtext_filter+=":fontcolor=black@0.6"
  drawtext_filter+=":x=(w-text_w)/2+3"
  drawtext_filter+=":y=${y_headline}+3"
  drawtext_filter+=":alpha='${fade_expr}'"
  drawtext_filter+=":box=0,"
  # Main text
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${headline}'"
  drawtext_filter+=":fontsize=${FONT_HEADLINE}"
  drawtext_filter+=":fontcolor=white"
  drawtext_filter+=":x=(w-text_w)/2"
  drawtext_filter+=":y=${y_headline}"
  drawtext_filter+=":alpha='${fade_expr}',"

  # --- Value (center — big number) ---
  # Shadow
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${value}'"
  drawtext_filter+=":fontsize=${FONT_VALUE}"
  drawtext_filter+=":fontcolor=black@0.6"
  drawtext_filter+=":x=(w-text_w)/2+4"
  drawtext_filter+=":y=${y_value}+4"
  drawtext_filter+=":alpha='${fade_expr}'"
  drawtext_filter+=":box=0,"
  # Main text
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${value}'"
  drawtext_filter+=":fontsize=${FONT_VALUE}"
  drawtext_filter+=":fontcolor=0xC9A84C"   # Gold for the stat value — brand accent
  drawtext_filter+=":x=(w-text_w)/2"
  drawtext_filter+=":y=${y_value}"
  drawtext_filter+=":alpha='${fade_expr}',"

  # --- Context (bottom third) ---
  # Shadow
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${context}'"
  drawtext_filter+=":fontsize=${FONT_CONTEXT}"
  drawtext_filter+=":fontcolor=black@0.6"
  drawtext_filter+=":x=(w-text_w)/2+2"
  drawtext_filter+=":y=${y_context}+2"
  drawtext_filter+=":alpha='${fade_expr}'"
  drawtext_filter+=":box=0,"
  # Main text
  drawtext_filter+="drawtext=font='${font}'"
  drawtext_filter+=":text='${context}'"
  drawtext_filter+=":fontsize=${FONT_CONTEXT}"
  drawtext_filter+=":fontcolor=white@0.9"
  drawtext_filter+=":x=(w-text_w)/2"
  drawtext_filter+=":y=${y_context}"
  drawtext_filter+=":alpha='${fade_expr}'"

  ffmpeg -y \
    -i "$input" \
    -vf "$drawtext_filter" \
    -c:v libx264 \
    -preset fast \
    -pix_fmt yuv420p \
    -an \
    "$output" \
    -loglevel error
}

# Generate a solid-color card (intro or outro) with text
# Args: output_file duration bg_color lines... (varargs of text lines)
generate_text_card() {
  local output="$1"
  local duration="$2"
  local bg_color="$3"
  shift 3
  local lines=("$@")

  # Build lavfi source with solid background color
  local vf_filter="color=c=${bg_color}:size=${WIDTH}x${HEIGHT}:rate=${FPS}"

  # Build drawtext filters for each line, centered vertically
  local num_lines=${#lines[@]}
  local line_height=120  # pixels between line baselines
  local total_height=$(( (num_lines - 1) * line_height ))
  local start_y=$(( (HEIGHT - total_height) / 2 - 60 ))

  local drawtext_filters=""
  for i in "${!lines[@]}"; do
    local y=$(( start_y + i * line_height ))
    local text
    text=$(escape_text "${lines[$i]}")
    local fontsize
    if [[ $i -eq 0 ]]; then
      fontsize=$FONT_BRAND
    elif [[ $i -eq 1 ]]; then
      fontsize=$FONT_VALUE
    else
      fontsize=$FONT_CONTEXT
    fi

    [[ -n "$drawtext_filters" ]] && drawtext_filters+=","

    # Shadow
    drawtext_filters+="drawtext=font='${FONT_PATH}'"
    drawtext_filters+=":text='${text}'"
    drawtext_filters+=":fontsize=${fontsize}"
    drawtext_filters+=":fontcolor=black@0.5"
    drawtext_filters+=":x=(w-text_w)/2+3:y=${y}+3,"

    # Main text (gold for value lines, white for others)
    local fc="white"
    [[ $i -eq 1 ]] && fc="0xC9A84C"
    drawtext_filters+="drawtext=font='${FONT_PATH}'"
    drawtext_filters+=":text='${text}'"
    drawtext_filters+=":fontsize=${fontsize}"
    drawtext_filters+=":fontcolor=${fc}"
    drawtext_filters+=":x=(w-text_w)/2:y=${y}"
  done

  ffmpeg -y \
    -f lavfi \
    -i "${vf_filter}" \
    -vf "$drawtext_filters" \
    -t "$duration" \
    -c:v libx264 \
    -preset fast \
    -pix_fmt yuv420p \
    -an \
    "$output" \
    -loglevel error
}

# ---------------------------------------------------------------------------
# CONCATENATION
# ---------------------------------------------------------------------------

# Concatenate all clip files listed in a text file using ffmpeg concat demuxer
concatenate_clips() {
  local concat_list="$1"   # path to file containing "file 'path'\nduration N\n" entries
  local output="$2"

  ffmpeg -y \
    -f concat \
    -safe 0 \
    -i "$concat_list" \
    -c:v libx264 \
    -preset medium \
    -crf 20 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "$output" \
    -loglevel error
}

# ---------------------------------------------------------------------------
# PARAMETER PARSING
# ---------------------------------------------------------------------------

CITY=""
DATE_LABEL="YTD 2026"
OUTPUT_FILE=""
CONFIG_FILE=""
LOGO_PATH=""
PHONE="541.213.6706"
PHOTO_PATHS=()
STAT_CARDS=()  # Each entry: "headline|value|context"

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config)
        CONFIG_FILE="$2"; shift 2 ;;
      --city)
        CITY="$2"; shift 2 ;;
      --date-label)
        DATE_LABEL="$2"; shift 2 ;;
      --photos)
        IFS=',' read -ra PHOTO_PATHS <<< "$2"; shift 2 ;;
      --stats)
        STAT_CARDS+=("$2"); shift 2 ;;
      --output)
        OUTPUT_FILE="$2"; shift 2 ;;
      --logo)
        LOGO_PATH="$2"; shift 2 ;;
      --phone)
        PHONE="$2"; shift 2 ;;
      --help|-h)
        usage ;;
      *)
        die "Unknown argument: $1. Use --help for usage." ;;
    esac
  done
}

# Load parameters from JSON config file (jq required)
load_config() {
  local config="$1"
  [[ -f "$config" ]] || die "Config file not found: $config"

  CITY=$(jq -r '.city' "$config")
  DATE_LABEL=$(jq -r '.date_label // "YTD 2026"' "$config")
  PHONE=$(jq -r '.phone // "541.213.6706"' "$config")
  LOGO_PATH=$(jq -r '.logo_path // ""' "$config")
  OUTPUT_FILE=$(jq -r '.output_file // ""' "$config")

  # Load photo paths array
  mapfile -t PHOTO_PATHS < <(jq -r '.photos[]' "$config")

  # Load stat cards array — each entry is "headline|value|context"
  mapfile -t STAT_CARDS < <(jq -r '.stat_cards[] | "\(.headline)|\(.value)|\(.context)"' "$config")
}

# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------

validate_inputs() {
  [[ -n "$CITY" ]] || die "City name is required. Use --city or --config."
  [[ ${#PHOTO_PATHS[@]} -gt 0 ]] || die "At least one photo path is required."
  [[ ${#STAT_CARDS[@]} -gt 0 ]] || die "At least one stat card is required."

  for photo in "${PHOTO_PATHS[@]}"; do
    [[ -f "$photo" ]] || die "Photo file not found: $photo"
  done

  if [[ -n "$LOGO_PATH" && ! -f "$LOGO_PATH" ]]; then
    log "WARNING: Logo file not found at $LOGO_PATH — outro will use text only."
    LOGO_PATH=""
  fi
}

# ---------------------------------------------------------------------------
# MAIN PIPELINE
# ---------------------------------------------------------------------------

main() {
  parse_args "$@"

  # Load config file if provided (overrides inline args)
  [[ -n "$CONFIG_FILE" ]] && load_config "$CONFIG_FILE"

  check_dependencies
  validate_inputs

  # Set default output path
  if [[ -z "$OUTPUT_FILE" ]]; then
    local city_slug
    city_slug=$(echo "$CITY" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
    OUTPUT_FILE="./market_report_${city_slug}.mp4"
  fi

  local font
  font=$(resolve_font)
  log "Using font: $font"

  # Create temp directory for intermediate clips
  local tmpdir
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  local clip_index=0
  local concat_list="${tmpdir}/concat_list.txt"
  : > "$concat_list"   # truncate/create

  # --- 1. INTRO CARD ---
  log "Generating intro card: ${CITY} ${DATE_LABEL}..."
  local intro_clip="${tmpdir}/clip_$(printf '%03d' $clip_index)_intro.mp4"
  generate_text_card \
    "$intro_clip" \
    "$CARD_DURATION" \
    "${NAVY}" \
    "CENTRAL OREGON MARKET REPORT" \
    "${CITY^^}" \
    "${DATE_LABEL}" \
    "Ryan Realty | matt@ryan-realty.com"

  echo "file '${intro_clip}'" >> "$concat_list"
  echo "duration ${CARD_DURATION}" >> "$concat_list"
  (( clip_index++ )) || true

  # --- 2. STAT CARDS (one per photo/stat pair) ---
  # Photos cycle if there are more stat cards than photos
  local num_photos=${#PHOTO_PATHS[@]}
  local num_stats=${#STAT_CARDS[@]}

  for i in "${!STAT_CARDS[@]}"; do
    local stat="${STAT_CARDS[$i]}"
    IFS='|' read -r headline value context <<< "$stat"

    # Cycle through photos if we have fewer photos than stat cards
    local photo_index=$(( i % num_photos ))
    local photo="${PHOTO_PATHS[$photo_index]}"

    log "Generating stat card $((i+1))/${num_stats}: ${headline} = ${value}..."

    # Step 1: Ken Burns clip from photo
    local raw_clip="${tmpdir}/clip_$(printf '%03d' $clip_index)_raw.mp4"
    generate_ken_burns_clip "$photo" "$raw_clip" "$STAT_DURATION" "in"

    # Step 2: Add text overlay with fade-in
    local text_clip="${tmpdir}/clip_$(printf '%03d' $clip_index)_text.mp4"
    add_text_overlay \
      "$raw_clip" \
      "$text_clip" \
      "$headline" \
      "$value" \
      "$context" \
      "$font" \
      "$FADE_FRAMES"   # fade in starts at frame 15 (0.5 seconds)

    echo "file '${text_clip}'" >> "$concat_list"
    echo "duration ${STAT_DURATION}" >> "$concat_list"
    (( clip_index++ )) || true
  done

  # --- 3. OUTRO CARD ---
  log "Generating outro card: Ryan Realty branding..."
  local outro_clip="${tmpdir}/clip_$(printf '%03d' $clip_index)_outro.mp4"
  generate_text_card \
    "$outro_clip" \
    "$CARD_DURATION" \
    "${NAVY}" \
    "Ryan Realty" \
    "Matt Ryan, Principal Broker" \
    "${PHONE}" \
    "Bend, Oregon | ryan-realty.com" \
    "DM 'MARKET' for your free analysis"

  echo "file '${outro_clip}'" >> "$concat_list"
  echo "duration ${CARD_DURATION}" >> "$concat_list"

  # The concat demuxer needs the last entry to not have a trailing duration
  # (ffmpeg behavior: last file's duration is determined by its actual length)

  # --- 4. FINAL ASSEMBLY ---
  log "Assembling final video: ${OUTPUT_FILE}..."
  concatenate_clips "$concat_list" "$OUTPUT_FILE"

  # Verify output
  if [[ -f "$OUTPUT_FILE" ]]; then
    local filesize
    filesize=$(du -sh "$OUTPUT_FILE" | cut -f1)
    local duration
    duration=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT_FILE" 2>/dev/null | xargs printf "%.1f")
    log "SUCCESS: ${OUTPUT_FILE} (${filesize}, ${duration}s)"
    log "Clips generated: intro + ${num_stats} stat cards + outro"
    log "Total runtime: $((CARD_DURATION + num_stats * STAT_DURATION + CARD_DURATION))s (theoretical)"
  else
    die "Output file was not created. Check ffmpeg errors above."
  fi
}

# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
main "$@"
