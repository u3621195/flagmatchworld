const ROWS = 9,
  COLS = 16,
  TOTAL_TIME = 480,
  MIN_TOTAL_TIME = 360,
  TIMER_STEP_PER_LOOP = 15,
  LEVEL_LOOP_SIZE = 8,
  HINTS = 5,
  SHUFFLES = 5,
  MAX_HINTS = 99,
  MAX_SHUFFLES = 99;
const SAVE_KEY = "pocketmatch_save_v1"; // legacy single-slot save key
const SAVES_KEY = "fmw_progress_v1";
const BEST_SCORES_KEY = "fmw_best_scores_v1";
const SPRITE_SET_KEY = "fmw_sprite_set_v1";
let audioCtx = null,
  muted = false,
  timerWarned = false;
let audioUnlocked = false;
let musicEnabled = true;
let soundEnabled = true;

function audio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function warmAudio(ac) {
  if (audioUnlocked || !ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    g.gain.setValueAtTime(0.00001, ac.currentTime);
    o.connect(g);
    g.connect(ac.destination);
    o.start(ac.currentTime);
    o.stop(ac.currentTime + 0.01);
    audioUnlocked = true;
  } catch (e) {}
}

function unlockAudio() {
  try {
    const ac = audio();
    const ready = () => warmAudio(ac);
    if (ac.state === "suspended") {
      ac.resume().then(ready).catch(ready);
    } else {
      ready();
    }
  } catch (e) {}
}

["touchstart", "pointerdown", "mousedown", "keydown", "click"].forEach(
  (type) => {
    document.addEventListener(type, unlockAudio, {
      capture: true,
      passive: true,
    });
  },
);

function withAudio(run) {
  if (muted || !soundEnabled) return;
  let ac;
  try {
    ac = audio();
  } catch (e) {
    return;
  }
  const play = () => {
    try {
      warmAudio(ac);
      run(ac);
    } catch (e) {}
  };
  if (ac.state === "suspended") {
    ac.resume().then(play).catch(play);
  } else {
    play();
  }
}

function tone(freq, dur = 0.08, type = "square", vol = 0.06, delay = 0) {
  withAudio((ac) => {
    let o = ac.createOscillator(),
      g = ac.createGain();
    const t = ac.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}

function noise(dur = 0.1, vol = 0.04, delay = 0) {
  withAudio((ac) => {
    let buf = ac.createBuffer(
        1,
        Math.max(1, Math.floor(ac.sampleRate * dur)),
        ac.sampleRate,
      ),
      data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    let src = ac.createBufferSource(),
      g = ac.createGain();
    const t = ac.currentTime + delay;
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(ac.destination);
    src.start(t);
  });
}
const sfx = {
  select() {
    tone(440, 0.045, "square", 0.035);
    tone(660, 0.035, "square", 0.025, 0.035);
  },
  match() {
    tone(523, 0.07, "square", 0.05);
    tone(659, 0.07, "square", 0.05, 0.06);
    tone(784, 0.09, "square", 0.055, 0.12);
    tone(1175, 0.12, "triangle", 0.035, 0.18);
    noise(0.12, 0.025, 0.04);
  },
  invalid() {
    tone(160, 0.12, "sawtooth", 0.045);
    tone(110, 0.1, "sawtooth", 0.035, 0.08);
  },
  shuffle() {
    noise(0.18, 0.05);
    tone(300, 0.05, "square", 0.035);
    tone(420, 0.05, "square", 0.035, 0.08);
    tone(540, 0.05, "square", 0.035, 0.16);
  },
  hint() {
    tone(880, 0.05, "triangle", 0.035);
    tone(1320, 0.06, "triangle", 0.03, 0.07);
    tone(1760, 0.06, "triangle", 0.025, 0.14);
  },
  warn() {
    tone(880, 0.08, "square", 0.045);
    tone(880, 0.08, "square", 0.045, 0.16);
  },
  level() {
    tone(392, 0.08, "square", 0.04);
    tone(523, 0.08, "square", 0.04, 0.08);
    tone(659, 0.08, "square", 0.04, 0.16);
    tone(784, 0.16, "square", 0.05, 0.24);
  },
  save() {
    tone(660, 0.06, "square", 0.04);
    tone(880, 0.08, "square", 0.035, 0.08);
    tone(1100, 0.1, "triangle", 0.025, 0.16);
  },
  timeup() {
    tone(220, 0.16, "sawtooth", 0.05);
    tone(196, 0.16, "sawtooth", 0.045, 0.18);
    tone(164, 0.25, "sawtooth", 0.04, 0.36);
  },
};

// ─────────────────────────────────────────────
//  THEME SYSTEM
// ─────────────────────────────────────────────
const THEMES = [
  { id: "emerald-green", name: "EMERALD", shortName: "Emerald" },
  { id: "deep-ocean", name: "DEEP OCEAN", shortName: "Ocean" },
  { id: "jade-gold", name: "JADE GOLD", shortName: "Jade Gold" },
  { id: "midnight-green", name: "MIDNIGHT GREEN", shortName: "Midnight" },
  { id: "tropical-teal", name: "TROPICAL TEAL", shortName: "Tropical" },
];
const THEME_ALIASES = {
  arcade: "emerald-green",
  ocean: "deep-ocean",
  obsidian: "midnight-green",
  cyber: "deep-ocean",
  amethyst: "jade-gold",
  "neon-night": "emerald-green",
  "cyber-blue": "deep-ocean",
  "arcade-purple": "jade-gold",
  "soft-sky": "emerald-green",
  "candy-pop": "jade-gold",
  "mint-fresh": "tropical-teal",
  "classic-blue": "deep-ocean",
  "dark-navy": "midnight-green",
  "royal-purple": "jade-gold",
  "burgundy-red": "jade-gold",
};
const THEME_STORAGE_KEY = "fmwThemeV1";
let currentTheme = "emerald-green";

const THEME_SWATCHES = {
  "emerald-green": ["#083d35", "#28b86e", "#3ccaa3", "#e8c56c"],
  "deep-ocean": ["#061f2f", "#0d6e75", "#2bb5a0", "#d6be78"],
  "jade-gold": ["#07392f", "#1ca66a", "#d7b85a", "#fff1b5"],
  "midnight-green": ["#020b0a", "#06332e", "#14916e", "#bfa15a"],
  "tropical-teal": ["#073d3a", "#15a692", "#49d6a7", "#f0d47a"],
};

function getThemeMeta(id) {
  const themeId = normalizeThemeId(id);
  return THEMES.find((theme) => theme.id === themeId) || THEMES[0];
}

function updateCompactThemeUi(id) {
  const themeId = normalizeThemeId(id);
  const meta = getThemeMeta(themeId);
  const pillName = $("themePillName");
  const pillSwatches = $("themePillSwatches");
  if (pillName) pillName.textContent = meta.name;
  if (pillSwatches) {
    pillSwatches.innerHTML = "";
    (THEME_SWATCHES[themeId] || THEME_SWATCHES["emerald-green"]).forEach((color) => {
      const dot = document.createElement("i");
      dot.style.background = color;
      pillSwatches.appendChild(dot);
    });
  }
  document.querySelectorAll(".theme-option").forEach((el) => {
    const isActive = normalizeThemeId(el.dataset.theme) === themeId;
    el.classList.toggle("active", isActive);
    el.classList.toggle("selected", isActive);
    el.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function openCompactThemePicker() {
  const overlay = $("themePickerOverlay");
  const btn = $("themePillBtn");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  if (btn) btn.setAttribute("aria-expanded", "true");
}

function closeCompactThemePicker() {
  const overlay = $("themePickerOverlay");
  const btn = $("themePillBtn");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  if (btn) btn.setAttribute("aria-expanded", "false");
}


function pathColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    halo: s.getPropertyValue("--path-halo").trim(),
    line: s.getPropertyValue("--path-line").trim(),
    core: s.getPropertyValue("--path-core").trim(),
  };
}

function normalizeThemeId(id) {
  const normalized = THEME_ALIASES[id] || id || "emerald-green";
  return THEMES.some((theme) => theme.id === normalized) ? normalized : "emerald-green";
}

function applyTheme(id, persist = true) {
  currentTheme = normalizeThemeId(id);
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.body.setAttribute("data-theme", currentTheme);
  updateCompactThemeUi(currentTheme);
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, currentTheme); } catch (err) {}
  }
}

function toggleThemePicker() {
  $("themePicker").classList.toggle("hidden");
}

document.addEventListener("click", (e) => {
  const picker = $("themePicker"),
    btn = $("themeBtn");
  if (!picker.contains(e.target) && e.target !== btn)
    picker.classList.add("hidden");
});

// ─────────────────────────────────────────────
//  MOVEMENT STRATEGIES
//  8-level loop:
//  1=NORMAL, 2=BOTTOM, 3=TOP, 4=LEFT,
//  5=RIGHT, 6=LEFT+RIGHT, 7=TOP+BOTTOM,
//  8=RANDOM, then repeats from NORMAL.
// ─────────────────────────────────────────────
const STRATEGIES = [
  { id: 0, name: "NORMAL", label: "No movement" },
  { id: 1, name: "BOTTOM", label: "Fall to bottom" },
  { id: 2, name: "TOP", label: "Rise to top" },
  { id: 3, name: "LEFT", label: "Slide to left" },
  { id: 4, name: "RIGHT", label: "Slide to right" },
  { id: 5, name: "LEFT+RIGHT", label: "Push left/right halves outward" },
  { id: 6, name: "TOP+BOTTOM", label: "Push top/bottom sections outward" },
  { id: 7, name: "RANDOM", label: "Random movement after each match" },
];
const RANDOM_MOVEMENT_IDS = [1, 2, 3, 4, 5, 6];

function getStrategy(lvl) {
  return STRATEGIES[(Math.max(1, lvl) - 1) % LEVEL_LOOP_SIZE];
}

function applyMovement(strategy) {
  const id = strategy.id;
  if (id === 0) return;
  if (id === 7) {
    const randomId =
      RANDOM_MOVEMENT_IDS[
        Math.floor(Math.random() * RANDOM_MOVEMENT_IDS.length)
      ];
    const randomStrategy =
      STRATEGIES.find((s) => s.id === randomId) || STRATEGIES[0];
    applyMovement(randomStrategy);
    return;
  }
  function compactLine(cells, dir) {
    let active = cells.filter((c) => !c.removed),
      empty = cells.filter((c) => c.removed);
    return dir === 1 ? [...empty, ...active] : [...active, ...empty];
  }
  function applyVertical(dir) {
    for (let c = 0; c < COLS; c++) {
      let col = board.map((row) => row[c]),
        comp = compactLine(col, dir);
      for (let r = 0; r < ROWS; r++) board[r][c] = comp[r];
    }
  }
  function applyHorizontal(dir) {
    for (let r = 0; r < ROWS; r++) board[r] = compactLine(board[r], dir);
  }
  function applyLeftRight() {
    const mid = Math.floor(COLS / 2);
    for (let r = 0; r < ROWS; r++) {
      const left = board[r].slice(0, mid);
      const right = board[r].slice(mid);
      board[r] = [...compactLine(left, 0), ...compactLine(right, 1)];
    }
  }
  function applyTopBottom() {
    const mid = Math.floor(ROWS / 2); // 9 rows => row index 4 is the neutral center row
    for (let c = 0; c < COLS; c++) {
      const top = [];
      const bottom = [];
      for (let r = 0; r < mid; r++) top.push(board[r][c]);
      const center = board[mid][c];
      for (let r = mid + 1; r < ROWS; r++) bottom.push(board[r][c]);
      const newTop = compactLine(top, 0); // rows 1–4 move TOP
      const newBottom = compactLine(bottom, 1); // rows 6–9 move BOTTOM
      for (let r = 0; r < mid; r++) board[r][c] = newTop[r];
      board[mid][c] = center; // row 5 stays as neutral center row
      for (let r = mid + 1; r < ROWS; r++)
        board[r][c] = newBottom[r - (mid + 1)];
    }
  }
  if (id === 1) applyVertical(1);
  else if (id === 2) applyVertical(0);
  else if (id === 3) applyHorizontal(0);
  else if (id === 4) applyHorizontal(1);
  else if (id === 5) applyLeftRight();
  else if (id === 6) applyTopBottom();
}

