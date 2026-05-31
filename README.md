# Flag Match World v5.14 Settings Padding Polish

Changes:
- Added inner breathing room to the Settings panel rows.
- Moved Music / Sound Effects labels slightly right.
- Moved toggle buttons slightly left.
- Kept the grouped settings box.


## v5.16 Pure Random Progression + Timer Scaling
- Removed difficulty-bucket based flag selection from level generation.
- Main Game now selects unique flags purely at random from all available flag entities.
- Updated unique-flag progression: 24, 28, 32, 36, 40, 44, then 48 cap from Level 49 onward.
- Updated timer progression: 8:00 through Level 48, then -15 seconds every 48 levels, capped at 7:00 minimum.
- Continue/save restore recalculates level timer from the current rules to prevent old saves from preserving outdated timer values.
