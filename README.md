# Flag Match World v5.11

Changes in this build:
- Continue from a fresh saved level checkpoint now shows the movement rule popup before the timer starts.
- Main Game helper inventory now deducts persistently when Hint or Shuffle is used.
- Restart Level, Home/Quit, Game Over, Retry, and Replay do not refund used helpers.
- Auto-shuffle remains free and does not consume Shuffle inventory.
- Quick Game remains temporary and resets helpers only when starting a new Quick Game session.

# Flag Match World v5.0

This package keeps the stable HTML/CSS Flag Match World game structure and real 3D flag sprites, while applying the useful gameplay-logic corrections inspired by the Google AI Studio version.

## Main fixes in this build

- Main Game unique flags by level:
  - Levels 1–8: 24 unique flags
  - Levels 9–16: 30 unique flags
  - Levels 17–24: 36 unique flags
  - Levels 25–32: 42 unique flags
  - Levels 33+: 48 unique flags max
- Every board still uses 72 pairs / 144 tiles.
- Duplicate pairs are distributed evenly across the selected unique flags.
- Quick Game uses 48 unique flags, temporary 5 Hints + 5 Shuffles, and does not save progress.
- Main Game starts with 5 Hints + 5 Shuffles.
- Helper refill rules now follow the locked blueprint.
- Movement pattern 6 collapses toward the vertical center column.
- Movement pattern 7 collapses toward the horizontal center row.

## QA helper

Open the browser console and use:

```js
__fmwDebug.expectedUniqueFlagsForLevel(1)        // 24
__fmwDebug.expectedUniqueFlagsForLevel(9)        // 30
__fmwDebug.expectedUniqueFlagsForLevel(17)       // 36
__fmwDebug.expectedUniqueFlagsForLevel(25)       // 42
__fmwDebug.expectedUniqueFlagsForLevel(33)       // 48
__fmwDebug.currentBoardUniqueFlags()             // current visible unique count
__fmwDebug.helperInventory()                     // current hints/shuffles
__fmwDebug.movementRuleForLevel(6)               // X CENTER
```


Version: v5.5 HUD Final Cleanup
- Removes legacy HINT/SHUFFLE pseudo text.
- Hides old movement rule icon from HUD.
- Locks HUD grid spacing to prevent timer/helper overlap.