// ─────────────────────────────────────────────
//  SPRITES & ENTITIES
// ─────────────────────────────────────────────
const FLAGS_SPRITES = [
  { id: 1, n: "Afghanistan", img: "assets/sprites/flags/Afghanistan.png" },
  { id: 2, n: "Albania", img: "assets/sprites/flags/Albania.png" },
  { id: 3, n: "Algeria", img: "assets/sprites/flags/Algeria.png" },
  { id: 4, n: "Andorra", img: "assets/sprites/flags/Andorra.png" },
  { id: 5, n: "Angola", img: "assets/sprites/flags/Angola.png" },
  { id: 6, n: "Antigua and Barbuda", img: "assets/sprites/flags/Antigua and Barbuda.png" },
  { id: 7, n: "Argentina", img: "assets/sprites/flags/Argentina.png" },
  { id: 8, n: "Armenia", img: "assets/sprites/flags/Armenia.png" },
  { id: 9, n: "Aruba", img: "assets/sprites/flags/Aruba.png" },
  { id: 10, n: "Australia", img: "assets/sprites/flags/Australia.png" },
  { id: 11, n: "Austria", img: "assets/sprites/flags/Austria.png" },
  { id: 12, n: "Azerbaijan", img: "assets/sprites/flags/Azerbaijan.png" },
  { id: 13, n: "Bahrain", img: "assets/sprites/flags/Bahrain.png" },
  { id: 14, n: "Bangladesh", img: "assets/sprites/flags/Bangladesh.png" },
  { id: 15, n: "Barbados", img: "assets/sprites/flags/Barbados.png" },
  { id: 16, n: "Belarus", img: "assets/sprites/flags/Belarus.png" },
  { id: 17, n: "Belgium", img: "assets/sprites/flags/Belgium.png" },
  { id: 18, n: "Belize", img: "assets/sprites/flags/Belize.png" },
  { id: 19, n: "Benin", img: "assets/sprites/flags/Benin.png" },
  { id: 20, n: "Bhutan", img: "assets/sprites/flags/Bhutan.png" },
  { id: 21, n: "Bolivia", img: "assets/sprites/flags/Bolivia.png" },
  { id: 22, n: "Bosnia and Herzegovina", img: "assets/sprites/flags/Bosnia and Herzegovina.png" },
  { id: 23, n: "Botswana", img: "assets/sprites/flags/Botswana.png" },
  { id: 24, n: "Brazil", img: "assets/sprites/flags/Brazil.png" },
  { id: 25, n: "Brunei", img: "assets/sprites/flags/Brunei.png" },
  { id: 26, n: "Bulgaria", img: "assets/sprites/flags/Bulgaria.png" },
  { id: 27, n: "Burkina Faso", img: "assets/sprites/flags/Burkina Faso.png" },
  { id: 28, n: "Burundi", img: "assets/sprites/flags/Burundi.png" },
  { id: 29, n: "Cambodia", img: "assets/sprites/flags/Cambodia.png" },
  { id: 30, n: "Cameroon", img: "assets/sprites/flags/Cameroon.png" },
  { id: 31, n: "Canada", img: "assets/sprites/flags/Canada.png" },
  { id: 32, n: "Cape Verde", img: "assets/sprites/flags/Cape Verde.png" },
  { id: 33, n: "Central African Republic", img: "assets/sprites/flags/Central African Republic.png" },
  { id: 34, n: "Chad", img: "assets/sprites/flags/Chad.png" },
  { id: 35, n: "Chile", img: "assets/sprites/flags/Chile.png" },
  { id: 36, n: "China", img: "assets/sprites/flags/China.png" },
  { id: 37, n: "Chuuk State", img: "assets/sprites/flags/Chuuk State.png" },
  { id: 38, n: "Colombia", img: "assets/sprites/flags/Colombia.png" },
  { id: 39, n: "Comoros", img: "assets/sprites/flags/Comoros.png" },
  { id: 40, n: "Costa Rica", img: "assets/sprites/flags/Costa Rica.png" },
  { id: 41, n: "Croatia", img: "assets/sprites/flags/Croatia.png" },
  { id: 42, n: "Cuba", img: "assets/sprites/flags/Cuba.png" },
  { id: 43, n: "Curaçao", img: "assets/sprites/flags/Curaçao.png" },
  { id: 44, n: "Cyprus", img: "assets/sprites/flags/Cyprus.png" },
  { id: 45, n: "Czech Republic", img: "assets/sprites/flags/Czech Republic.png" },
  { id: 46, n: "Democratic Republic of the Congo", img: "assets/sprites/flags/Democratic Republic of the Congo.png" },
  { id: 47, n: "Denmark", img: "assets/sprites/flags/Denmark.png" },
  { id: 48, n: "Djibouti", img: "assets/sprites/flags/Djibouti.png" },
  { id: 49, n: "Dominica", img: "assets/sprites/flags/Dominica.png" },
  { id: 50, n: "Dominican Republic", img: "assets/sprites/flags/Dominican Republic.png" },
  { id: 51, n: "Ecuador", img: "assets/sprites/flags/Ecuador.png" },
  { id: 52, n: "Egypt", img: "assets/sprites/flags/Egypt.png" },
  { id: 53, n: "El Salvador", img: "assets/sprites/flags/El Salvador.png" },
  { id: 54, n: "England", img: "assets/sprites/flags/England.png" },
  { id: 55, n: "Equatorial Guinea", img: "assets/sprites/flags/Equatorial Guinea.png" },
  { id: 56, n: "Eritrea", img: "assets/sprites/flags/Eritrea.png" },
  { id: 57, n: "Estonia", img: "assets/sprites/flags/Estonia.png" },
  { id: 58, n: "Eswatini", img: "assets/sprites/flags/Eswatini.png" },
  { id: 59, n: "Ethiopia", img: "assets/sprites/flags/Ethiopia.png" },
  { id: 60, n: "Faroe Islands", img: "assets/sprites/flags/Faroe Islands.png" },
  { id: 61, n: "Federated States of Micronesia", img: "assets/sprites/flags/Federated States of Micronesia.png" },
  { id: 62, n: "Fiji", img: "assets/sprites/flags/Fiji.png" },
  { id: 63, n: "Finland", img: "assets/sprites/flags/Finland.png" },
  { id: 64, n: "France", img: "assets/sprites/flags/France.png" },
  { id: 65, n: "Gabon", img: "assets/sprites/flags/Gabon.png" },
  { id: 66, n: "Georgia", img: "assets/sprites/flags/Georgia.png" },
  { id: 67, n: "Germany", img: "assets/sprites/flags/Germany.png" },
  { id: 68, n: "Ghana", img: "assets/sprites/flags/Ghana.png" },
  { id: 69, n: "Greece", img: "assets/sprites/flags/Greece.png" },
  { id: 70, n: "Greenland", img: "assets/sprites/flags/Greenland.png" },
  { id: 71, n: "Grenada", img: "assets/sprites/flags/Grenada.png" },
  { id: 72, n: "Guam", img: "assets/sprites/flags/Guam.png" },
  { id: 73, n: "Guatemala", img: "assets/sprites/flags/Guatemala.png" },
  { id: 74, n: "Guinea-Bissau", img: "assets/sprites/flags/Guinea-Bissau.png" },
  { id: 75, n: "Guinea", img: "assets/sprites/flags/Guinea.png" },
  { id: 76, n: "Guyana", img: "assets/sprites/flags/Guyana.png" },
  { id: 77, n: "Haiti", img: "assets/sprites/flags/Haiti.png" },
  { id: 78, n: "Honduras", img: "assets/sprites/flags/Honduras.png" },
  { id: 79, n: "Hungary", img: "assets/sprites/flags/Hungary.png" },
  { id: 80, n: "Iceland", img: "assets/sprites/flags/Iceland.png" },
  { id: 81, n: "India", img: "assets/sprites/flags/India.png" },
  { id: 82, n: "Indonesia", img: "assets/sprites/flags/Indonesia.png" },
  { id: 83, n: "Iran", img: "assets/sprites/flags/Iran.png" },
  { id: 84, n: "Iraq", img: "assets/sprites/flags/Iraq.png" },
  { id: 85, n: "Israel", img: "assets/sprites/flags/Israel.png" },
  { id: 86, n: "Italy", img: "assets/sprites/flags/Italy.png" },
  { id: 87, n: "Ivory Coast", img: "assets/sprites/flags/Ivory Coast.png" },
  { id: 88, n: "Jamaica", img: "assets/sprites/flags/Jamaica.png" },
  { id: 89, n: "Japan", img: "assets/sprites/flags/Japan.png" },
  { id: 90, n: "Jordan", img: "assets/sprites/flags/Jordan.png" },
  { id: 91, n: "Kazakhstan", img: "assets/sprites/flags/Kazakhstan.png" },
  { id: 92, n: "Kenya", img: "assets/sprites/flags/Kenya.png" },
  { id: 93, n: "Kiribati", img: "assets/sprites/flags/Kiribati.png" },
  { id: 94, n: "Kosovo", img: "assets/sprites/flags/Kosovo.png" },
  { id: 95, n: "Kosrae", img: "assets/sprites/flags/Kosrae.png" },
  { id: 96, n: "Kuwait", img: "assets/sprites/flags/Kuwait.png" },
  { id: 97, n: "Kyrgyzstan", img: "assets/sprites/flags/Kyrgyzstan.png" },
  { id: 98, n: "Laos", img: "assets/sprites/flags/Laos.png" },
  { id: 99, n: "Latvia", img: "assets/sprites/flags/Latvia.png" },
  { id: 100, n: "Lebanon", img: "assets/sprites/flags/Lebanon.png" },
  { id: 101, n: "Lesotho", img: "assets/sprites/flags/Lesotho.png" },
  { id: 102, n: "Liberia", img: "assets/sprites/flags/Liberia.png" },
  { id: 103, n: "Libya", img: "assets/sprites/flags/Libya.png" },
  { id: 104, n: "Liechtenstein", img: "assets/sprites/flags/Liechtenstein.png" },
  { id: 105, n: "Lithuania", img: "assets/sprites/flags/Lithuania.png" },
  { id: 106, n: "Luxembourg", img: "assets/sprites/flags/Luxembourg.png" },
  { id: 107, n: "Madagascar", img: "assets/sprites/flags/Madagascar.png" },
  { id: 108, n: "Malawi", img: "assets/sprites/flags/Malawi.png" },
  { id: 109, n: "Malaysia", img: "assets/sprites/flags/Malaysia.png" },
  { id: 110, n: "Maldives", img: "assets/sprites/flags/Maldives.png" },
  { id: 111, n: "Mali", img: "assets/sprites/flags/Mali.png" },
  { id: 112, n: "Malta", img: "assets/sprites/flags/Malta.png" },
  { id: 113, n: "Marshall Islands", img: "assets/sprites/flags/Marshall Islands.png" },
  { id: 114, n: "Mauritania", img: "assets/sprites/flags/Mauritania.png" },
  { id: 115, n: "Mauritius", img: "assets/sprites/flags/Mauritius.png" },
  { id: 116, n: "Mexico", img: "assets/sprites/flags/Mexico.png" },
  { id: 117, n: "Moldova", img: "assets/sprites/flags/Moldova.png" },
  { id: 118, n: "Monaco", img: "assets/sprites/flags/Monaco.png" },
  { id: 119, n: "Mongolia", img: "assets/sprites/flags/Mongolia.png" },
  { id: 120, n: "Montenegro", img: "assets/sprites/flags/Montenegro.png" },
  { id: 121, n: "Morocco", img: "assets/sprites/flags/Morocco.png" },
  { id: 122, n: "Mozambique", img: "assets/sprites/flags/Mozambique.png" },
  { id: 123, n: "Myanmar", img: "assets/sprites/flags/Myanmar.png" },
  { id: 124, n: "Namibia", img: "assets/sprites/flags/Namibia.png" },
  { id: 125, n: "Nauru", img: "assets/sprites/flags/Nauru.png" },
  { id: 126, n: "Nepal", img: "assets/sprites/flags/Nepal.png" },
  { id: 127, n: "Netherlands", img: "assets/sprites/flags/Netherlands.png" },
  { id: 128, n: "New Zealand", img: "assets/sprites/flags/New Zealand.png" },
  { id: 129, n: "Nicaragua", img: "assets/sprites/flags/Nicaragua.png" },
  { id: 130, n: "Niger", img: "assets/sprites/flags/Niger.png" },
  { id: 131, n: "Nigeria", img: "assets/sprites/flags/Nigeria.png" },
  { id: 132, n: "North Korea", img: "assets/sprites/flags/North Korea.png" },
  { id: 133, n: "North Macedonia", img: "assets/sprites/flags/North Macedonia.png" },
  { id: 134, n: "Norway", img: "assets/sprites/flags/Norway.png" },
  { id: 135, n: "Oman", img: "assets/sprites/flags/Oman.png" },
  { id: 136, n: "Pakistan", img: "assets/sprites/flags/Pakistan.png" },
  { id: 137, n: "Palau", img: "assets/sprites/flags/Palau.png" },
  { id: 138, n: "Palestine", img: "assets/sprites/flags/Palestine.png" },
  { id: 139, n: "Panama", img: "assets/sprites/flags/Panama.png" },
  { id: 140, n: "Papua New Guinea", img: "assets/sprites/flags/Papua New Guinea.png" },
  { id: 141, n: "Paraguay", img: "assets/sprites/flags/Paraguay.png" },
  { id: 142, n: "Peru", img: "assets/sprites/flags/Peru.png" },
  { id: 143, n: "Philippines", img: "assets/sprites/flags/Philippines.png" },
  { id: 144, n: "Pohnpei State", img: "assets/sprites/flags/Pohnpei State.png" },
  { id: 145, n: "Poland", img: "assets/sprites/flags/Poland.png" },
  { id: 146, n: "Portugal", img: "assets/sprites/flags/Portugal.png" },
  { id: 147, n: "Puerto Rico", img: "assets/sprites/flags/Puerto Rico.png" },
  { id: 148, n: "Qatar", img: "assets/sprites/flags/Qatar.png" },
  { id: 149, n: "Republic of Ireland", img: "assets/sprites/flags/Republic of Ireland.png" },
  { id: 150, n: "Republic of the Congo", img: "assets/sprites/flags/Republic of the Congo.png" },
  { id: 151, n: "Republika Srpska", img: "assets/sprites/flags/Republika Srpska.png" },
  { id: 152, n: "Romania", img: "assets/sprites/flags/Romania.png" },
  { id: 153, n: "Russia", img: "assets/sprites/flags/Russia.png" },
  { id: 154, n: "Rwanda", img: "assets/sprites/flags/Rwanda.png" },
  { id: 155, n: "Saint Kitts and Nevis", img: "assets/sprites/flags/Saint Kitts and Nevis.png" },
  { id: 156, n: "Saint Lucia", img: "assets/sprites/flags/Saint Lucia.png" },
  { id: 157, n: "Saint Vincent and the Grenadines", img: "assets/sprites/flags/Saint Vincent and the Grenadines.png" },
  { id: 158, n: "Samoa", img: "assets/sprites/flags/Samoa.png" },
  { id: 159, n: "San Marino", img: "assets/sprites/flags/San Marino.png" },
  { id: 160, n: "Saudi Arabia", img: "assets/sprites/flags/Saudi Arabia.png" },
  { id: 161, n: "Scotland", img: "assets/sprites/flags/Scotland.png" },
  { id: 162, n: "Senegal", img: "assets/sprites/flags/Senegal.png" },
  { id: 163, n: "Serbia", img: "assets/sprites/flags/Serbia.png" },
  { id: 164, n: "Seychelles", img: "assets/sprites/flags/Seychelles.png" },
  { id: 165, n: "Sierra Leone", img: "assets/sprites/flags/Sierra Leone.png" },
  { id: 166, n: "Singapore", img: "assets/sprites/flags/Singapore.png" },
  { id: 167, n: "Sint Maarten", img: "assets/sprites/flags/Sint Maarten.png" },
  { id: 168, n: "Slovakia", img: "assets/sprites/flags/Slovakia.png" },
  { id: 169, n: "Slovenia", img: "assets/sprites/flags/Slovenia.png" },
  { id: 170, n: "Solomon Islands", img: "assets/sprites/flags/Solomon Islands.png" },
  { id: 171, n: "Somalia", img: "assets/sprites/flags/Somalia.png" },
  { id: 172, n: "South Africa", img: "assets/sprites/flags/South Africa.png" },
  { id: 173, n: "South Korea", img: "assets/sprites/flags/South Korea.png" },
  { id: 174, n: "South Sudan", img: "assets/sprites/flags/South Sudan.png" },
  { id: 175, n: "Spain", img: "assets/sprites/flags/Spain.png" },
  { id: 176, n: "Sri Lanka", img: "assets/sprites/flags/Sri Lanka.png" },
  { id: 177, n: "Sudan", img: "assets/sprites/flags/Sudan.png" },
  { id: 178, n: "Suriname", img: "assets/sprites/flags/Suriname.png" },
  { id: 179, n: "Sweden", img: "assets/sprites/flags/Sweden.png" },
  { id: 180, n: "Switzerland", img: "assets/sprites/flags/Switzerland.png" },
  { id: 181, n: "Syria", img: "assets/sprites/flags/Syria.png" },
  { id: 182, n: "São Tomé and Príncipe", img: "assets/sprites/flags/São Tomé and Príncipe.png" },
  { id: 183, n: "Tajikistan", img: "assets/sprites/flags/Tajikistan.png" },
  { id: 184, n: "Tanzania", img: "assets/sprites/flags/Tanzania.png" },
  { id: 185, n: "Thailand", img: "assets/sprites/flags/Thailand.png" },
  { id: 186, n: "The Bahamas", img: "assets/sprites/flags/The Bahamas.png" },
  { id: 187, n: "The Gambia", img: "assets/sprites/flags/The Gambia.png" },
  { id: 188, n: "Timor-Leste", img: "assets/sprites/flags/Timor-Leste.png" },
  { id: 189, n: "Togo", img: "assets/sprites/flags/Togo.png" },
  { id: 190, n: "Tonga", img: "assets/sprites/flags/Tonga.png" },
  { id: 191, n: "Trinidad and Tobago", img: "assets/sprites/flags/Trinidad and Tobago.png" },
  { id: 192, n: "Tunisia", img: "assets/sprites/flags/Tunisia.png" },
  { id: 193, n: "Turkey", img: "assets/sprites/flags/Turkey.png" },
  { id: 194, n: "Turkmenistan", img: "assets/sprites/flags/Turkmenistan.png" },
  { id: 195, n: "Tuvalu", img: "assets/sprites/flags/Tuvalu.png" },
  { id: 196, n: "Uganda", img: "assets/sprites/flags/Uganda.png" },
  { id: 197, n: "Ukraine", img: "assets/sprites/flags/Ukraine.png" },
  { id: 198, n: "United Arab Emirates", img: "assets/sprites/flags/United Arab Emirates.png" },
  { id: 199, n: "United Kingdom", img: "assets/sprites/flags/United Kingdom.png" },
  { id: 200, n: "United States of America", img: "assets/sprites/flags/United States of America.png" },
  { id: 201, n: "United States Virgin Islands", img: "assets/sprites/flags/United States Virgin Islands.png" },
  { id: 202, n: "Uruguay", img: "assets/sprites/flags/Uruguay.png" },
  { id: 203, n: "Uzbekistan", img: "assets/sprites/flags/Uzbekistan.png" },
  { id: 204, n: "Vanuatu", img: "assets/sprites/flags/Vanuatu.png" },
  { id: 205, n: "Vatican City", img: "assets/sprites/flags/Vatican City.png" },
  { id: 206, n: "Venezuela", img: "assets/sprites/flags/Venezuela.png" },
  { id: 207, n: "Vietnam", img: "assets/sprites/flags/Vietnam.png" },
  { id: 208, n: "Wales", img: "assets/sprites/flags/Wales.png" },
  { id: 209, n: "Yap State", img: "assets/sprites/flags/Yap State.png" },
  { id: 210, n: "Yemen", img: "assets/sprites/flags/Yemen.png" },
  { id: 211, n: "Zambia", img: "assets/sprites/flags/Zambia.png" },
  { id: 212, n: "Zimbabwe", img: "assets/sprites/flags/Zimbabwe.png" }
];
const DEFAULT_SPRITE_SET_ID = "flags";
const SPRITE_SETS = {
  flags: {
    name: "FLAGS",
    label: "World flag sprites",
    sprites: FLAGS_SPRITES,
    scale: 1,
  },
};
let currentSpriteSetId = determineInitialSpriteSet();
let entities = [];

