# Flag Match World – FMW Popup Replacement Build

This build removes the remaining Pocket Match popup screens and replaces the in-game popup family with the Flag Match World emerald/gold popup system.

Included updates:
- Pause popup replaced with FMW design and working Resume / Restart Level / Settings / Home buttons.
- Level Complete popup replaced with FMW design and working Next Level / Replay Level / Home buttons.
- Game Over popup replaced with FMW design and working Retry / Home buttons.
- Settings popup replaced with FMW design and working Music / Sound Effects / Haptics / Theme / Back controls.
- Confirmation and message popups replaced with the compact FMW popup family.
- Only the flag sprite set is active; legacy non-flag sprite sets and startup card icons are removed.
- Continue remains checkpoint-based: it starts the saved level from the beginning, with full 8:00 time and a newly randomized tile layout.

The original uploaded standalone button component HTML files are kept in `/popup-components/` for reference.

- v3.7.1: Removed baked buttons from source popup artwork and overlaid live HTML controls for Pause, Level Complete, Game Over, and Settings.

- v3.7.2: Restored FMW startup artwork with live hotspots and hardened Pause popup live button clicks.
