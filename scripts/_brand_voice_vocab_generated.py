# GENERATED — DO NOT EDIT. Source of truth: scripts/brand-voice-vocabulary.cjs
# Regenerate: node scripts/gen-brand-voice-consumers.mjs --write
#
# The single mirror of the canonical banned vocabulary for the build_*.py
# producer fleet. Import from here (via scripts/_producer_lib.py) instead of
# hand-typing a list — ci:voice-vocab-parity fails on any drift.

PUNCTUATION_CHARS = ["—", "–", ";", "!"]

BANNED_WORD_STRINGS = [
    "act fast",
    "buying a home is a big decision",
    "don't miss out",
    "dont miss out",
    "full-service brokerage",
    "great question",
    "independent brokerage by design",
    "let me explain in simple terms",
    "licensed and active brokers",
    "premier brokerage",
    "small team",
    "three brokers",
    "top producing",
    "we will handle everything",
    "won't last long",
    "wont last long",
    "you have great taste",
    "your local experts",
]

BANNED_WORDS = [
    {"word": "act fast", "category": "fake-urgency"},
    {"word": "buying a home is a big decision", "category": "pandering"},
    {"word": "don't miss out", "category": "fake-urgency"},
    {"word": "dont miss out", "category": "fake-urgency"},
    {"word": "full-service brokerage", "category": "category-positioning"},
    {"word": "great question", "category": "pandering"},
    {"word": "independent brokerage by design", "category": "category-positioning"},
    {"word": "let me explain in simple terms", "category": "pandering"},
    {"word": "licensed and active brokers", "category": "category-positioning"},
    {"word": "premier brokerage", "category": "self-praise"},
    {"word": "small team", "category": "category-positioning"},
    {"word": "three brokers", "category": "category-positioning"},
    {"word": "top producing", "category": "self-praise"},
    {"word": "we will handle everything", "category": "pandering"},
    {"word": "won't last long", "category": "fake-urgency"},
    {"word": "wont last long", "category": "fake-urgency"},
    {"word": "you have great taste", "category": "pandering"},
    {"word": "your local experts", "category": "self-praise"},
]