const FRIENDLY_FLAG_NAMES = {
  "United States of America": "USA",
  "United Kingdom": "UK",
  "United Arab Emirates": "UAE",
  "Czech Republic": "Czechia",
  "Federated States of Micronesia": "Micronesia",
  "Democratic Republic of the Congo": "DR Congo",
  "Republic of the Congo": "Congo",
  "Republic of Ireland": "Ireland",
  "North Korea": "N. Korea",
  "South Korea": "S. Korea",
};

function friendlyFlagName(name) {
  return FRIENDLY_FLAG_NAMES[name] || name;
}

function buildEntities(setId) {
  const set = SPRITE_SETS[setId] || SPRITE_SETS.flags;
  return set.sprites.map((e) => ({
    id: e.id,
    name: friendlyFlagName(e.n),
    fullName: e.n,
    img: e.img,
    scale: e.scale || set.scale || 0.85,
  }));
}

function applySpriteSet(setId, opts = {}) {
  currentSpriteSetId = SPRITE_SETS[setId] ? setId : DEFAULT_SPRITE_SET_ID;
  entities = buildEntities(currentSpriteSetId);

  // Expose the active tile set to CSS so each asset pack can be tuned
  // independently for visual size and centering.
  try {
    document.body.dataset.spriteSet = currentSpriteSetId;
    if (typeof boardEl !== "undefined" && boardEl) {
      boardEl.dataset.spriteSet = currentSpriteSetId;
    }
  } catch (e) {}

  try {
    localStorage.setItem(SPRITE_SET_KEY, currentSpriteSetId);
  } catch (e) {}
  document
    .querySelectorAll(".sprite-option")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.set === currentSpriteSetId),
    );
  updateBoardInfo();
  if (typeof refreshStartScreen === "function") refreshStartScreen();
  if (typeof updateSpriteCarouselDots === "function")
    updateSpriteCarouselDots();
  if (
    typeof centerSpriteCarouselOn === "function" &&
    !opts.fromCarousel &&
    document.getElementById("spriteOptions")?.dataset.carouselReady === "1"
  ) {
    centerSpriteCarouselOn(currentSpriteSetId, true);
  }
}

function randomSpriteSetId(excludeId = null) {
  const ids = Object.keys(SPRITE_SETS);
  const pool = ids.length > 1 ? ids.filter((id) => id !== excludeId) : ids;
  const pick = typeof randomIndex === "function"
    ? randomIndex(pool.length)
    : Math.floor(Math.random() * pool.length);
  return pool[pick] || ids[0] || DEFAULT_SPRITE_SET_ID;
}

function applyQuickGameRandomSet() {
  if (!isQuickGame) return currentSpriteSetId;
  const nextSet = randomSpriteSetId(currentSpriteSetId);
  applySpriteSet(nextSet);
  return nextSet;
}

// Sprite set is applied after DOM refs are ready.

// ─────────────────────────────────────────────
//  DOM REFS & STATE
// ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const boardEl = $("board"),
  canvas = $("pathCanvas"),
  ctx = canvas.getContext("2d");
const overlay = $("overlay"),
  pauseOverlay = $("pauseOverlay"),
  levelCompleteOverlay = $("levelCompleteOverlay"),
  gameOverOverlay = $("gameOverOverlay");
const saveOverlay = $("saveOverlay");
let saveOverlayAction = "none";
const appShell = document.querySelector(".app-shell");
const levelEl = $("level"),
  scoreEl = $("score"),
  timerText = $("timerText"),
  timerBar = $("timerBar"),
  boardTimerBar = $("boardTimerBar");
const hintCountEl = $("hintCount"),
  shuffleCountEl = $("shuffleCount"),
  moveStatus = $("moveStatus");
const boardInfoEl = $("boardInfo");
const ruleTagEl = $("ruleTag");

let board = [],
  selected = null,
  score = 0,
  levelScore = 0,
  timeLeft = TOTAL_TIME,
  levelTotalTime = TOTAL_TIME;
let timerId = null,
  hintCount = HINTS,
  shuffleCount = SHUFFLES,
  level = 1,
  paused = false,
  gameStarted = false;
let comboCount = 0,
  lastMatchAt = 0,
  bestCombo = 0,
  usedHintLvl = 0,
  usedShuffLvl = 0;
const COMBO_WINDOW_MS = 5000;
const COMBO_POINTS = [100, 200, 300, 400, 500, 600];
const TIME_BONUS_PER_SECOND = 50;
const PERFECT_BONUS = 5000;
let isQuickGame = false,
  currentSaveSlotId = null;
let nextLevelReadyAfterComplete = false;
let scoreHistory = [];
let bestLevelScores = {};
let currentStrategy = STRATEGIES[0];

function getLevelTime(lvl) {
  const reduction =
    Math.floor((Math.max(1, lvl) - 1) / LEVEL_LOOP_SIZE) * TIMER_STEP_PER_LOOP;
  return Math.max(MIN_TOTAL_TIME, TOTAL_TIME - reduction);
}

function formatScore(value) {
  return Number(value || 0).toLocaleString("en-US");
}
function setScoreDisplay() {
  // HUD displays the current level score only.
  if (scoreEl) scoreEl.textContent = formatScore(levelScore);
}

function formatHelperCount(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function updateHelperDisplay() {
  hintCountEl.textContent = formatHelperCount(hintCount);
  shuffleCountEl.textContent = formatHelperCount(shuffleCount);
}
function refillHelpersAfterClearedLevel(clearedLevel, perfectClear = false) {
  if (isQuickGame) return false;
  let changed = false;
  if (clearedLevel > 0 && clearedLevel % 3 === 0) {
    hintCount = Math.min(MAX_HINTS, hintCount + 1);
    changed = true;
  }
  if (clearedLevel > 0 && clearedLevel % 5 === 0) {
    shuffleCount = Math.min(MAX_SHUFFLES, shuffleCount + 1);
    changed = true;
  }
  if (clearedLevel > 0 && clearedLevel % LEVEL_LOOP_SIZE === 0) {
    hintCount = Math.min(MAX_HINTS, hintCount + 2);
    shuffleCount = Math.min(MAX_SHUFFLES, shuffleCount + 1);
    changed = true;
  }
  if (perfectClear) {
    hintCount = Math.min(MAX_HINTS, hintCount + 1);
    changed = true;
  }
  if (changed) updateHelperDisplay();
  return changed;
}

function getUniqueFlagCountForLevel(lvl) {
  const safeLevel = Math.max(1, Number(lvl) || 1);
  if (safeLevel <= 8) return 24;
  if (safeLevel <= 16) return 30;
  if (safeLevel <= 24) return 36;
  if (safeLevel <= 32) return 42;
  return 48;
}

function totalFromBestLevelScores(scores = bestLevelScores) {
  return Object.values(scores || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}
applySpriteSet(currentSpriteSetId);
let bgm = new Audio("assets/audio/background-music.mp3");
bgm.loop = true;
bgm.volume = 0.4;
const uiAudio = {
  levelComplete: new Audio("assets/audio/level-complete.wav"),
  gameOver: new Audio("assets/audio/game-over.wav"),
};
uiAudio.levelComplete.volume = 0.65;
uiAudio.gameOver.volume = 0.6;
function playUiAudio(name) {
  if (muted || !soundEnabled) return;
  const a = uiAudio[name];
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    a.muted = muted || !soundEnabled;
    a.play().catch(() => {});
  } catch (e) {}
}

let bgmPausedByLifecycle = false;
let bgmWasPlayingBeforeLifecyclePause = false;
let bgmResumeRetryTimer = null;

function canPlayBgmNow() {
  return musicEnabled && gameStarted && !paused && !document.hidden;
}

function playBgmIfAllowed() {
  if (!canPlayBgmNow()) return;
  try {
    bgm.muted = !musicEnabled;
    const playPromise = bgm.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch (e) {}
}

function scheduleBgmResumeAfterLifecycle() {
  if (!canPlayBgmNow()) return;

  clearTimeout(bgmResumeRetryTimer);
  unlockAudio();
  playBgmIfAllowed();

  // iOS standalone web apps can need one short retry after pageshow/focus
  // because the page becomes visible before audio is fully allowed again.
  bgmResumeRetryTimer = setTimeout(() => {
    if (canPlayBgmNow() && bgm.paused) {
      unlockAudio();
      playBgmIfAllowed();
    }
  }, 250);
}

function pauseAudioForLifecycle() {
  // iOS can fire visibilitychange, pagehide, and blur for the same exit.
  // Preserve the original “was playing” state instead of letting a later blur
  // overwrite it after the BGM has already been paused.
  bgmWasPlayingBeforeLifecyclePause =
    bgmWasPlayingBeforeLifecyclePause || (musicEnabled && !bgm.paused);
  bgmPausedByLifecycle = true;

  clearTimeout(bgmResumeRetryTimer);

  try {
    bgm.pause();
  } catch (e) {}

  Object.values(uiAudio).forEach((a) => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch (e) {}
  });

  try {
    if (audioCtx && audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
  } catch (e) {}
}

function resumeAudioFromLifecycle() {
  const shouldResumeBgm =
    bgmPausedByLifecycle && bgmWasPlayingBeforeLifecyclePause && canPlayBgmNow();

  bgmPausedByLifecycle = false;
  bgmWasPlayingBeforeLifecyclePause = false;

  if (shouldResumeBgm) scheduleBgmResumeAfterLifecycle();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseAudioForLifecycle();
  } else {
    resumeAudioFromLifecycle();
  }
});
window.addEventListener("pagehide", pauseAudioForLifecycle);
window.addEventListener("pageshow", resumeAudioFromLifecycle);
window.addEventListener("blur", pauseAudioForLifecycle);
window.addEventListener("focus", resumeAudioFromLifecycle);

// ─────────────────────────────────────────────
//  SAVE / LOAD
// ─────────────────────────────────────────────
function serializeBoard() {
  // Store only entity id + removed flag per cell
  return board.map((row) =>
    row.map((cell) => ({ id: cell.entity.id, removed: cell.removed })),
  );
}

function deserializeBoard(data) {
  return data.map((row) =>
    row.map((cell) => {
      const entity = entities.find((e) => e.id === cell.id) || entities[0];
      return { entity, removed: cell.removed };
    }),
  );
}

function loadAllSaves() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveAllSaves(saves) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    return true;
  } catch (e) {
    return false;
  }
}

function migrateLegacySave() {
  try {
    if (localStorage.getItem(SAVES_KEY)) return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const old = JSON.parse(raw);
    if (!old || !old.board) return;
    const slot = SPRITE_SETS[old.spriteSet] ? old.spriteSet : DEFAULT_SPRITE_SET_ID;
    const saves = {};
    saves[slot] = {
      ...old,
      version: 2,
      spriteSet: slot,
      ts: old.ts || Date.now(),
    };
    saveAllSaves(saves);
  } catch (e) {}
}

