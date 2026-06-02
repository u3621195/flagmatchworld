# Flag Match World - Boarding Pass v5.18 Gameplay Logic Merge

Boarding Pass visual design with latest v5.17 gameplay/rules logic merged:

- Pure random flag selection from all 212 flags; no difficulty buckets.
- Unique flags: 1-8=24, 9-16=28, 17-24=32, 25-32=36, 33-40=40, 41-48=44, 49+=48.
- Timer: 1-48=8:00, 49-96=7:45, 97-144=7:30, 145-192=7:15, 193+=7:00 minimum.
- Old saved timer values are recalculated from current rules.
- Rule popup appears on Continue and Restart before timer starts.
- Main Game helpers deduct immediately and persist without refund on restart/quit/game over.
- Quick Game helpers remain temporary per session.

## Boarding Pass Polish Patch 3

- Tuned startup ticket height by orientation:
  - landscape is slightly shorter so the rounded boarding-pass corners remain visible;
  - portrait is slightly taller so the middle ticket fields are not clipped after rotation.
- Fixed the level-start popup number contrast by removing the old chrome/transparent text fill.
- Updated X-Center and Y-Center movement icons to the version with a visible gap between the arrows and the center line.
