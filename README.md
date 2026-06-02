Flag Match World - Atlas Index

Version: v5.18 Atlas Gameplay Logic Merge

Visual base:
- Claude's Atlas Index design, layout, CSS, and startup presentation are preserved.

Gameplay logic merged from latest Flag Match World v5.17+ decisions:
- Flag selection is now pure random from all 212 flags, with no difficulty buckets or weighting.
- Unique flags per level:
  - Levels 1-8: 24
  - Levels 9-16: 28
  - Levels 17-24: 32
  - Levels 25-32: 36
  - Levels 33-40: 40
  - Levels 41-48: 44
  - Levels 49+: 48 cap
- Timer allowance:
  - Levels 1-48: 8:00
  - Levels 49-96: 7:45
  - Levels 97-144: 7:30
  - Levels 145-192: 7:15
  - Levels 193+: 7:00 minimum
- Saved games recalculate the timer from the current level rules to avoid old timer values.
- Movement-rule popup now appears on Continue and Restart before the timer starts.
- Main Game helper inventory is persistent:
  - Hint/Shuffle deduct and save immediately.
  - Restart/Quit/Game Over/Replay do not refund helpers.
  - Auto-shuffle remains free.
- Startup mosaic iPhone landscape spacing fix retained.
