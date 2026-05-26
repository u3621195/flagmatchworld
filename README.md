Flag Match World v1.0 - iOS/iPadOS Startup Screen Fix

Changes in this build:
- Rebuilt startup as a locked 16:9 stage so background, buttons, and toggles scale together.
- Removed Settings button from startup.
- Kept Continue, New Game, Quick Game, Music, Sound, and Theme as real controls.
- Replaced old Pocket Match themes with FMW themes: Emerald Green, Classic Blue, Dark Navy, Royal Purple, Burgundy Red.
- Theme toggle changes UI accent colors only and does not replace or hide the startup artwork.
- Added FMW theme variables for startup controls, HUD, popup, board/frame, timer, path, and helper buttons.

iOS/iPadOS Startup Fix (style-new.css append):
- Portrait mode: stage now fits full viewport width with 16:9 height and centers vertically
  (previously the 56.25vw height caused buttons to appear in the top quarter only).
- Safe-area insets applied to the overlay for notched iPhones (Dynamic Island, Face ID)
  and iPads with home bar using env(safe-area-inset-*).
- Stage background-size changed from 100% 100% (stretch) to cover (proportional scale).
- iPad 4:3 landscape: corrected media query from max-aspect-ratio:1.55/1 to max-aspect-ratio:16/9
  for accurate detection of iPad (4:3 = 1.33) vs widescreen (16:9 = 1.78) displays.
- Very tight landscape (iPhone SE landscape, ~568px): stage constrained to available height.
- @supports dvh fallback for older iOS Safari (< 15.4) using 100vh instead.