function readBestScores() {
  try {
    const raw = localStorage.getItem(BEST_SCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveBestScores(scores) {
  try {
    localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores || {}));
    return true;
  } catch (e) {
    return false;
  }
}

function getBestScoreKey() {
  return isQuickGame ? "quick" : `set:${currentSpriteSetId || DEFAULT_SPRITE_SET_ID}`;
}

function updateAndGetBestScore(latestScore) {
  const key = getBestScoreKey();
  const scores = readBestScores();
  const prev = Number(scores[key] || 0);
  const next = Math.max(prev, Number(latestScore || 0));
  if (next !== prev) {
    scores[key] = next;
    saveBestScores(scores);
  }
  return next;
}

function isUsableSave(save) {
  if (!save) return false;
  // Normal saves contain a serialized board. Fresh-level checkpoints are saved
  // just after a level is completed; they intentionally generate a fresh board
  // when continued so quitting/restarting the new level does not repeat the same
  // tile placement.
  if (!save.board && !save.freshLevelCheckpoint) return false;
  const savedTime = Number(save.timeLeft);
  if (!Number.isFinite(savedTime) || savedTime <= 1) return false;
  return true;
}

function getLatestSavedSetId() {
  const saves = loadAllSaves();
  let latestId = null,
    latestTs = -1;
  Object.keys(SPRITE_SETS).forEach((id) => {
    const s = saves[id];
    if (isUsableSave(s) && s.ts && s.ts > latestTs) {
      latestTs = s.ts;
      latestId = id;
    }
  });
  return latestId;
}

function determineInitialSpriteSet() {
  migrateLegacySave();
  const latest = getLatestSavedSetId();
  if (latest) return latest;
  const stored = localStorage.getItem(SPRITE_SET_KEY) || DEFAULT_SPRITE_SET_ID;
  return SPRITE_SETS[stored] ? stored : DEFAULT_SPRITE_SET_ID;
}

function getSaveForSet(setId = currentSpriteSetId) {
  const saves = loadAllSaves();
  const save = saves[setId];
  return isUsableSave(save) ? save : null;
}

function saveGame(options = {}) {
  if (isQuickGame) return false;
  const saveMode = typeof options === "object" ? options : {};
  const slot = SPRITE_SETS[currentSaveSlotId]
    ? currentSaveSlotId
    : currentSpriteSetId;
  const save = {
    version: 2,
    ts: Date.now(),
    level,
    score: totalFromBestLevelScores(bestLevelScores),
    levelScore: 0,
    timeLeft,
    levelTotalTime,
    hintCount,
    shuffleCount,
    comboCount: 0,
    lastMatchAt: 0,
    bestCombo: 0,
    usedHintLvl: 0,
    usedShuffLvl: 0,
    strategyId: currentStrategy.id,
    theme: currentTheme,
    spriteSet: slot,
    board: saveMode.freshLevelCheckpoint ? null : null,
    scoreHistory,
    bestLevelScores,
    freshLevelCheckpoint: true,
    latestUnlockedLevel: level,
  };
  const saves = loadAllSaves();
  saves[slot] = save;
  return saveAllSaves(saves);
}

function loadSave(setId = currentSpriteSetId) {
  return getSaveForSet(setId);
}

function deleteSave(setId = currentSpriteSetId) {
  const saves = loadAllSaves();
  delete saves[setId];
  saveAllSaves(saves);
}

function formatSaveDate(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

function refreshSpriteSavePills() {
  const saves = loadAllSaves();
  document.querySelectorAll(".sprite-option").forEach((el) => {
    const id = el.dataset.set;
    const pill = el.querySelector(".sprite-save-pill");
    const save = isUsableSave(saves[id]) ? saves[id] : null;
    if (!pill) return;
    if (save) {
      pill.textContent = `LV ${String(save.level).padStart(2, "0")}`;
      pill.classList.remove("new");
      pill.classList.add("saved");
    } else {
      pill.textContent = "NEW";
      pill.classList.remove("saved");
      pill.classList.add("new");
    }
  });
}

function refreshSaveSlot() {
  const save = loadSave(currentSpriteSetId);
  const slot = $("savedSlot");
  const resumeBtn = $("continueFromSaveBtn");
  const deleteBtn = $("deleteSaveBtn");
  const setName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags)
    .name;
  refreshSpriteSavePills();
  if (!save) {
    if (slot) slot.classList.remove("hidden");
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.classList.add("disabled");
    }
    if (deleteBtn) deleteBtn.classList.add("hidden");
    $("saveLevel").textContent = `${setName}`;
    $("saveScore").textContent = "No saved game";
    $("saveDate").textContent = "—";
    return;
  }
  if (slot) slot.classList.remove("hidden");
  if (resumeBtn) {
    resumeBtn.disabled = false;
    resumeBtn.classList.remove("disabled");
  }
  if (deleteBtn) deleteBtn.classList.remove("hidden");
  $("saveLevel").textContent =
    `${setName} · LV ${String(save.level).padStart(2, "0")}`;
  $("saveScore").textContent = `${formatScore(save.score)} pts`;
  $("saveDate").textContent = formatSaveDate(save.ts);
}

function refreshStartScreen() {
  refreshSaveSlot();
}

function returnToTitleAfterSave() {
  gameStarted = false;
  paused = false;
  clearInterval(timerId);
  bgm.pause();
  bgm.currentTime = 0;
  pauseOverlay.classList.add("hidden");
  levelCompleteOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  $("endQuickConfirmOverlay")?.classList.add("hidden");
  $("quitConfirmOverlay")?.classList.add("hidden");
  $("helperMessageOverlay")?.classList.add("hidden");
  appShell.classList.remove("paused");
  document.body.classList.remove("low-time");
  overlay.classList.remove("hidden");
  refreshSaveSlot();
}

function triggerSave(fromPause = false) {
  const ok = saveGame();
  sfx.save();
  saveOverlayAction = fromPause ? "quit" : "continue";
  saveOverlay.dataset.action = saveOverlayAction;
  $("saveMsg").textContent = isQuickGame
    ? "Quick Game is a single-session mode and does not save progress."
    : ok
      ? `Progress saved for ${(SPRITE_SETS[currentSaveSlotId] || SPRITE_SETS[currentSpriteSetId]).name}.`
      : "Save failed — localStorage may be unavailable.";
  pauseOverlay.classList.add("hidden");
  saveOverlay.classList.remove("hidden");
  gameOverOverlay.classList.add("hidden");
  $("themePicker").classList.add("hidden");
}

function restoreGame(save) {
  // Keep the currently selected theme when continuing a saved game.
  // Saved games still restore the sprite set/progress, but should not override
  // the player's current theme choice from the startup screen.
  // applyTheme(save.theme || "arcade");
  applySpriteSet(save.spriteSet || DEFAULT_SPRITE_SET_ID);
  currentSaveSlotId = save.spriteSet || currentSpriteSetId;
  isQuickGame = false;
  level = save.level;
  score = save.score;
  levelScore = save.levelScore || 0;
  levelTotalTime = save.levelTotalTime || getLevelTime(level);
  timeLeft = Math.min(save.timeLeft, levelTotalTime);
  hintCount = Number.isFinite(save.hintCount) ? save.hintCount : HINTS;
  shuffleCount = Number.isFinite(save.shuffleCount)
    ? save.shuffleCount
    : SHUFFLES;
  comboCount = save.comboCount || 0;
  lastMatchAt = save.lastMatchAt || 0;
  bestCombo = save.bestCombo || 0;
  usedHintLvl = save.usedHintLvl || 0;
  usedShuffLvl = save.usedShuffLvl || 0;
  scoreHistory = Array.isArray(save.scoreHistory) ? save.scoreHistory : [];
  bestLevelScores = save.bestLevelScores && typeof save.bestLevelScores === "object" ? save.bestLevelScores : {};
  score = totalFromBestLevelScores(bestLevelScores);
  currentStrategy =
    STRATEGIES.find((s) => s.id === save.strategyId) || STRATEGIES[0];
  if (save.freshLevelCheckpoint || !save.board) {
    createBoard();
  } else {
    board = deserializeBoard(save.board);
  }

  // Sync HUD
  levelEl.textContent = String(level).padStart(2, "0");
  setScoreDisplay();
  updateHelperDisplay();
  updateRuleTag();
  updateTimer();
  renderBoard();
}

// ─────────────────────────────────────────────
//  BOARD CREATION & RENDER
// ─────────────────────────────────────────────
// Fresh board randomization helpers.
// Board generation should never depend only on sprite set + level number.
// Every newly created board uses fresh entropy; saved games still restore the
// serialized board directly through restoreGame(), bypassing createBoard().
const RECENT_BOARD_SIGNATURE_KEY = "pocketmatch_recent_board_sig_v1";

function randomUnit() {
  try {
    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
  } catch (e) {}

  // Fallback still mixes time and performance jitter so a new board created
  // immediately after page load does not reuse a predictable first sequence.
  const t = Date.now() % 1000000;
  const p = typeof performance !== "undefined" ? performance.now() % 1000000 : 0;
  return (Math.random() + ((t + p) % 997) / 997) % 1;
}

function randomIndex(maxExclusive) {
  return Math.floor(randomUnit() * maxExclusive);
}

function shuf(a) {
  for (let i = a.length - 1; i > 0; i--) {
    let j = randomIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function boardSignatureFromValues(values) {
  return values.map((entity) => entity && entity.id ? entity.id : "?").join("|");
}

function recentBoardSignatureKey() {
  return `${currentSpriteSetId || DEFAULT_SPRITE_SET_ID}|${level || 1}`;
}

function readRecentBoardSignatures() {
  try {
    const raw = sessionStorage.getItem(RECENT_BOARD_SIGNATURE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function rememberRecentBoardSignature(signature) {
  try {
    const recent = readRecentBoardSignatures();
    recent[recentBoardSignatureKey()] = signature;
    sessionStorage.setItem(RECENT_BOARD_SIGNATURE_KEY, JSON.stringify(recent));
  } catch (e) {}
}

function getRecentBoardSignature() {
  return readRecentBoardSignatures()[recentBoardSignatureKey()] || null;
}

function buildRandomPairPool(sourceEntities, pairCount) {
  const pool = [];
  let bag = [];

  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return pool;
  }

  while (pool.length < pairCount) {
    // Refill with a newly shuffled full set so every character gets a fair turn.
    // If extra pairs are needed after complete rounds, the extra characters are random,
    // not always the first items in the sprite list.
    if (bag.length === 0) {
      bag = shuf([...sourceEntities]);
    }

    pool.push(bag.pop());
  }

  return pool;
}

function createBoard() {
  const pairCount = (ROWS * COLS) / 2;
  const previousSignature = getRecentBoardSignature();
  let values = [];
  let signature = "";
  const uniqueLimit = isQuickGame ? Math.min(48, entities.length) : Math.min(getUniqueFlagCountForLevel(level), entities.length);

  // Retry a few times if the exact same board somehow appears for the same
  // sprite set + level in the current session. This is mostly a guard; with
  // crypto randomness the repeat chance is already extremely small.
  for (let attempt = 0; attempt < 8; attempt++) {
    const levelEntities = shuf([...entities]).slice(0, uniqueLimit);
    const selectedPairs = buildRandomPairPool(levelEntities, pairCount);
    values = [];

    selectedPairs.forEach((entity) => {
      values.push(entity, entity);
    });

    shuf(values);
    signature = boardSignatureFromValues(values);
    if (!previousSignature || signature !== previousSignature) break;
  }

  rememberRecentBoardSignature(signature);
  board = [];
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    let row = [];
    for (let c = 0; c < COLS; c++)
      row.push({ entity: values[k++], removed: false });
    board.push(row);
  }
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let t = document.createElement("div");
      t.className = "tile";
      t.dataset.r = r;
      t.dataset.c = c;
      if (board[r][c].removed) {
        t.classList.add("removed");
      } else {
        let e = board[r][c].entity,
          i = document.createElement("img");
        i.className = "entity-sprite";
        i.title = e.name;
        i.alt = e.name;
        i.src = e.img;
        i.loading = "eager";
        i.draggable = false;
        i.style.setProperty("--sprite-scale", e.scale);
        t.appendChild(i);
      }
      let tilePressLock = 0;
      const handleTilePress = (ev) => {
        unlockAudio();
        if (ev && ev.cancelable) ev.preventDefault();

        // iOS can fire pointerup + touchend + synthetic click for one tap.
        // Without this guard, the same tile is processed twice, so the first
        // tap selects then instantly clears itself.
        const now = Date.now();
        if (now - tilePressLock < 260) return;
        tilePressLock = now;

        clickTile(r, c, t);
      };

      if (window.PointerEvent) {
        t.addEventListener("pointerup", handleTilePress, { passive: false });
      } else {
        t.addEventListener("touchend", handleTilePress, { passive: false });
        t.addEventListener("mouseup", handleTilePress, { passive: false });
      }

      t.onclick = (ev) => {
        // Desktop fallback only. Touch/pointer devices are handled above.
        if (window.PointerEvent || (ev && ev.detail === 0)) return;
        handleTilePress(ev);
      };
      boardEl.appendChild(t);
    }
  updateBoardInfo();
  setTimeout(resizeCanvas, 50);

  // Desktop-only: board contents are rebuilt after starting/advancing/retrying levels.
  // Re-run the best-fit guard after the new tile images and final layout settle,
  // so a full-size desktop window opens at the same safe size as after a manual resize.
  if (window.__pmScheduleDesktopFit) {
    window.__pmScheduleDesktopFit();
    setTimeout(window.__pmScheduleDesktopFit, 80);
    setTimeout(window.__pmScheduleDesktopFit, 240);
  }
}

let pathPadX = 0,
  pathPadY = 0;
function resizeCanvas() {
  // Expand the connection-line canvas around the tile grid so border routes
  // (above, below, left, right of the grid) remain fully visible on every device.
  const rect = boardEl.getBoundingClientRect();
  const wrap = document.querySelector(".board-wrap").getBoundingClientRect();
  const tw = rect.width / COLS,
    th = rect.height / ROWS;
  pathPadX = Math.max(10, tw * 0.62);
  pathPadY = Math.max(18, th * 0.88);
  canvas.width = Math.ceil(rect.width + pathPadX * 2);
  canvas.height = Math.ceil(rect.height + pathPadY * 2);
  canvas.style.width = canvas.width + "px";
  canvas.style.height = canvas.height + "px";
  canvas.style.left = rect.left - wrap.left - pathPadX + "px";
  canvas.style.top = rect.top - wrap.top - pathPadY + "px";
}
window.onresize = resizeCanvas;

// ─────────────────────────────────────────────
//  PATH LOGIC
// ─────────────────────────────────────────────
function empty(r, c) {
  return r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c].removed;
}
function straight(a, b) {
  if (a.r === b.r) {
    for (let c = Math.min(a.c, b.c) + 1; c < Math.max(a.c, b.c); c++)
      if (!empty(a.r, c)) return false;
    return true;
  }
  if (a.c === b.c) {
    for (let r = Math.min(a.r, b.r) + 1; r < Math.max(a.r, b.r); r++)
      if (!empty(r, a.c)) return false;
    return true;
  }
  return false;
}
function routeDistance(points) {
  let d = 0;
  for (let i = 0; i < points.length - 1; i++) {
    d +=
      Math.abs(points[i].r - points[i + 1].r) +
      Math.abs(points[i].c - points[i + 1].c);
  }
  return d;
}
function routeOutsidePenalty(points) {
  return points.reduce(
    (n, p) => n + (p.r < 0 || p.r >= ROWS || p.c < 0 || p.c >= COLS ? 1 : 0),
    0,
  );
}
function simplifyRoute(points) {
  const out = [];
  points.forEach((p) => {
    const last = out[out.length - 1];
    if (!last || last.r !== p.r || last.c !== p.c) out.push(p);
  });
  return out;
}
function pickShortestRoute(routes) {
  if (!routes.length) return null;
  routes.sort((a, b) => {
    const da = routeDistance(a),
      db = routeDistance(b);
    if (da !== db) return da - db;
    const oa = routeOutsidePenalty(a),
      ob = routeOutsidePenalty(b);
    if (oa !== ob) return oa - ob;
    return a.length - b.length;
  });
  return simplifyRoute(routes[0]);
}
function path(a, b) {
  const A = { r: a.r, c: a.c },
    B = { r: b.r, c: b.c };
  const routes = [];

  if (straight(A, B)) routes.push([A, B]);

  const p1 = { r: A.r, c: B.c };
  if (empty(p1.r, p1.c) && straight(A, p1) && straight(p1, B))
    routes.push([A, p1, B]);

  const p2 = { r: B.r, c: A.c };
  if (empty(p2.r, p2.c) && straight(A, p2) && straight(p2, B))
    routes.push([A, p2, B]);

  // Allow two-turn routing through empty internal lanes first, and through
  // one-cell border lanes only when they produce the shortest valid path.
  // This avoids sending mid-board matches all the way to the outer frame when
  // a shorter valid route is available just above/below/beside the matched tiles.
  for (let r = -1; r <= ROWS; r++) {
    const pa = { r, c: A.c },
      pb = { r, c: B.c };
    if (
      empty(pa.r, pa.c) &&
      empty(pb.r, pb.c) &&
      straight(A, pa) &&
      straight(pa, pb) &&
      straight(pb, B)
    )
      routes.push([A, pa, pb, B]);
  }
  for (let c = -1; c <= COLS; c++) {
    const pa = { r: A.r, c },
      pb = { r: B.r, c };
    if (
      empty(pa.r, pa.c) &&
      empty(pb.r, pb.c) &&
      straight(A, pa) &&
      straight(pa, pb) &&
      straight(pb, B)
    )
      routes.push([A, pa, pb, B]);
  }

  return pickShortestRoute(routes);
}
function tileEl(r, c) {
  return boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
}
function clearSel() {
  document
    .querySelectorAll(".tile.selected")
    .forEach((t) => t.classList.remove("selected"));
  selected = null;
}

// ─────────────────────────────────────────────
//  SCORING HELPERS
// ─────────────────────────────────────────────
function comboPts() {
  const combo = Math.max(1, Number(comboCount) || 1);
  return combo <= COMBO_POINTS.length ? COMBO_POINTS[combo - 1] : combo * 100;
}

function showCombo(text) {
  const layer = $("comboLayer");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "combo-pop";
  el.textContent = text;

  // v3.0.8.1: Position combo text relative to the tile board instead of
  // letting the fixed-position element fall back to the lower-left of the screen.
  const rect = boardEl ? boardEl.getBoundingClientRect() : null;
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height * 0.24 : window.innerHeight * 0.34;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}


function matchFeedbackColors() {
  const s = getComputedStyle(document.documentElement);
  return [
    s.getPropertyValue("--accent").trim() || "#7c5cff",
    s.getPropertyValue("--accent-2").trim() || "#ff6fb5",
    s.getPropertyValue("--accent-3").trim() || "#5cc8ff",
  ];
}

function spawnMatchRing(x, y, isCombo = false) {
  const layer = $("comboLayer");
  if (!layer) return;
  const ring = document.createElement("span");
  ring.className = `match-ring${isCombo ? " match-ring--combo" : ""}`;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  layer.appendChild(ring);
  setTimeout(() => ring.remove(), isCombo ? 760 : 600);
}

function spawnMatchParticles(x, y, isCombo = false, boost = 0) {
  const layer = $("comboLayer");
  if (!layer) return;
  const colors = matchFeedbackColors();
  const count = Math.min(14, (isCombo ? 9 : 6) + Math.max(0, boost));
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = `match-particle${isCombo ? " match-particle--combo" : ""}`;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.42;
    const distance = (isCombo ? 44 : 32) + Math.random() * (isCombo ? 28 : 18);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - (isCombo ? 20 : 12);
    const size = (isCombo ? 6 : 5) + Math.random() * 4;
    const duration = (isCombo ? 620 : 460) + Math.random() * 180;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.82)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.12)", opacity: 0.96, offset: 0.16 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.28)`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.22, 0.7, 0.36, 1)" },
    );
    layer.appendChild(p);
    setTimeout(() => p.remove(), duration + 40);
  }
}

