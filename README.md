# Flag Match World — Atlas Index (Direction A)

The playable game with the **Atlas Index** design applied: a Swiss-editorial
skin — warm paper + ink, a single warm-red accent, ruled grids, condensed
display type (Saira Condensed) with monospace numerals (Space Mono) and Archivo
body text. Same game and structure as the other builds — only the theme skin
changed.

## Run it
Open `index.html`.

## How the styling is structured
- `style-new.css` — the original layout engine (HUD, board sizing, responsive). Untouched.
- `atlas-index.css` — the Atlas Index skin, layered on top. **Edit colours / type here.**
- `index.html` — Atlas Index startup screen + game; all game IDs kept intact.

## Assets (already wired)
```
assets/
├── fonts/            ← legacy local fonts (skin uses Google Fonts: Archivo, Saira Condensed, Space Mono)
├── sprites/flags/    ← all country flag tiles (included)
└── audio/            ← game audio
```