function spawnScoreFly(x, y, text, isCombo) {
  const layer = $("comboLayer");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = `score-fly${isCombo ? " score-fly--combo" : ""}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), isCombo ? 1060 : 900);
}

function pulseTileImpact(el, isCombo = false) {
  if (!el) return;
  el.classList.remove("tile-impact", "tile-impact-combo");
  void el.offsetWidth;
  el.classList.add(isCombo ? "tile-impact-combo" : "tile-impact");
  setTimeout(() => el.classList.remove("tile-impact", "tile-impact-combo"), isCombo ? 620 : 460);
}

function showInvalidFeedback(...tiles) {
  tiles.filter(Boolean).forEach((tile) => {
    tile.classList.remove("tile-invalid");
    void tile.offsetWidth;
    tile.classList.add("tile-invalid");
    setTimeout(() => tile.classList.remove("tile-invalid"), 360);
  });
}

function showMatchFeedback(a, b, pts, isCombo) {
  const aEl = tileEl(a.r, a.c);
  const bEl = tileEl(b.r, b.c);
  if (!aEl || !bEl) return;
  const ar = aEl.getBoundingClientRect();
  const br = bEl.getBoundingClientRect();
  const boost = isCombo ? Math.min(5, Math.max(0, comboCount - 2)) : 0;
  const points = [
    { x: ar.left + ar.width / 2, y: ar.top + ar.height / 2 },
    { x: br.left + br.width / 2, y: br.top + br.height / 2 },
  ];
  pulseTileImpact(aEl, isCombo);
  pulseTileImpact(bEl, isCombo);
  points.forEach((pt) => {
    spawnMatchRing(pt.x, pt.y, isCombo);
    spawnMatchParticles(pt.x, pt.y, isCombo, boost);
  });
  spawnScoreFly(
    (points[0].x + points[1].x) / 2,
    (points[0].y + points[1].y) / 2 - 10,
    `+${formatScore(pts)}`,
    isCombo,
  );
}

function showLevelClearBurst() {
  const layer = $("comboLayer");
  if (!layer || !boardEl) return;
  const rect = boardEl.getBoundingClientRect();
  const spots = [
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.28 },
    { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.22 },
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.28 },
    { x: rect.left + rect.width * 0.38, y: rect.top + rect.height * 0.62 },
    { x: rect.left + rect.width * 0.62, y: rect.top + rect.height * 0.62 },
  ];
  spots.forEach((spot, i) => setTimeout(() => {
    spawnMatchRing(spot.x, spot.y, true);
    spawnMatchParticles(spot.x, spot.y, true, 4);
  }, i * 80));
}

function resetLevelScoring() {
  comboCount = 0;
  lastMatchAt = 0;
  bestCombo = 0;
  usedHintLvl = 0;
  usedShuffLvl = 0;
}

// ─────────────────────────────────────────────
//  CLICK HANDLER
// ─────────────────────────────────────────────
function clickTile(r, c, el) {
  if (paused || !gameStarted) return;
  if (board[r][c].removed) return;
  unlockAudio();
  if (!selected) {
    selected = { r, c, el };
    el.classList.add("selected");
    sfx.select();
    moveStatus.textContent = board[r][c].entity.name.toUpperCase();
    return;
  }
  if (selected.r === r && selected.c === c) {
    clearSel();
    sfx.select();
    moveStatus.textContent = "SELECTION CLEARED";
    return;
  }
  let a = selected,
    b = { r, c, el };
  if (board[a.r][a.c].entity.id === board[b.r][b.c].entity.id) {
    let p = path(a, b);
    if (p) {
      drawPath(p);
      sfx.match();
      tileEl(a.r, a.c)?.classList.add("matched");
      tileEl(b.r, b.c)?.classList.add("matched");
      board[a.r][a.c].removed = board[b.r][b.c].removed = true;
      const now = Date.now();
      comboCount =
        lastMatchAt && now - lastMatchAt <= COMBO_WINDOW_MS
          ? comboCount + 1
          : 1;
      lastMatchAt = now;
      bestCombo = Math.max(bestCombo, comboCount);
      const pts = comboPts();
      const isComboMatch = comboCount > 1;
      if (isQuickGame) score += pts;
      levelScore += pts;
      setScoreDisplay();
      showMatchFeedback(a, b, pts, isComboMatch);
      moveStatus.textContent =
        isComboMatch
          ? `COMBO x${comboCount}  +${formatScore(pts)}`
          : `MATCH  +${formatScore(pts)}`;
      if (isComboMatch)
        showCombo(`COMBO x${comboCount}  +${formatScore(pts)}`);
      setTimeout(() => {
        clearPath();
        applyMovement(currentStrategy);
        renderBoard();
        if (board.flat().every((t) => t.removed)) {
          sfx.level();
          showLevelComplete();
        } else if (!findMove()) {
          updateBoardInfo();
          moveStatus.textContent = "NO MATCHES // AUTO SHUFFLE";
          setTimeout(() => shuffleTiles(false), 500);
        }
      }, 430);
    } else {
      moveStatus.textContent = "PATH BLOCKED";
      showInvalidFeedback(a.el, b.el);
      sfx.invalid();
    }
  } else {
    moveStatus.textContent = "DIFFERENT TILES";
    showInvalidFeedback(a.el, b.el);
    sfx.invalid();
  }
  clearSel();
}

// ─────────────────────────────────────────────
//  DRAW PATH — clipped to canvas bounds
//  so lines that route via r=-1/c=-1 ghost
//  cells don't bleed outside the board frame
// ─────────────────────────────────────────────
function cellSize() {
  const rect = boardEl.getBoundingClientRect();
  return { w: rect.width / COLS, h: rect.height / ROWS };
}

function center(p) {
  const { w, h } = cellSize();
  const gridW = w * COLS,
    gridH = h * ROWS;
  let x, y;
  if (p.c < 0) x = pathPadX * 0.42;
  else if (p.c >= COLS) x = pathPadX + gridW + pathPadX * 0.58;
  else x = pathPadX + (p.c + 0.5) * w;

  // Border-route lanes: keep top/bottom outside paths close to the tile grid
  // so players can see the complete path without it being hidden by the frame.
  const laneGap = Math.max(8, Math.min(14, h * 0.18));
  if (p.r < 0) y = Math.max(5, pathPadY - laneGap);
  else if (p.r >= ROWS)
    y = Math.min(canvas.height - 5, pathPadY + gridH + laneGap);
  else y = pathPadY + (p.r + 0.5) * h;
  return { x, y };
}

function drawPixelLine(points, color, width, shadow) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowBlur = shadow;
  ctx.shadowColor = color;
  ctx.beginPath();
  points.forEach((q, i) => {
    const cp = center(q);
    const x = Math.round(cp.x) + 0.5,
      y = Math.round(cp.y) + 0.5;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPath(p) {
  const col = pathColors();
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPixelLine(p, col.halo, 13, 24);
  drawPixelLine(p, col.line, 7, 18);
  drawPixelLine(p, col.core, 2, 5);
  ctx.save();
  ctx.fillStyle = col.core;
  ctx.shadowColor = col.line;
  ctx.shadowBlur = 12;
  p.forEach((q) => {
    const cp = center(q);
    ctx.fillRect(Math.round(cp.x) - 3, Math.round(cp.y) - 3, 6, 6);
  });
  for (let i = 0; i < p.length - 1; i++) {
    let a = center(p[i]),
      b = center(p[i + 1]);
    let steps = Math.max(2, Math.floor(Math.hypot(a.x - b.x, a.y - b.y) / 58));
    for (let k = 1; k < steps; k++) {
      let t = k / steps,
        x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }
  }
  ctx.restore();
}

function clearPath() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ─────────────────────────────────────────────
//  TIMER
// ─────────────────────────────────────────────

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

function updateTimer() {
  let m = String(Math.floor(timeLeft / 60)).padStart(2, "0"),
    s = String(timeLeft % 60).padStart(2, "0");
  timerText.textContent = `${m}:${s}`;
  const pct = Math.max(0, (timeLeft / levelTotalTime) * 100);
  if (timerBar) timerBar.style.width = `${pct}%`;
  if (boardTimerBar) boardTimerBar.style.width = `${pct}%`;
  document.body.classList.toggle(
    "low-time",
    timeLeft <= 60 && gameStarted && !paused,
  );
  if (timeLeft === 60 && !timerWarned) {
    timerWarned = true;
    sfx.warn();
    moveStatus.textContent = "ONE MINUTE LEFT";
  }
}
function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateTimer();
    if (timeLeft <= 0) {
      showGameOver();
    }
  }, 1000);
}

function showGameOver() {
  clearInterval(timerId);
  clearSel();
  clearPath();
  paused = true;
  gameStarted = false;
  const elapsed = Math.max(0, levelTotalTime - timeLeft);
  timeLeft = 0;
  updateTimer();
  document.body.classList.remove("low-time");
  appShell.classList.remove("paused");
  pauseOverlay.classList.add("hidden");
  levelCompleteOverlay.classList.add("hidden");
  saveOverlay.classList.add("hidden");
  $("themePicker").classList.add("hidden");

  const rule = currentStrategy ? currentStrategy.name : "NORMAL";
  const activeSetName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags).name;
  const modeLabel = isQuickGame ? "QUICK PLAY" : String(rule).toUpperCase();
  const bestScore = isQuickGame ? score : updateAndGetBestScore(score);

  const goKicker = $("goKicker");
  if (goKicker) goKicker.textContent = isQuickGame ? "QUICK RUN ENDED" : "TIME LIMIT REACHED";
  const goTitle = $("goTitle");
  if (goTitle) goTitle.innerHTML = "Game<br /><em>Over</em>";
  const goHeroTag = $("goHeroTag");
  if (goHeroTag) goHeroTag.textContent = bestScore >= score ? "HIGH SCORE SAVED" : "RUN COMPLETE";
  const goLevelBadge = $("goLevelBadge");
  if (goLevelBadge) goLevelBadge.textContent = `LV ${String(level).padStart(2, "0")}`;
  const goSummary = $("goSummary");
  if (goSummary) {
    goSummary.textContent = `${modeLabel} · ${String(activeSetName).toUpperCase()}`;
  }
  const goLevel = $("goLevel");
  if (goLevel) goLevel.textContent = `LV ${String(level).padStart(2, "0")}`;
  const goScore = $("goScore");
  if (goScore) goScore.innerHTML = `${formatScore(score)}<span class="pause-unit">PTS</span>`;
  const goBestScore = $("goBestScore");
  if (goBestScore) goBestScore.textContent = `${formatScore(bestScore)} pts`;
  const goBestCombo = $("goBestCombo");
  if (goBestCombo) goBestCombo.textContent = bestCombo > 1 ? `×${bestCombo}` : "—";
  const goPack = $("goPack");
  if (goPack) goPack.textContent = `Tile Pack · ${activeSetName}`;
  const goTimeSurvived = $("goTimeSurvived");
  if (goTimeSurvived) goTimeSurvived.textContent = formatTime(elapsed);
  const goMsg = $("goMessage");
  if (goMsg) {
    goMsg.textContent = isQuickGame
      ? "The clock ran out. Start a new Quick Game run or head back to the start screen."
      : "The clock ran out. Start a new run or head back to the start screen — your best score is safe.";
  }
  const goNew = $("gameOverNewGameBtn");
  if (goNew) goNew.textContent = isQuickGame ? "New Quick Game" : "New Game";
  const goQuit = $("gameOverQuitBtn");
  if (goQuit) goQuit.textContent = "Back to Start";
  moveStatus.textContent = "GAME OVER";
  playUiAudio("gameOver");
  gameOverOverlay.classList.remove("hidden");
}

// ─────────────────────────────────────────────
//  FIND MOVE / HINT / SHUFFLE
// ─────────────────────────────────────────────
function findMove() {
  for (let r1 = 0; r1 < ROWS; r1++)
    for (let c1 = 0; c1 < COLS; c1++) {
      if (board[r1][c1].removed) continue;
      for (let r2 = 0; r2 < ROWS; r2++)
        for (let c2 = 0; c2 < COLS; c2++) {
          if ((r1 === r2 && c1 === c2) || board[r2][c2].removed) continue;
          if (
            board[r1][c1].entity.id === board[r2][c2].entity.id &&
            path({ r: r1, c: c1 }, { r: r2, c: c2 })
          )
            return [
              { r: r1, c: c1 },
              { r: r2, c: c2 },
            ];
        }
    }
  return null;
}

function countConnectablePairs() {
  let cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].removed) cells.push({ r, c, id: board[r][c].entity.id });
    }
  let count = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[i].id === cells[j].id && path(cells[i], cells[j])) count++;
    }
  }
  return count;
}

function updateBoardInfo() {
  const topMatch = document.getElementById("iphoneTopMatches");
  if (!board || !board.length) {
    if (boardInfoEl) boardInfoEl.textContent = "MATCHES: --";
    const pill = document.getElementById("iphoneMatchesCount");
    if (pill) pill.textContent = "--";
    if (topMatch) topMatch.textContent = "--";
    return;
  }
  const n = countConnectablePairs();
  const matchText = `MATCHES: ${String(n).padStart(2, "0")}`;
  const setName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags).name;
  if (boardInfoEl) {
    boardInfoEl.textContent = `${matchText}  ·  SET: ${setName}`;
  }
  // Keep iPhone topbar match count in sync. The iPhone layout shows this
  // in place of the game title and intentionally omits the set name.
  const pill = document.getElementById("iphoneMatchesCount");
  if (pill) pill.textContent = String(n).padStart(2, "0");
  if (topMatch) topMatch.textContent = String(n).padStart(2, "0");
}

function showHelperMessage(kind, message) {
  const ov = $("helperMessageOverlay");
  if (!ov) {
    moveStatus.textContent = message;
    sfx.invalid();
    return;
  }
  $("helperMessageKicker").textContent = "HELPER UNAVAILABLE";
  $("helperMessageTitle").textContent = kind;
  $("helperMessageText").textContent = message;
  ov.classList.remove("hidden");
  sfx.invalid();
}

function hint() {
  if (paused || !gameStarted) return;
  if (hintCount <= 0) {
    showHelperMessage(
      "No Hints Left",
      "You have no hints available for this run.",
    );
    return;
  }
  let m = findMove();
  if (!m) {
    showHelperMessage(
      "No Link Found",
      "There is no available link right now. Try shuffling the board.",
    );
    return;
  }
  hintCount--;
  usedHintLvl++;
  updateHelperDisplay();
  if (!isQuickGame) saveGame({ inventoryOnly: true });
  document
    .querySelectorAll(".tile.hint")
    .forEach((t) => t.classList.remove("hint"));
  m.forEach((p) => tileEl(p.r, p.c)?.classList.add("hint"));
  sfx.hint();
  moveStatus.textContent = "FIND PULSE SENT";
  setTimeout(
    () =>
      document
        .querySelectorAll(".tile.hint")
        .forEach((t) => t.classList.remove("hint")),
    2400,
  );
}

function shuffleTiles(count = true) {
  if (paused || !gameStarted) return;
  if (count && shuffleCount <= 0) {
    showHelperMessage(
      "No Shuffles Left",
      "You have no shuffles available for this run.",
    );
    return;
  }
  let rem = [];
  board.flat().forEach((t) => {
    if (!t.removed) rem.push(t.entity);
  });
  // Try a few reshuffles so the board comes back with at least one connectable pair.
  for (let attempt = 0; attempt < 12; attempt++) {
    shuf(rem);
    let k = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!board[r][c].removed) board[r][c].entity = rem[k++];
    if (findMove()) break;
  }
  if (count) {
    shuffleCount--;
    usedShuffLvl++;
    comboCount = 0;
    lastMatchAt = 0;
    updateHelperDisplay();
    if (!isQuickGame) saveGame({ inventoryOnly: true });
  }
  renderBoard();
  sfx.shuffle();
  moveStatus.textContent = "CARTRIDGE RESHUFFLED";
}


function formatHistoryTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function renderScoreHistory(latestLevel = null) {
  const tbody = $("scoreHistoryBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = Array.isArray(scoreHistory) ? scoreHistory : [];
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.level === latestLevel) tr.classList.add("latest");
    tr.innerHTML = `
      <td class="score-summary-level">${String(row.level).padStart(2, "0")}</td>
      <td class="score-summary-score">${formatScore(row.levelScore)}</td>
      <td class="score-summary-time">◴ ${formatHistoryTime(row.timeUsed)}</td>
    `;
    tbody.appendChild(tr);
  });
  requestAnimationFrame(() => {
    const scroller = $("scoreHistoryScroll");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
}

// ─────────────────────────────────────────────
//  LEVEL MANAGEMENT
// ─────────────────────────────────────────────
function updateRuleTag() {
  ruleTagEl.textContent = currentStrategy.name;
}

function showLevelComplete() {
  clearInterval(timerId);
  paused = true;
  nextLevelReadyAfterComplete = false;
  const clearedLevel = level;
  const nextLvl = level + 1;
  const nextStrat = getStrategy(nextLvl);
  const matchComboScore = levelScore;
  const timeBonus = timeLeft * TIME_BONUS_PER_SECOND;
  const perfect = usedHintLvl === 0 && usedShuffLvl === 0 ? PERFECT_BONUS : 0;
  const clearSeconds = Math.max(0, levelTotalTime - timeLeft);
  const completedLevelScore = matchComboScore + timeBonus + perfect;

  if (isQuickGame) {
    score = completedLevelScore;
  } else {
    bestLevelScores[clearedLevel] = Math.max(Number(bestLevelScores[clearedLevel] || 0), completedLevelScore);
    score = totalFromBestLevelScores(bestLevelScores);
  }
  levelScore = completedLevelScore;
  setScoreDisplay();

  const nextSetName = isQuickGame
    ? "Random tile set"
    : (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags).name;

  scoreHistory.push({
    level: clearedLevel,
    levelScore: completedLevelScore,
    matchComboScore,
    timeBonus,
    perfectBonus: perfect,
    timeUsed: clearSeconds,
    totalScoreAfterLevel: score,
    bestCombo,
    hintsUsed: usedHintLvl,
    shufflesUsed: usedShuffLvl,
    rule: currentStrategy ? currentStrategy.name : "Normal",
    tileSet: nextSetName,
    completedAt: Date.now(),
  });

  const lcLevelScore = $("lcLevelScore");
  if (lcLevelScore) lcLevelScore.textContent = formatScore(completedLevelScore);
  const lcTotalScore = $("lcTotalScore");
  if (lcTotalScore) lcTotalScore.textContent = formatScore(score);
  const lcBestCombo = $("lcBestCombo");
  if (lcBestCombo) lcBestCombo.textContent = bestCombo > 1 ? `x${bestCombo}` : "—";
  renderScoreHistory(clearedLevel);

  showLevelClearBurst();
  playUiAudio("levelComplete");

  if (!isQuickGame) {
    prepareNextLevelState(perfect > 0);
    saveGame({ freshLevelCheckpoint: true });
    refreshSpriteSavePills();
    nextLevelReadyAfterComplete = true;
    moveStatus.textContent = `AUTO-SAVED  LV ${clearedLevel}`;
  }

  const nextBtn = $("nextLevelBtn");
  if (nextBtn) nextBtn.textContent = isQuickGame ? "» New Quick Game" : "» Next Level";
  const quitBtn = $("levelCompleteQuitBtn");
  if (quitBtn) quitBtn.textContent = isQuickGame ? "⌂ Home" : "⌂ Home";
  levelCompleteOverlay.classList.remove("hidden");
}

function prepareNextLevelState(perfectClear = false) {
  const clearedLevel = level;
  level++;
  levelScore = 0;
  setScoreDisplay();
  resetLevelScoring();
  refillHelpersAfterClearedLevel(clearedLevel, perfectClear);
  currentStrategy = isQuickGame ? STRATEGIES[0] : getStrategy(level);
  levelEl.textContent = String(level).padStart(2, "0");
  updateRuleTag();
  levelTotalTime = isQuickGame ? TOTAL_TIME : getLevelTime(level);
  timeLeft = levelTotalTime;
  timerWarned = false;
  updateHelperDisplay();
  updateTimer();
  createBoard();
  renderBoard();
}

function startNextLevel() {
  if (isQuickGame) {
    levelCompleteOverlay.classList.add("hidden");
    startQuickGame();
    return;
  }
  levelCompleteOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  $("endQuickConfirmOverlay")?.classList.add("hidden");
  $("quitConfirmOverlay")?.classList.add("hidden");
  $("helperMessageOverlay")?.classList.add("hidden");
  if (!nextLevelReadyAfterComplete) {
    prepareNextLevelState();
    if (!isQuickGame) {
      saveGame({ freshLevelCheckpoint: true });
      refreshSpriteSavePills();
    }
  }
  nextLevelReadyAfterComplete = false;
  paused = false;
  gameStarted = true;
  const setName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags)
    .name;
  moveStatus.textContent = isQuickGame
    ? `QUICK GAME · ${setName} · LV ${level}`
    : `LV ${level}  ·  ${currentStrategy.name}`;
  startTimer();
}

function levelCompleteQuit() {
  if (isQuickGame) {
    levelCompleteOverlay.classList.add("hidden");
    endQuickGame(true);
    return;
  }
  if (!nextLevelReadyAfterComplete) {
    prepareNextLevelState();
  }
  nextLevelReadyAfterComplete = false;
  saveGame({ freshLevelCheckpoint: true });
  sfx.save();
  returnToTitleAfterSave();
}

// ─────────────────────────────────────────────
//  GAME LIFECYCLE
// ─────────────────────────────────────────────
function startGame(options = {}) {
  const mode = typeof options === "object" ? options : {};
  const selectedSet = mode.randomSet
    ? randomSpriteSetId(null)
    : currentSpriteSetId;
  applySpriteSet(selectedSet);
  isQuickGame = !!mode.quick;
  currentSaveSlotId = isQuickGame ? null : selectedSet;
  nextLevelReadyAfterComplete = false;
  overlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  levelCompleteOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  $("themePicker").classList.add("hidden");
  appShell.classList.remove("paused");
  score = 0;
  levelScore = 0;
  scoreHistory = [];
  bestLevelScores = {};
  level = 1;
  resetLevelScoring();
  currentStrategy = STRATEGIES[0];
  levelTotalTime = isQuickGame ? TOTAL_TIME : getLevelTime(1);
  timeLeft = levelTotalTime;
  timerWarned = false;
  hintCount = HINTS;
  shuffleCount = SHUFFLES;
  paused = false;
  gameStarted = true;
  unlockAudio();
  sfx.level();
  playBgmIfAllowed();
  levelEl.textContent = "01";
  setScoreDisplay();
  updateHelperDisplay();
  updateRuleTag();
  updateTimer();
  createBoard();
  renderBoard();
  startTimer();
  moveStatus.textContent = isQuickGame
    ? `QUICK GAME · ${(SPRITE_SETS[selectedSet] || SPRITE_SETS.flags).name}`
    : "SYSTEM ONLINE";
}

function startNewGameFromTitle(force = false) {
  const existing = loadSave(currentSpriteSetId);
  if (existing && !force) {
    const setName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags)
      .name;
    $("newGameConfirmMsg").textContent =
      `Starting a new ${setName} game will delete its saved progress.`;
    $("newGameConfirmOverlay").classList.remove("hidden");
    return;
  }
  if (existing) deleteSave(currentSpriteSetId);
  refreshStartScreen();
  startGame({ quick: false });
}

function startQuickGame() {
  startGame({ quick: true, randomSet: false });
}

function continueFromSave() {
  const save = loadSave(currentSpriteSetId);
  if (!save) {
    deleteSave(currentSpriteSetId);
    refreshStartScreen();
    sfx.invalid();
    return;
  }
  overlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  $("themePicker").classList.add("hidden");
  appShell.classList.remove("paused");
  restoreGame(save);
  nextLevelReadyAfterComplete = false;
  timerWarned = false;
  paused = false;
  gameStarted = true;
  unlockAudio();
  sfx.level();
  playBgmIfAllowed();
  startTimer();
  moveStatus.textContent = `SAVE RESTORED  LV ${level}`;
}

function setupPauseModal() {
  const title = document.querySelector("#pauseOverlay h1");
  const msg = $("pauseMessage");
  const saveContinue = $("saveContinueBtn");
  const saveQuit = $("saveFromPauseBtn");
  const endQuick = $("endQuickGameBtn");
  const pauseActions = $("pauseActions");

  // v3.0.8: Pause menu is mode-specific.
  // Regular Game: Continue + Quit, with confirmation before quitting mid-level.
  // Quick Game: Continue + End Quick Game, with confirmation before ending.
  const setPauseBtnHidden = (btn, hidden) => {
    if (!btn) return;
    btn.classList.toggle("hidden", hidden);
    btn.hidden = hidden;
    btn.style.display = hidden ? "none" : "";
  };

  pauseOverlay.classList.toggle("quick-pause", isQuickGame);
  if (pauseActions) pauseActions.classList.toggle("quick-pause-actions", isQuickGame);
  if (saveQuit) saveQuit.textContent = "Quit";
  if (endQuick) endQuick.textContent = "End Quick Game";

  if (isQuickGame) {
    if (title) { title.innerHTML = "Quick<br /><em>Paused</em>"; }
    if (msg) msg.textContent = "Quick Game is single-session only. Continue the run or end it now.";
    setPauseBtnHidden(saveContinue, true);
    setPauseBtnHidden(saveQuit, true);
    setPauseBtnHidden(endQuick, false);
  } else {
    if (title) { title.innerHTML = "Take a<br /><em>break</em>"; }
    if (msg) msg.textContent = "The timer is stopped. If you quit now, this current level progress will not be saved.";
    setPauseBtnHidden(saveContinue, true);
    setPauseBtnHidden(saveQuit, false);
    setPauseBtnHidden(endQuick, true);
  }

  // Populate live panel fields
  const liveScoreEl = $("pauseLiveScore");
  if (liveScoreEl) liveScoreEl.innerHTML = score.toLocaleString() + '<span class="pause-unit">PTS</span>';

  // Elapsed time = levelTotalTime - timeLeft
  const elapsedSec = Math.max(0, levelTotalTime - timeLeft);
  const em = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const es = String(elapsedSec % 60).padStart(2, "0");
  const elapsedEl = $("pauseElapsed");
  if (elapsedEl) elapsedEl.textContent = `${em}:${es}`;

  // Level chip
  const badgeEl = $("pauseLevelBadge");
  if (badgeEl) badgeEl.textContent = `LV ${level}`;
  const nameEl = $("pauseLevelName");
  if (nameEl) {
    const setName = (SPRITE_SETS[currentSpriteSetId] || SPRITE_SETS.flags).name;
    const ruleName = currentStrategy ? currentStrategy.name || "Normal" : "Normal";
    nameEl.textContent = `${setName} · ${ruleName}`;
  }

  // Pairs remaining
  const pairsEl = $("pausePairsLeft");
  if (pairsEl && board && board.length) {
    let remaining = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r] && board[r][c] && !board[r][c].removed) remaining++;
    pairsEl.textContent = String(remaining / 2 | 0);
  }

  // Best combo
  const comboEl = $("pauseBestCombo");
  if (comboEl) comboEl.textContent = bestCombo > 0 ? `×${bestCombo}` : "—";

  // Hints left
  const hintsEl = $("pauseHintsLeft");
  if (hintsEl) hintsEl.textContent = String(hintCount);

  // Sync game sound toggle with actual mute state
  const soundToggle = $("pauseSoundToggle");
  if (soundToggle) soundToggle.setAttribute("aria-pressed", muted ? "false" : "true");
}

function saveAndContinue() {
  if (!gameStarted) return;
  const ok = saveGame();
  sfx.save();
  if (ok) {
    moveStatus.textContent = "GAME SAVED";
  }
  resumeGame();
}

function saveAndQuit() {
  if (!gameStarted) return;
  saveGame();
  sfx.save();
  returnToTitleAfterSave();
}

function confirmQuitGame() {
  if (!gameStarted) return;
  const ov = $("quitConfirmOverlay");
  if (ov) {
    ov.classList.remove("hidden");
    return;
  }
  quitCurrentGameWithoutSaving();
}

function quitCurrentGameWithoutSaving() {
  $("quitConfirmOverlay")?.classList.add("hidden");
  returnToTitleAfterSave();
}

function endQuickGame(skipConfirm = false) {
  if (!isQuickGame) {
    returnToTitleAfterSave();
    return;
  }
  if (!skipConfirm) {
    const ov = $("endQuickConfirmOverlay");
    if (ov) {
      ov.classList.remove("hidden");
      return;
    }
  }
  gameStarted = false;
  paused = false;
  clearInterval(timerId);
  bgm.pause();
  bgm.currentTime = 0;
  pauseOverlay.classList.add("hidden");
  appShell.classList.remove("paused");
  document.body.classList.remove("low-time");
  overlay.classList.remove("hidden");
  refreshSaveSlot();
}

function pauseGame() {
  if (!gameStarted || paused) return;
  paused = true;
  clearInterval(timerId);
  clearSel();
  clearPath();
  document.body.classList.remove("low-time");
  $("themePicker").classList.add("hidden");
  appShell.classList.add("paused");
  setupPauseModal();
  pauseOverlay.classList.remove("hidden");
  moveStatus.textContent = "GAME PAUSED";
  sfx.select();
}

function resumeGame() {
  if (!gameStarted || !paused) return;
  paused = false;
  pauseOverlay.classList.add("hidden");
  appShell.classList.remove("paused");
  document.body.classList.toggle("low-time", timeLeft <= 60 && gameStarted);
  moveStatus.textContent = "SYSTEM ONLINE";
  unlockAudio();
  sfx.level();
  playBgmIfAllowed();
  startTimer();
  resizeCanvas();
}

function restartCurrentLevel() {
  nextLevelReadyAfterComplete = false;
  gameOverOverlay.classList.add("hidden");
  levelScore = 0;
  setScoreDisplay();
  resetLevelScoring();
  currentStrategy = isQuickGame ? STRATEGIES[0] : getStrategy(level);
  levelTotalTime = isQuickGame ? TOTAL_TIME : getLevelTime(level);
  timeLeft = levelTotalTime;
  timerWarned = false;
  updateRuleTag();
  updateTimer();
  createBoard();
  renderBoard();
  paused = false;
  gameStarted = true;
  moveStatus.textContent = `RETRY  LV ${level}`;
  startTimer();
}

function newGameFromGameOver() {
  gameOverOverlay.classList.add("hidden");
  if (isQuickGame) {
    startQuickGame();
  } else {
    startGame({ quick: false });
  }
}

function quitFromGameOver() {
  gameOverOverlay.classList.add("hidden");
  returnToTitleAfterSave();
}

// ─────────────────────────────────────────────
//  v1.3.16  FINITE SCROLL-SNAP CAROUSEL
//  Single unified approach for desktop + mobile.
//  Layout: CSS flex scroll-snap (no absolute positioning, no JS transforms).
//  JS responsibility: track active index, update is-center class,
//  scroll active card into view, update dots, update arrow disabled state.
// ─────────────────────────────────────────────
let spriteCarouselIndex = 0;
let spriteCarouselScrollTimer = 0;
let spriteCarouselSuppressScroll = false;
let spriteCarouselWheelLock = false;
let spriteCarouselPointerStart = null;
let spriteCarouselPointerMoved = false;
let spriteCarouselResizeRAF = 0;

function baseSpriteOptions() {
  const el = $("spriteOptions");
  return el
    ? [...el.querySelectorAll(".sprite-option:not(.sprite-clone)")]
    : [];
}

function getSpriteCarouselIds() {
  return baseSpriteOptions()
    .map((card) => card.dataset.set)
    .filter(Boolean);
}

function setupSpriteCarousel() {
  const el = $("spriteOptions");
  if (!el || el.dataset.carouselReady === "1") return;
  el.dataset.carouselReady = "1";
  buildSpriteCarouselDots();

  const ids = getSpriteCarouselIds();
  spriteCarouselIndex = Math.max(0, ids.indexOf(currentSpriteSetId));

  // Arrow buttons
  const prev = $("spriteCarouselPrev");
  const next = $("spriteCarouselNext");
  if (prev)
    prev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveSpriteCarousel(-1, true);
    });
  if (next)
    next.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveSpriteCarousel(1, true);
    });

  // Scroll → detect which card is centred after scrolling settles
  el.addEventListener(
    "scroll",
    () => {
      if (spriteCarouselSuppressScroll) return;
      window.clearTimeout(spriteCarouselScrollTimer);
      spriteCarouselScrollTimer = window.setTimeout(
        selectNearestCarouselCard,
        90,
      );
    },
    { passive: true },
  );

  // Mouse-wheel: step one card at a time
  el.addEventListener("wheel", handleSpriteCarouselWheel, { passive: false });

  // Re-centre on resize
  window.addEventListener(
    "resize",
    () => {
      if (spriteCarouselResizeRAF) return;
      spriteCarouselResizeRAF = requestAnimationFrame(() => {
        spriteCarouselResizeRAF = 0;
        scrollCarouselToIndex(spriteCarouselIndex, false);
      });
    },
    { passive: true },
  );

  refreshSpriteSavePills();
  renderSpriteCarousel();
  // Defer first scroll so layout is complete
  setTimeout(() => scrollCarouselToIndex(spriteCarouselIndex, false), 80);
  updateSpriteCarouselDots();
}

function renderSpriteCarousel() {
  const cards = baseSpriteOptions();
  const n = cards.length;
  if (!n) return;
  spriteCarouselIndex = Math.max(0, Math.min(spriteCarouselIndex, n - 1));
  cards.forEach((card, i) => {
    card.classList.toggle("is-center", i === spriteCarouselIndex);
  });
  updateSpriteCarouselDots();
  updateCarouselArrows();
}

function scrollCarouselToIndex(idx, smooth = true) {
  const el = $("spriteOptions");
  const cards = baseSpriteOptions();
  const card = cards[idx];
  if (!el || !card) return;
  spriteCarouselSuppressScroll = true;
  // Scroll so the card centre aligns with the container centre
  const cardRect = card.getBoundingClientRect();
  const containerRect = el.getBoundingClientRect();
  const delta =
    cardRect.left +
    cardRect.width / 2 -
    (containerRect.left + containerRect.width / 2);
  if (smooth) {
    el.scrollTo({ left: el.scrollLeft + delta, behavior: "smooth" });
  } else {
    el.scrollLeft = el.scrollLeft + delta;
  }
  window.setTimeout(
    () => {
      spriteCarouselSuppressScroll = false;
    },
    smooth ? 340 : 80,
  );
}

function selectNearestCarouselCard() {
  const el = $("spriteOptions");
  const cards = baseSpriteOptions();
  if (!el || !cards.length) return;
  const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
  let bestIdx = spriteCarouselIndex,
    bestDist = Infinity;
  cards.forEach((card, i) => {
    const r = card.getBoundingClientRect();
    const dist = Math.abs(r.left + r.width / 2 - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  });
  if (bestIdx !== spriteCarouselIndex) {
    spriteCarouselIndex = bestIdx;
    const ids = getSpriteCarouselIds();
    const setId = ids[spriteCarouselIndex];
    if (setId && setId !== currentSpriteSetId)
      applySpriteSet(setId, { fromCarousel: true });
    renderSpriteCarousel();
  }
}

function centerSpriteCarouselOn(setId, smooth = true) {
  const ids = getSpriteCarouselIds();
  const idx = ids.indexOf(setId);
  if (idx < 0) return;
  spriteCarouselIndex = idx;
  renderSpriteCarousel();
  scrollCarouselToIndex(idx, smooth);
}

function moveSpriteCarousel(direction, playSound = false) {
  const ids = getSpriteCarouselIds();
  if (!ids.length) return;
  // Finite: clamp at ends, no wrap-around
  spriteCarouselIndex = Math.max(
    0,
    Math.min(spriteCarouselIndex + direction, ids.length - 1),
  );
  const setId = ids[spriteCarouselIndex];
  applySpriteSet(setId, { fromCarousel: true });
  renderSpriteCarousel();
  scrollCarouselToIndex(spriteCarouselIndex, true);
  if (playSound && typeof sfx !== "undefined") sfx.select();
}

function selectSpriteCarouselSet(setId, playSound = false) {
  const ids = getSpriteCarouselIds();
  const idx = ids.indexOf(setId);
  if (idx < 0) return;
  spriteCarouselIndex = idx;
  applySpriteSet(setId, { fromCarousel: true });
  renderSpriteCarousel();
  scrollCarouselToIndex(idx, true);
  if (playSound && typeof sfx !== "undefined") sfx.select();
}

function getCenteredSpriteCard() {
  return baseSpriteOptions()[spriteCarouselIndex] || null;
}

function normalizeSpriteCarouselPosition() {
  renderSpriteCarousel();
  scrollCarouselToIndex(spriteCarouselIndex, false);
}

function updateCarouselArrows() {
  const ids = getSpriteCarouselIds();
  const prev = $("spriteCarouselPrev");
  const next = $("spriteCarouselNext");
  if (prev) prev.disabled = spriteCarouselIndex === 0;
  if (next) next.disabled = spriteCarouselIndex === ids.length - 1;
}

function handleSpriteCarouselWheel(e) {
  const amount = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(amount) < 8) return;
  e.preventDefault();
  if (spriteCarouselWheelLock) return;
  spriteCarouselWheelLock = true;
  moveSpriteCarousel(amount > 0 ? 1 : -1, true);
  setTimeout(() => {
    spriteCarouselWheelLock = false;
  }, 260);
}

function buildSpriteCarouselDots() {
  const dots = $("spriteCarouselDots");
  if (!dots) return;
  dots.innerHTML = "";
  baseSpriteOptions().forEach((card) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "sprite-carousel-dot";
    dot.dataset.set = card.dataset.set;
    dot.setAttribute(
      "aria-label",
      `Select ${(SPRITE_SETS[card.dataset.set] || {}).name || card.dataset.set}`,
    );
    dot.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectSpriteCarouselSet(dot.dataset.set, true);
    });
    dots.appendChild(dot);
  });
}

function updateSpriteCarouselDots() {
  document
    .querySelectorAll(".sprite-carousel-dot")
    .forEach((dot) =>
      dot.classList.toggle("active", dot.dataset.set === currentSpriteSetId),
    );
}

function handleSpriteCarouselPointerDown(e) {
  spriteCarouselPointerStart = { x: e.clientX, y: e.clientY, t: Date.now() };
  spriteCarouselPointerMoved = false;
}

function handleSpriteCarouselPointerUp(e) {
  if (!spriteCarouselPointerStart) return false;
  const dx = (e.clientX || 0) - spriteCarouselPointerStart.x;
  const dy = (e.clientY || 0) - spriteCarouselPointerStart.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const dt = Date.now() - spriteCarouselPointerStart.t;
  spriteCarouselPointerStart = null;

  // Horizontal gesture: move the carousel one card.
  if (adx > 32 && adx > ady * 1.25 && dt < 900) {
    spriteCarouselPointerMoved = true;
    moveSpriteCarousel(dx < 0 ? 1 : -1, true);
    setTimeout(() => {
      spriteCarouselPointerMoved = false;
    }, 120);
    return true;
  }

  // Vertical gesture: let the startup modal/page scroll, but suppress
  // accidental tile-set selection at the end of the scroll.
  if (ady > 18 && ady > adx * 1.15) {
    spriteCarouselPointerMoved = true;
    setTimeout(() => {
      spriteCarouselPointerMoved = false;
    }, 120);
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────
//  BUTTON BINDINGS
// ─────────────────────────────────────────────
$("startBtn").onclick = () => startNewGameFromTitle(false);
$("hintBtn").onclick = hint;
$("shuffleBtn").onclick = () => shuffleTiles(true);
$("pauseBtn").onclick = pauseGame;

// Pause overlay game sound toggle
const _pauseSoundToggle = $("pauseSoundToggle");
function _syncPauseToggleState() {
  if (_pauseSoundToggle) _pauseSoundToggle.setAttribute("aria-pressed", muted ? "false" : "true");
}
function _setGameSoundMuted(nextMuted) {
  unlockAudio();
  soundEnabled = !nextMuted;
  muted = !soundEnabled;
  Object.values(uiAudio).forEach((a) => (a.muted = !soundEnabled));
  const topSoundBtn = $("musicBtn");
  if (topSoundBtn) topSoundBtn.textContent = soundEnabled ? "♪" : "×";
  if (musicEnabled) playBgmIfAllowed();
  syncFmwStartupToggles();
  _syncPauseToggleState();
}
if (_pauseSoundToggle) {
  _pauseSoundToggle.onclick = () => _setGameSoundMuted(!muted);
}
$("continueBtn").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  saveOverlay.classList.add("hidden");
  resumeGame();
};
$("nextLevelBtn").onclick = startNextLevel;
$("levelCompleteQuitBtn").onclick = levelCompleteQuit;
const levelCompleteCloseBtn = $("levelCompleteCloseBtn");
if (levelCompleteCloseBtn) levelCompleteCloseBtn.onclick = levelCompleteQuit;
$("gameOverNewGameBtn").onclick = newGameFromGameOver;
$("gameOverQuitBtn").onclick = quitFromGameOver;
$("themeBtn").onclick = (e) => {
  e.stopPropagation();
  toggleThemePicker();
};
$("musicBtn").onclick = () => {
  setFmwMusicEnabled(!musicEnabled);
};

// Save buttons
const quickSaveBtn = $("saveBtn");
if (quickSaveBtn) {
  quickSaveBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gameStarted) return;
    if (!paused) pauseGame();
    triggerSave(false);
  };
}
$("saveOkBtn").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  saveOverlay.classList.add("hidden");
  const action = saveOverlay.dataset.action || saveOverlayAction;
  saveOverlay.dataset.action = "none";
  saveOverlayAction = "none";
  refreshSaveSlot();
  if (action === "quit") {
    returnToTitleAfterSave();
  } else if (gameStarted && paused) {
    resumeGame();
  }
};
$("saveContinueBtn").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  saveAndContinue();
};
$("saveFromPauseBtn").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  confirmQuitGame();
};
$("endQuickGameBtn").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  endQuickGame(false);
};
$("cancelEndQuickBtn").onclick = () =>
  $("endQuickConfirmOverlay").classList.add("hidden");
$("confirmEndQuickBtn").onclick = () => {
  $("endQuickConfirmOverlay").classList.add("hidden");
  endQuickGame(true);
};
$("cancelQuitGameBtn").onclick = () =>
  $("quitConfirmOverlay").classList.add("hidden");
$("confirmQuitGameBtn").onclick = () => {
  quitCurrentGameWithoutSaving();
};
$("helperMessageOkBtn").onclick = () =>
  $("helperMessageOverlay").classList.add("hidden");

// Start screen actions
$("continueFromSaveBtn").onclick = continueFromSave;
$("quickGameBtn").onclick = startQuickGame;
$("cancelNewGameBtn").onclick = () =>
  $("newGameConfirmOverlay").classList.add("hidden");
$("confirmNewGameBtn").onclick = () => {
  $("newGameConfirmOverlay").classList.add("hidden");
  startNewGameFromTitle(true);
};
$("deleteSaveBtn").onclick = () => {
  deleteSave(currentSpriteSetId);
  refreshSaveSlot();
};

// Character set option clicks
// Delegated pointer/click handling keeps the full cartridge-style button tappable
// on iPhone/iPad, including taps on the small subtitle text.
let lastSpritePressAt = 0;
function handleSpritePointerDown(e) {
  handleSpriteCarouselPointerDown(e);
}
function handleSpriteOptionPress(e) {
  const opt = e.target.closest(".sprite-option");
  if (!opt) return;
  if (e.type === "pointerup" && handleSpriteCarouselPointerUp(e)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.type === "click" && spriteCarouselPointerMoved) {
    e.preventDefault();
    e.stopPropagation();
    spriteCarouselPointerMoved = false;
    return;
  }
  const now = Date.now();
  e.preventDefault();
  e.stopPropagation();
  if (now - lastSpritePressAt < 180) return;
  lastSpritePressAt = now;
  selectSpriteCarouselSet(opt.dataset.set, true);
}
const spriteOptionsEl = $("spriteOptions");
if (spriteOptionsEl) {
  spriteOptionsEl.style.setProperty(
    "--sprite-count",
    Math.min(6, spriteOptionsEl.querySelectorAll(".sprite-option").length),
  );
  setupSpriteCarousel();
  spriteOptionsEl.addEventListener(
    "pointerdown",
    handleSpritePointerDown,
    true,
  );
  spriteOptionsEl.addEventListener("pointerup", handleSpriteOptionPress, true);
  spriteOptionsEl.addEventListener("click", handleSpriteOptionPress, true);
}

// Theme option clicks
document.querySelectorAll(".theme-option").forEach((el) => {
  el.onclick = (e) => {
    e.stopPropagation();
    applyTheme(el.dataset.theme);
    $("themePicker").classList.add("hidden");
    closeCompactThemePicker();
  };
});

const themePillBtn = $("themePillBtn");
if (themePillBtn) {
  themePillBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCompactThemePicker();
  };
}
const themePickerClose = $("themePickerClose");
if (themePickerClose) themePickerClose.onclick = closeCompactThemePicker;
const themePickerOverlay = $("themePickerOverlay");
if (themePickerOverlay) {
  themePickerOverlay.addEventListener("click", (e) => {
    if (e.target === themePickerOverlay) closeCompactThemePicker();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCompactThemePicker();
});

// Flag Match World startup controls: all visible buttons/toggles are real controls.
const FMW_MUSIC_KEY = "fmw_music_enabled_v1";
const FMW_SOUND_KEY = "fmw_sound_enabled_v1";

function readStoredBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch (e) {
    return fallback;
  }
}

function syncFmwStartupToggles() {
  const musicToggle = $("fmwMusicToggle");
  const soundToggle = $("fmwSoundToggle");
  const musicSub = $("fmwMusicSub");
  const soundSub = $("fmwSoundSub");
  const themeSub = $("fmwThemeSub");
  const meta = getThemeMeta(currentTheme);

  if (musicToggle) {
    musicToggle.classList.toggle("off", !musicEnabled);
    musicToggle.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
  }
  if (soundToggle) {
    soundToggle.classList.toggle("off", !soundEnabled);
    soundToggle.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  }
  if (musicSub) musicSub.textContent = musicEnabled ? "On" : "Off";
  if (soundSub) soundSub.textContent = soundEnabled ? "On" : "Off";
  if (themeSub && meta) themeSub.textContent = meta.shortName || meta.name;
}

function setFmwMusicEnabled(enabled) {
  unlockAudio();
  musicEnabled = !!enabled;
  try { localStorage.setItem(FMW_MUSIC_KEY, String(musicEnabled)); } catch (e) {}
  if (!musicEnabled) {
    try { bgm.pause(); } catch (e) {}
    bgm.muted = true;
  } else {
    bgm.muted = false;
    playBgmIfAllowed();
  }
  syncFmwStartupToggles();
}

function setFmwSoundEnabled(enabled) {
  unlockAudio();
  soundEnabled = !!enabled;
  muted = !soundEnabled;
  try { localStorage.setItem(FMW_SOUND_KEY, String(soundEnabled)); } catch (e) {}
  Object.values(uiAudio).forEach((a) => (a.muted = !soundEnabled));
  const topSoundBtn = $("musicBtn");
  if (topSoundBtn) topSoundBtn.textContent = soundEnabled ? "♪" : "×";
  if (soundEnabled && typeof sfx !== "undefined") sfx.select();
  syncFmwStartupToggles();
  _syncPauseToggleState();
}

function cycleFmwTheme() {
  const ids = THEMES.map((theme) => theme.id);
  const idx = Math.max(0, ids.indexOf(currentTheme));
  applyTheme(ids[(idx + 1) % ids.length]);
  syncFmwStartupToggles();
  if (soundEnabled && typeof sfx !== "undefined") sfx.select();
}

musicEnabled = readStoredBool(FMW_MUSIC_KEY, true);
soundEnabled = readStoredBool(FMW_SOUND_KEY, true);
muted = !soundEnabled;
try { bgm.muted = !musicEnabled; } catch (e) {}
Object.values(uiAudio).forEach((a) => (a.muted = !soundEnabled));

const fmwMusicToggle = $("fmwMusicToggle");
if (fmwMusicToggle) fmwMusicToggle.onclick = () => setFmwMusicEnabled(!musicEnabled);
const fmwSoundToggle = $("fmwSoundToggle");
if (fmwSoundToggle) fmwSoundToggle.onclick = () => setFmwSoundEnabled(!soundEnabled);
const fmwThemeCycle = $("fmwThemeCycle");
if (fmwThemeCycle) fmwThemeCycle.onclick = cycleFmwTheme;
const fmwSettingsBtn = $("fmwSettingsBtn");
if (fmwSettingsBtn) {
  fmwSettingsBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCompactThemePicker();
  };
}
syncFmwStartupToggles();

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
try {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || currentTheme, false);
} catch (err) {
  applyTheme(currentTheme, false);
}
syncFmwStartupToggles();
updateTimer();
createBoard();
renderBoard();
refreshSaveSlot(); // show saved game slot on start screen if one exists




// ─────────────────────────────────────────────
//  v3.5.3 GUARDED DEVICE LAYOUT CLASSES
//  iPhone layout must remain exactly controlled by style-new.css v3.5.0.
//  Desktop/iPad sizing polish is enabled only via explicit body classes.
// ─────────────────────────────────────────────
(function guardedDeviceLayoutClasses(){
  const root = document.documentElement;
  const body = document.body;
  if (!body) return;

  function mq(query){
    return !!(window.matchMedia && window.matchMedia(query).matches);
  }

  function isIPhoneLike(){
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPhone|iPod/i.test(ua) || /iPhone|iPod/i.test(platform);
  }

  function isIPadLike(){
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPad/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && mq("(pointer: coarse)"));
  }

  function applyDeviceClasses(){
    const iphone = isIPhoneLike();
    const ipad = isIPadLike();
    const coarse = mq("(hover: none) and (pointer: coarse)");
    const fineDesktop = mq("(hover: hover) and (pointer: fine)") && !ipad && !iphone;
    const landscape = window.innerWidth > window.innerHeight;
    const bigEnoughForTablet = window.innerWidth >= 768 && window.innerHeight >= 600;
    const tablet = !iphone && (ipad || (coarse && bigEnoughForTablet));

    body.classList.toggle("pm-iphone-layout", iphone);
    body.classList.toggle("pm-desktop-size", fineDesktop && window.innerWidth >= 768);
    body.classList.toggle("pm-tablet-landscape", tablet && landscape && bigEnoughForTablet);
    body.classList.toggle("pm-tablet-portrait", tablet && !landscape && bigEnoughForTablet);

    // Defensive marker for debugging screenshots. No CSS sizing is attached to this class.
    root.dataset.pmDevice = iphone ? "iphone" : (tablet ? "tablet" : (fineDesktop ? "desktop" : "other"));
  }

  let deviceClassRaf = 0;
  function scheduleDeviceClasses(){
    if (deviceClassRaf) cancelAnimationFrame(deviceClassRaf);
    deviceClassRaf = requestAnimationFrame(() => {
      deviceClassRaf = 0;
      applyDeviceClasses();
    });
  }

  applyDeviceClasses();
  window.addEventListener("resize", scheduleDeviceClasses, { passive: true });
  window.addEventListener("orientationchange", scheduleDeviceClasses, { passive: true });
  document.addEventListener("visibilitychange", scheduleDeviceClasses);
})();

// ─────────────────────────────────────────────
//  v3.5.4 DESKTOP BEST-FIT PLAYFIELD
//  Use the largest possible playfield that fits inside the visible
//  browser window while preserving the original board aspect ratio.
//  Narrow windows fit by width and leave bottom space; ultrawide/short
//  windows fit by height and leave left/right space. No scrollbars.
// ─────────────────────────────────────────────
(function desktopBestFitPlayfieldSizer(){
  const DESKTOP_MIN_WIDTH = 768;
  const MIN_PLAYFIELD_WIDTH = 360;
  const DESKTOP_SAFE_INSET = 18;
  const MAX_DESKTOP_WIDTH = 1580;
  let resizeRaf = 0;
  let verifyRaf = 0;

  function num(value){
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  function setPlayfieldWidth(px){
    const width = Math.max(MIN_PLAYFIELD_WIDTH, Math.floor(px));
    document.documentElement.style.setProperty('--desktop-playfield-width', width + 'px');
  }

  function getPlayfieldWidth(){
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--desktop-playfield-width');
    return num(raw) || 0;
  }

  function clearPlayfieldWidth(){
    document.documentElement.style.removeProperty('--desktop-playfield-width');
  }

  function isFinePointerDesktop(){
    return document.body.classList.contains('pm-desktop-size')
      && window.matchMedia
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function getViewportHeight(){
    const visualHeight = window.visualViewport && window.visualViewport.height ? window.visualViewport.height : window.innerHeight;
    return Math.min(window.innerHeight || visualHeight, visualHeight || window.innerHeight);
  }

  function getHorizontalLimit(){
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea ? gameArea.getBoundingClientRect().width : window.innerWidth;
    const sidePadding = window.innerWidth <= 1200 ? 20 : 44;
    return Math.max(
      MIN_PLAYFIELD_WIDTH,
      Math.min(MAX_DESKTOP_WIDTH, window.innerWidth - sidePadding, gameWidth - 12)
    );
  }

  function getFrameChromeHeight(frame, topbar, meter){
    const cs = getComputedStyle(frame);
    const rowGap = num(cs.rowGap || cs.gap);
    return num(cs.paddingTop) + num(cs.paddingBottom)
      + num(cs.borderTopWidth) + num(cs.borderBottomWidth)
      + (topbar ? topbar.getBoundingClientRect().height : 0)
      + (meter ? meter.getBoundingClientRect().height : 0)
      + (rowGap * 2);
  }

  function getFrameHorizontalChrome(frame){
    const cs = getComputedStyle(frame);
    return num(cs.paddingLeft) + num(cs.paddingRight)
      + num(cs.borderLeftWidth) + num(cs.borderRightWidth);
  }

  function measureVerticalOverflow(){
    const gameArea = document.querySelector('.game-area');
    const frame = document.querySelector('.board-frame');
    const boardWrap = document.querySelector('.board-wrap');
    const meter = document.querySelector('.board-time-meter');
    const topbar = document.querySelector('.topbar');
    if (!gameArea || !frame || !boardWrap || !topbar) return 0;

    const gameRect = gameArea.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const wrapRect = boardWrap.getBoundingClientRect();
    const meterRect = meter ? meter.getBoundingClientRect() : { bottom: frameRect.top };
    const contentBottom = Math.max(frameRect.bottom, wrapRect.bottom, meterRect.bottom);
    const contentTop = Math.min(frameRect.top, topbar.getBoundingClientRect().top);
    return Math.max(
      0,
      contentBottom - (gameRect.bottom - DESKTOP_SAFE_INSET),
      (gameRect.top + DESKTOP_SAFE_INSET) - contentTop
    );
  }

  function fitDesktopPlayfield(){
    if (!isFinePointerDesktop() || window.innerWidth < DESKTOP_MIN_WIDTH) {
      clearPlayfieldWidth();
      return;
    }

    const frame = document.querySelector('.board-frame');
    const topbar = document.querySelector('.topbar');
    const meter = document.querySelector('.board-time-meter');
    const gameArea = document.querySelector('.game-area');
    if (!frame || !topbar || !gameArea) return;

    const horizontalLimit = getHorizontalLimit();

    // v3.5.6 desktop first-render guard:
    // The earlier version measured from the current frame top, which changes after
    // a resize/centering pass. That made the first fullscreen render believe it had
    // more vertical space than it really did, while a manual resize corrected it.
    // This version calculates the allowed width from the stable game-area height,
    // so first open and post-resize use the same sizing path.
    const gameAreaHeight = Math.min(gameArea.getBoundingClientRect().height, getViewportHeight());
    const availableFrameHeight = Math.max(320, gameAreaHeight - (DESKTOP_SAFE_INSET * 2));
    const frameChromeH = getFrameChromeHeight(frame, topbar, meter);
    const frameChromeW = getFrameHorizontalChrome(frame);
    const contentWidthByHeight = Math.max(
      MIN_PLAYFIELD_WIDTH - frameChromeW,
      (availableFrameHeight - frameChromeH) * 16 / 9
    );
    const widthByHeight = contentWidthByHeight + frameChromeW;
    const targetWidth = Math.min(horizontalLimit, widthByHeight);

    setPlayfieldWidth(targetWidth);

    // A second-frame verification catches late image/font/layout changes and any
    // browser toolbar/viewport rounding. This only shrinks on real overflow, so
    // normal desktop and half-width desktop keep their preferred large size.
    if (verifyRaf) cancelAnimationFrame(verifyRaf);
    verifyRaf = requestAnimationFrame(() => {
      verifyRaf = 0;
      const overflow = measureVerticalOverflow();
      if (overflow > 0) {
        const current = getPlayfieldWidth() || targetWidth;
        setPlayfieldWidth(current - Math.ceil((overflow * 16 / 9) + 12));
      }
    });
  }

  function scheduleFit(){
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      fitDesktopPlayfield();
    });
  }

  window.__pmScheduleDesktopFit = scheduleFit;

  window.addEventListener('resize', scheduleFit, { passive: true });
  window.addEventListener('orientationchange', scheduleFit, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit, { passive: true });
  document.addEventListener('visibilitychange', scheduleFit);
  document.addEventListener('DOMContentLoaded', scheduleFit);
  window.addEventListener('load', scheduleFit, { once: true });

  document.addEventListener('load', (ev) => {
    if (ev.target && ev.target.tagName === 'IMG') scheduleFit();
  }, true);

  if (window.MutationObserver) {
    const board = document.querySelector('.board');
    if (board) new MutationObserver(scheduleFit).observe(board, { childList: true, subtree: false });
    new MutationObserver(scheduleFit).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(scheduleFit);
    const gameArea = document.querySelector('.game-area');
    const frame = document.querySelector('.board-frame');
    if (gameArea) ro.observe(gameArea);
    if (frame) ro.observe(frame);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFit).catch(() => {});
  [0, 40, 80, 160, 320, 640, 1000, 1600].forEach(ms => setTimeout(scheduleFit, ms));
})();
