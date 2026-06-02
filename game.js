const ROWS = 9,
  COLS = 16,
  TOTAL_TIME = 480,
  LEVEL_LOOP_SIZE = 8,
  HINTS = 5,
  SHUFFLES = 5,
  MAX_HINTS = 10,
  MAX_SHUFFLES = 15,
  QUICK_GAME_UNIQUE_FLAGS = 48;

// Flag Match World progression:
// Pure random flag selection from all 212 flags. No difficulty buckets.
// Level 1-8   = 24 unique flags
// Level 9-16  = 28 unique flags
// Level 17-24 = 32 unique flags
// Level 25-32 = 36 unique flags
// Level 33-40 = 40 unique flags
// Level 41-48 = 44 unique flags
// Level 49+   = 48 unique flags max
const MAIN_GAME_UNIQUE_FLAG_STEPS = [24, 28, 32, 36, 40, 44, 48];
const MIN_LEVEL_TIME = 420; // 7:00
const TIMER_REDUCTION_STEP = 15; // seconds
const TIMER_REDUCTION_LEVEL_BLOCK = 48;
const SAVE_KEY = "fmw_save_v1"; // legacy single-slot save key
const SAVES_KEY = "fmw_saves_v2";
const BEST_SCORES_KEY = "fmw_best_scores_v1";
const SPRITE_SET_KEY = "fmw_sprite_set_v1";
let audioCtx = null,
  muted = false,
  timerWarned = false;
let audioUnlocked = false;

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

let audioResuming = false;
function withAudio(run) {
  if (muted) return;
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
  if (ac.state === "running") {
    play();
  } else if (!audioResuming) {
    // Guard against overlapping resume() calls — on iOS Safari, firing
    // multiple resume() calls simultaneously (e.g. the 5 tone() calls in
    // sfx.match()) can silently drop callbacks, causing the match sound to
    // go missing. Only one resume is allowed at a time; extra tones that
    // arrive mid-resume are dropped rather than risk corrupting the chain.
    audioResuming = true;
    ac.resume().then(() => {
      audioResuming = false;
      play();
    }).catch(() => {
      audioResuming = false;
    });
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
  { id: "emerald", name: "EMERALD GREEN" },
  { id: "classic-blue", name: "CLASSIC BLUE" },
  { id: "dark-navy", name: "DARK NAVY" },
  { id: "royal-purple", name: "ROYAL PURPLE" },
  { id: "burgundy-red", name: "BURGUNDY RED" },
];
const THEME_ALIASES = {
  "neon-night": "emerald",
  "cyber-blue": "classic-blue",
  "arcade-purple": "royal-purple",
  "soft-sky": "classic-blue",
  "candy-pop": "burgundy-red",
  "mint-fresh": "emerald",
};
const THEME_STORAGE_KEY = "fmwTheme";
let currentTheme = "emerald";

const THEME_SWATCHES = {
  "emerald": ["#061c19", "#0f8f62", "#60d783", "#d9bb63"],
  "classic-blue": ["#06162c", "#1676ff", "#65c7ff", "#e4c96a"],
  "dark-navy": ["#030812", "#10284d", "#79b7ff", "#d9bb63"],
  "royal-purple": ["#160824", "#7132c8", "#cc79ff", "#e4c96a"],
  "burgundy-red": ["#24070c", "#9f2438", "#ff7080", "#e4c96a"],
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
    (THEME_SWATCHES[themeId] || THEME_SWATCHES["emerald"]).forEach((color) => {
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
  const normalized = THEME_ALIASES[id] || id || "neon-night";
  return THEMES.some((theme) => theme.id === normalized) ? normalized : "emerald";
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
  { id: 0, name: "NORMAL",   label: "No movement",                        iconClass: "movement-normal",  desc: "Tiles stay in place after a match." },
  { id: 1, name: "BOTTOM",   label: "Fall to bottom",                     iconClass: "movement-down",    desc: "After each match, remaining tiles fall to the bottom." },
  { id: 2, name: "TOP",      label: "Rise to top",                        iconClass: "movement-up",      desc: "After each match, remaining tiles rise to the top." },
  { id: 3, name: "LEFT",     label: "Slide to left",                      iconClass: "movement-left",    desc: "After each match, remaining tiles slide to the left." },
  { id: 4, name: "RIGHT",    label: "Slide to right",                     iconClass: "movement-right",   desc: "After each match, remaining tiles slide to the right." },
  { id: 5, name: "X CENTER", label: "Collapse toward vertical center",    iconClass: "movement-xcenter", desc: "Tiles collapse inward toward the vertical centre line." },
  { id: 6, name: "Y CENTER", label: "Collapse toward horizontal center",  iconClass: "movement-ycenter", desc: "Tiles collapse inward toward the horizontal centre line." },
  { id: 7, name: "RANDOM",   label: "Random movement after each match",   iconClass: "movement-random",  desc: "Direction changes randomly after every match. Stay sharp!" },
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
      // Collapse toward the vertical center column:
      // left half slides right, right half slides left.
      board[r] = [...compactLine(left, 1), ...compactLine(right, 0)];
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
      const newTop = compactLine(top, 1); // top section slides down toward center
      const newBottom = compactLine(bottom, 0); // bottom section slides up toward center
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
const SPRITES = [
  {
    id: 1,
    n: "Character 01",
    img: "assets/sprites/original/01-character-01.png",
  },
  {
    id: 2,
    n: "Character 02",
    img: "assets/sprites/original/02-character-02.png",
  },
  {
    id: 3,
    n: "Character 03",
    img: "assets/sprites/original/03-character-03.png",
  },
  {
    id: 4,
    n: "Character 04",
    img: "assets/sprites/original/04-character-04.png",
  },
  {
    id: 5,
    n: "Character 05",
    img: "assets/sprites/original/05-character-05.png",
  },
  {
    id: 6,
    n: "Character 06",
    img: "assets/sprites/original/06-character-06.png",
  },
  {
    id: 7,
    n: "Character 07",
    img: "assets/sprites/original/07-character-07.png",
  },
  {
    id: 8,
    n: "Character 08",
    img: "assets/sprites/original/08-character-08.png",
  },
  {
    id: 9,
    n: "Character 09",
    img: "assets/sprites/original/09-character-09.png",
  },
  {
    id: 10,
    n: "Character 10",
    img: "assets/sprites/original/10-character-10.png",
  },
  {
    id: 11,
    n: "Character 11",
    img: "assets/sprites/original/11-character-11.png",
  },
  {
    id: 12,
    n: "Character 12",
    img: "assets/sprites/original/12-character-12.png",
  },
  {
    id: 13,
    n: "Character 13",
    img: "assets/sprites/original/13-character-13.png",
  },
  {
    id: 14,
    n: "Character 14",
    img: "assets/sprites/original/14-character-14.png",
  },
  {
    id: 15,
    n: "Character 15",
    img: "assets/sprites/original/15-character-15.png",
  },
  {
    id: 16,
    n: "Character 16",
    img: "assets/sprites/original/16-character-16.png",
  },
  {
    id: 17,
    n: "Character 17",
    img: "assets/sprites/original/17-character-17.png",
  },
  {
    id: 18,
    n: "Character 18",
    img: "assets/sprites/original/18-character-18.png",
  },
  {
    id: 19,
    n: "Character 19",
    img: "assets/sprites/original/19-character-19.png",
  },
  {
    id: 20,
    n: "Character 20",
    img: "assets/sprites/original/20-character-20.png",
  },
  {
    id: 21,
    n: "Character 21",
    img: "assets/sprites/original/21-character-21.png",
  },
  {
    id: 22,
    n: "Character 22",
    img: "assets/sprites/original/22-character-22.png",
  },
  {
    id: 23,
    n: "Character 23",
    img: "assets/sprites/original/23-character-23.png",
  },
  {
    id: 24,
    n: "Character 24",
    img: "assets/sprites/original/24-character-24.png",
  },
  {
    id: 25,
    n: "Character 25",
    img: "assets/sprites/original/25-character-25.png",
  },
  {
    id: 26,
    n: "Character 26",
    img: "assets/sprites/original/26-character-26.png",
  },
  {
    id: 27,
    n: "Character 27",
    img: "assets/sprites/original/27-character-27.png",
  },
  {
    id: 28,
    n: "Character 28",
    img: "assets/sprites/original/28-character-28.png",
  },
  {
    id: 29,
    n: "Character 29",
    img: "assets/sprites/original/29-character-29.png",
  },
  {
    id: 30,
    n: "Character 30",
    img: "assets/sprites/original/30-character-30.png",
  },
];
const GADGET_SPRITES = [
  {
    id: 1,
    n: "Air Purifier",
    img: "assets/sprites/gadgets/01-air-purifier.png",
  },
  { id: 2, n: "CCTV", img: "assets/sprites/gadgets/02-cctv.png" },
  { id: 3, n: "CPU", img: "assets/sprites/gadgets/03-cpu.png" },
  { id: 4, n: "Camera", img: "assets/sprites/gadgets/04-camera.png" },
  {
    id: 5,
    n: "Desktop Speakers",
    img: "assets/sprites/gadgets/05-desktop-speakers.png",
  },
  { id: 6, n: "Docking", img: "assets/sprites/gadgets/06-docking.png" },
  { id: 7, n: "Drone", img: "assets/sprites/gadgets/07-drone.png" },
  { id: 8, n: "Earbuds", img: "assets/sprites/gadgets/08-earbuds.png" },
  { id: 9, n: "Floppy", img: "assets/sprites/gadgets/09-floppy.png" },
  { id: 10, n: "GPU", img: "assets/sprites/gadgets/10-gpu.png" },
  {
    id: 11,
    n: "Game Console 1",
    img: "assets/sprites/gadgets/11-game-console-1.png",
  },
  {
    id: 12,
    n: "Game Console 2",
    img: "assets/sprites/gadgets/12-game-console-2.png",
  },
  {
    id: 13,
    n: "Game Controller",
    img: "assets/sprites/gadgets/13-game-controller.png",
  },
  { id: 14, n: "Headset", img: "assets/sprites/gadgets/14-headset.png" },
  { id: 15, n: "Joystick", img: "assets/sprites/gadgets/15-joystick.png" },
  { id: 16, n: "Keyboard", img: "assets/sprites/gadgets/16-keyboard.png" },
  { id: 17, n: "Laptop", img: "assets/sprites/gadgets/17-laptop.png" },
  {
    id: 18,
    n: "Mobile Phone 1",
    img: "assets/sprites/gadgets/18-mobile-phone-1.png",
  },
  {
    id: 19,
    n: "Mobile Phone 2",
    img: "assets/sprites/gadgets/19-mobile-phone-2.png",
  },
  { id: 20, n: "Monitor", img: "assets/sprites/gadgets/20-monitor.png" },
  {
    id: 21,
    n: "Photo Frame",
    img: "assets/sprites/gadgets/21-photo-frame.png",
  },
  { id: 22, n: "Powerbank", img: "assets/sprites/gadgets/22-powerbank.png" },
  { id: 23, n: "Projector", img: "assets/sprites/gadgets/23-projector.png" },
  { id: 24, n: "SD Card", img: "assets/sprites/gadgets/24-sd-card.png" },
  {
    id: 25,
    n: "Smart Watch",
    img: "assets/sprites/gadgets/25-smart-watch.png",
  },
  { id: 26, n: "Speaker", img: "assets/sprites/gadgets/26-speaker.png" },
  { id: 27, n: "Tablet", img: "assets/sprites/gadgets/27-tablet.png" },
  { id: 28, n: "Turntable", img: "assets/sprites/gadgets/28-turntable.png" },
  { id: 29, n: "VR", img: "assets/sprites/gadgets/29-vr.png" },
  { id: 30, n: "Widescreen", img: "assets/sprites/gadgets/30-widescreen.png" },
];
const SPORTS_SPRITES = [
  {
    id: 1,
    n: "American Football Helmet",
    img: "assets/sprites/sports/01-american-football-helmet.png",
  },
  {
    id: 2,
    n: "American Football",
    img: "assets/sprites/sports/02-american-football.png",
  },
  {
    id: 3,
    n: "Analog Timer",
    img: "assets/sprites/sports/03-analog-timer.png",
  },
  { id: 4, n: "Basketball", img: "assets/sprites/sports/04-basketball.png" },
  { id: 5, n: "Bicycle", img: "assets/sprites/sports/05-bicycle.png" },
  {
    id: 6,
    n: "Bowling Pins",
    img: "assets/sprites/sports/06-bowling-pins.png",
  },
  { id: 7, n: "Bowling", img: "assets/sprites/sports/07-bowling.png" },
  { id: 8, n: "Boxing", img: "assets/sprites/sports/08-boxing.png" },
  { id: 9, n: "Dart Board", img: "assets/sprites/sports/09-dart-board.png" },
  { id: 10, n: "Dumbbell", img: "assets/sprites/sports/10-dumbbell.png" },
  { id: 11, n: "F1", img: "assets/sprites/sports/11-f1.png" },
  {
    id: 12,
    n: "Football Shoe",
    img: "assets/sprites/sports/12-football-shoe.png",
  },
  { id: 13, n: "Football", img: "assets/sprites/sports/13-football.png" },
  { id: 14, n: "Golf", img: "assets/sprites/sports/14-golf.png" },
  { id: 15, n: "Kayak", img: "assets/sprites/sports/15-kayak.png" },
  {
    id: 16,
    n: "Motorcross Bike",
    img: "assets/sprites/sports/16-motorcross-bike.png",
  },
  { id: 17, n: "Parachute", img: "assets/sprites/sports/17-parachute.png" },
  { id: 18, n: "Ping Pong", img: "assets/sprites/sports/18-ping-pong.png" },
  { id: 19, n: "Podium", img: "assets/sprites/sports/19-podium.png" },
  {
    id: 20,
    n: "Pommel Horse",
    img: "assets/sprites/sports/20-pommel-horse.png",
  },
  { id: 21, n: "Rollerskate", img: "assets/sprites/sports/21-rollerskate.png" },
  { id: 22, n: "Sailboat", img: "assets/sprites/sports/22-sailboat.png" },
  { id: 23, n: "Scoreboard", img: "assets/sprites/sports/23-scoreboard.png" },
  {
    id: 24,
    n: "Scuba Goggles",
    img: "assets/sprites/sports/24-scuba-goggles.png",
  },
  { id: 25, n: "Shuttlecock", img: "assets/sprites/sports/25-shuttlecock.png" },
  { id: 26, n: "Stadium", img: "assets/sprites/sports/26-stadium.png" },
  { id: 27, n: "Tennis", img: "assets/sprites/sports/27-tennis.png" },
  { id: 28, n: "Timer", img: "assets/sprites/sports/28-timer.png" },
  { id: 29, n: "Trophy", img: "assets/sprites/sports/29-trophy.png" },
  { id: 30, n: "Volleyball", img: "assets/sprites/sports/30-volleyball.png" },
];
const HOME_SPRITES = [
  { id: 1, n: "Air Fryer", img: "assets/sprites/home/01-air-fryer.png" },
  { id: 2, n: "Bath Tub", img: "assets/sprites/home/02-bath-tub.png" },
  { id: 3, n: "Bed", img: "assets/sprites/home/03-bed.png" },
  {
    id: 4,
    n: "Bluetooth Speaker",
    img: "assets/sprites/home/04-bluetooth-speaker.png",
  },
  { id: 5, n: "Bookshelf", img: "assets/sprites/home/05-bookshelf.png" },
  { id: 6, n: "Bunk Bed", img: "assets/sprites/home/06-bunk-bed.png" },
  { id: 7, n: "Chandelier", img: "assets/sprites/home/07-chandelier.png" },
  { id: 8, n: "Clock", img: "assets/sprites/home/08-clock.png" },
  { id: 9, n: "Cloth Rack", img: "assets/sprites/home/09-cloth-rack.png" },
  { id: 10, n: "Curtain", img: "assets/sprites/home/10-curtain.png" },
  { id: 11, n: "Dining Chair", img: "assets/sprites/home/11-dining-chair.png" },
  { id: 12, n: "Fan", img: "assets/sprites/home/12-fan.png" },
  { id: 13, n: "Fridge", img: "assets/sprites/home/13-fridge.png" },
  { id: 14, n: "Hair Dryer", img: "assets/sprites/home/14-hair-dryer.png" },
  { id: 15, n: "Lounge Chair", img: "assets/sprites/home/15-lounge-chair.png" },
  { id: 16, n: "Microwave", img: "assets/sprites/home/16-microwave.png" },
  { id: 17, n: "PC", img: "assets/sprites/home/17-pc.png" },
  { id: 18, n: "Phone", img: "assets/sprites/home/18-phone.png" },
  { id: 19, n: "Radio", img: "assets/sprites/home/19-radio.png" },
  {
    id: 20,
    n: "Sewing Machine",
    img: "assets/sprites/home/20-sewing-machine.png",
  },
  { id: 21, n: "Sink", img: "assets/sprites/home/21-sink.png" },
  { id: 22, n: "Sofa", img: "assets/sprites/home/22-sofa.png" },
  { id: 23, n: "Stereo", img: "assets/sprites/home/23-stereo.png" },
  { id: 24, n: "Stove", img: "assets/sprites/home/24-stove.png" },
  { id: 25, n: "Toaster", img: "assets/sprites/home/25-toaster.png" },
  { id: 26, n: "TV", img: "assets/sprites/home/26-tv.png" },
  {
    id: 27,
    n: "Vacuum Cleaner",
    img: "assets/sprites/home/27-vacuum-cleaner.png",
  },
  { id: 28, n: "Vase", img: "assets/sprites/home/28-vase.png" },
  { id: 29, n: "Wardrobe", img: "assets/sprites/home/29-wardrobe.png" },
  {
    id: 30,
    n: "Washing Machine",
    img: "assets/sprites/home/30-washing-machine.png",
  },
];
const FLAGS_SPRITES = [
  { id: 1, n: "Afghanistan", img: "assets/sprites/flags/001-afghanistan.png" },
  { id: 2, n: "Albania", img: "assets/sprites/flags/002-albania.png" },
  { id: 3, n: "Algeria", img: "assets/sprites/flags/003-algeria.png" },
  { id: 4, n: "Andorra", img: "assets/sprites/flags/004-andorra.png" },
  { id: 5, n: "Angola", img: "assets/sprites/flags/005-angola.png" },
  { id: 6, n: "Antigua", img: "assets/sprites/flags/006-antigua-and-barbuda.png" },
  { id: 7, n: "Argentina", img: "assets/sprites/flags/007-argentina.png" },
  { id: 8, n: "Armenia", img: "assets/sprites/flags/008-armenia.png" },
  { id: 9, n: "Aruba", img: "assets/sprites/flags/009-aruba.png" },
  { id: 10, n: "Australia", img: "assets/sprites/flags/010-australia.png" },
  { id: 11, n: "Austria", img: "assets/sprites/flags/011-austria.png" },
  { id: 12, n: "Azerbaijan", img: "assets/sprites/flags/012-azerbaijan.png" },
  { id: 13, n: "Bahrain", img: "assets/sprites/flags/013-bahrain.png" },
  { id: 14, n: "Bangladesh", img: "assets/sprites/flags/014-bangladesh.png" },
  { id: 15, n: "Barbados", img: "assets/sprites/flags/015-barbados.png" },
  { id: 16, n: "Belarus", img: "assets/sprites/flags/016-belarus.png" },
  { id: 17, n: "Belgium", img: "assets/sprites/flags/017-belgium.png" },
  { id: 18, n: "Belize", img: "assets/sprites/flags/018-belize.png" },
  { id: 19, n: "Benin", img: "assets/sprites/flags/019-benin.png" },
  { id: 20, n: "Bhutan", img: "assets/sprites/flags/020-bhutan.png" },
  { id: 21, n: "Bolivia", img: "assets/sprites/flags/021-bolivia.png" },
  { id: 22, n: "Bosnia", img: "assets/sprites/flags/022-bosnia-and-herzegovina.png" },
  { id: 23, n: "Botswana", img: "assets/sprites/flags/023-botswana.png" },
  { id: 24, n: "Brazil", img: "assets/sprites/flags/024-brazil.png" },
  { id: 25, n: "Brunei", img: "assets/sprites/flags/025-brunei.png" },
  { id: 26, n: "Bulgaria", img: "assets/sprites/flags/026-bulgaria.png" },
  { id: 27, n: "Burkina Faso", img: "assets/sprites/flags/027-burkina-faso.png" },
  { id: 28, n: "Burundi", img: "assets/sprites/flags/028-burundi.png" },
  { id: 29, n: "Cambodia", img: "assets/sprites/flags/029-cambodia.png" },
  { id: 30, n: "Cameroon", img: "assets/sprites/flags/030-cameroon.png" },
  { id: 31, n: "Canada", img: "assets/sprites/flags/031-canada.png" },
  { id: 32, n: "Cape Verde", img: "assets/sprites/flags/032-cape-verde.png" },
  { id: 33, n: "Central African Republic", img: "assets/sprites/flags/033-central-african-republic.png" },
  { id: 34, n: "Chad", img: "assets/sprites/flags/034-chad.png" },
  { id: 35, n: "Chile", img: "assets/sprites/flags/035-chile.png" },
  { id: 36, n: "China", img: "assets/sprites/flags/036-china.png" },
  { id: 37, n: "Chuuk State", img: "assets/sprites/flags/037-chuuk-state.png" },
  { id: 38, n: "Colombia", img: "assets/sprites/flags/038-colombia.png" },
  { id: 39, n: "Comoros", img: "assets/sprites/flags/039-comoros.png" },
  { id: 40, n: "Costa Rica", img: "assets/sprites/flags/040-costa-rica.png" },
  { id: 41, n: "Croatia", img: "assets/sprites/flags/041-croatia.png" },
  { id: 42, n: "Cuba", img: "assets/sprites/flags/042-cuba.png" },
  { id: 43, n: "Curacao", img: "assets/sprites/flags/043-curacao.png" },
  { id: 44, n: "Cyprus", img: "assets/sprites/flags/044-cyprus.png" },
  { id: 45, n: "Czechia", img: "assets/sprites/flags/045-czech-republic.png" },
  { id: 46, n: "DR Congo", img: "assets/sprites/flags/046-democratic-republic-of-the-congo.png" },
  { id: 47, n: "Denmark", img: "assets/sprites/flags/047-denmark.png" },
  { id: 48, n: "Djibouti", img: "assets/sprites/flags/048-djibouti.png" },
  { id: 49, n: "Dominica", img: "assets/sprites/flags/049-dominica.png" },
  { id: 50, n: "Dominican Republic", img: "assets/sprites/flags/050-dominican-republic.png" },
  { id: 51, n: "Ecuador", img: "assets/sprites/flags/051-ecuador.png" },
  { id: 52, n: "Egypt", img: "assets/sprites/flags/052-egypt.png" },
  { id: 53, n: "El Salvador", img: "assets/sprites/flags/053-el-salvador.png" },
  { id: 54, n: "England", img: "assets/sprites/flags/054-england.png" },
  { id: 55, n: "Equatorial Guinea", img: "assets/sprites/flags/055-equatorial-guinea.png" },
  { id: 56, n: "Eritrea", img: "assets/sprites/flags/056-eritrea.png" },
  { id: 57, n: "Estonia", img: "assets/sprites/flags/057-estonia.png" },
  { id: 58, n: "Eswatini", img: "assets/sprites/flags/058-eswatini.png" },
  { id: 59, n: "Ethiopia", img: "assets/sprites/flags/059-ethiopia.png" },
  { id: 60, n: "Faroe Islands", img: "assets/sprites/flags/060-faroe-islands.png" },
  { id: 61, n: "Federated States Of Micronesia", img: "assets/sprites/flags/061-federated-states-of-micronesia.png" },
  { id: 62, n: "Fiji", img: "assets/sprites/flags/062-fiji.png" },
  { id: 63, n: "Finland", img: "assets/sprites/flags/063-finland.png" },
  { id: 64, n: "France", img: "assets/sprites/flags/064-france.png" },
  { id: 65, n: "Gabon", img: "assets/sprites/flags/065-gabon.png" },
  { id: 66, n: "Georgia", img: "assets/sprites/flags/066-georgia.png" },
  { id: 67, n: "Germany", img: "assets/sprites/flags/067-germany.png" },
  { id: 68, n: "Ghana", img: "assets/sprites/flags/068-ghana.png" },
  { id: 69, n: "Greece", img: "assets/sprites/flags/069-greece.png" },
  { id: 70, n: "Greenland", img: "assets/sprites/flags/070-greenland.png" },
  { id: 71, n: "Grenada", img: "assets/sprites/flags/071-grenada.png" },
  { id: 72, n: "Guam", img: "assets/sprites/flags/072-guam.png" },
  { id: 73, n: "Guatemala", img: "assets/sprites/flags/073-guatemala.png" },
  { id: 74, n: "Guinea Bissau", img: "assets/sprites/flags/074-guinea-bissau.png" },
  { id: 75, n: "Guinea", img: "assets/sprites/flags/075-guinea.png" },
  { id: 76, n: "Guyana", img: "assets/sprites/flags/076-guyana.png" },
  { id: 77, n: "Haiti", img: "assets/sprites/flags/077-haiti.png" },
  { id: 78, n: "Honduras", img: "assets/sprites/flags/078-honduras.png" },
  { id: 79, n: "Hungary", img: "assets/sprites/flags/079-hungary.png" },
  { id: 80, n: "Iceland", img: "assets/sprites/flags/080-iceland.png" },
  { id: 81, n: "India", img: "assets/sprites/flags/081-india.png" },
  { id: 82, n: "Indonesia", img: "assets/sprites/flags/082-indonesia.png" },
  { id: 83, n: "Iran", img: "assets/sprites/flags/083-iran.png" },
  { id: 84, n: "Iraq", img: "assets/sprites/flags/084-iraq.png" },
  { id: 85, n: "Israel", img: "assets/sprites/flags/085-israel.png" },
  { id: 86, n: "Italy", img: "assets/sprites/flags/086-italy.png" },
  { id: 87, n: "Ivory Coast", img: "assets/sprites/flags/087-ivory-coast.png" },
  { id: 88, n: "Jamaica", img: "assets/sprites/flags/088-jamaica.png" },
  { id: 89, n: "Japan", img: "assets/sprites/flags/089-japan.png" },
  { id: 90, n: "Jordan", img: "assets/sprites/flags/090-jordan.png" },
  { id: 91, n: "Kazakhstan", img: "assets/sprites/flags/091-kazakhstan.png" },
  { id: 92, n: "Kenya", img: "assets/sprites/flags/092-kenya.png" },
  { id: 93, n: "Kiribati", img: "assets/sprites/flags/093-kiribati.png" },
  { id: 94, n: "Kosovo", img: "assets/sprites/flags/094-kosovo.png" },
  { id: 95, n: "Kosrae", img: "assets/sprites/flags/095-kosrae.png" },
  { id: 96, n: "Kuwait", img: "assets/sprites/flags/096-kuwait.png" },
  { id: 97, n: "Kyrgyzstan", img: "assets/sprites/flags/097-kyrgyzstan.png" },
  { id: 98, n: "Laos", img: "assets/sprites/flags/098-laos.png" },
  { id: 99, n: "Latvia", img: "assets/sprites/flags/099-latvia.png" },
  { id: 100, n: "Lebanon", img: "assets/sprites/flags/100-lebanon.png" },
  { id: 101, n: "Lesotho", img: "assets/sprites/flags/101-lesotho.png" },
  { id: 102, n: "Liberia", img: "assets/sprites/flags/102-liberia.png" },
  { id: 103, n: "Libya", img: "assets/sprites/flags/103-libya.png" },
  { id: 104, n: "Liechtenstein", img: "assets/sprites/flags/104-liechtenstein.png" },
  { id: 105, n: "Lithuania", img: "assets/sprites/flags/105-lithuania.png" },
  { id: 106, n: "Luxembourg", img: "assets/sprites/flags/106-luxembourg.png" },
  { id: 107, n: "Madagascar", img: "assets/sprites/flags/107-madagascar.png" },
  { id: 108, n: "Malawi", img: "assets/sprites/flags/108-malawi.png" },
  { id: 109, n: "Malaysia", img: "assets/sprites/flags/109-malaysia.png" },
  { id: 110, n: "Maldives", img: "assets/sprites/flags/110-maldives.png" },
  { id: 111, n: "Mali", img: "assets/sprites/flags/111-mali.png" },
  { id: 112, n: "Malta", img: "assets/sprites/flags/112-malta.png" },
  { id: 113, n: "Marshall Islands", img: "assets/sprites/flags/113-marshall-islands.png" },
  { id: 114, n: "Mauritania", img: "assets/sprites/flags/114-mauritania.png" },
  { id: 115, n: "Mauritius", img: "assets/sprites/flags/115-mauritius.png" },
  { id: 116, n: "Mexico", img: "assets/sprites/flags/116-mexico.png" },
  { id: 117, n: "Moldova", img: "assets/sprites/flags/117-moldova.png" },
  { id: 118, n: "Monaco", img: "assets/sprites/flags/118-monaco.png" },
  { id: 119, n: "Mongolia", img: "assets/sprites/flags/119-mongolia.png" },
  { id: 120, n: "Montenegro", img: "assets/sprites/flags/120-montenegro.png" },
  { id: 121, n: "Morocco", img: "assets/sprites/flags/121-morocco.png" },
  { id: 122, n: "Mozambique", img: "assets/sprites/flags/122-mozambique.png" },
  { id: 123, n: "Myanmar", img: "assets/sprites/flags/123-myanmar.png" },
  { id: 124, n: "Namibia", img: "assets/sprites/flags/124-namibia.png" },
  { id: 125, n: "Nauru", img: "assets/sprites/flags/125-nauru.png" },
  { id: 126, n: "Nepal", img: "assets/sprites/flags/126-nepal.png" },
  { id: 127, n: "Netherlands", img: "assets/sprites/flags/127-netherlands.png" },
  { id: 128, n: "New Zealand", img: "assets/sprites/flags/128-new-zealand.png" },
  { id: 129, n: "Nicaragua", img: "assets/sprites/flags/129-nicaragua.png" },
  { id: 130, n: "Niger", img: "assets/sprites/flags/130-niger.png" },
  { id: 131, n: "Nigeria", img: "assets/sprites/flags/131-nigeria.png" },
  { id: 132, n: "North Korea", img: "assets/sprites/flags/132-north-korea.png" },
  { id: 133, n: "N. Macedonia", img: "assets/sprites/flags/133-north-macedonia.png" },
  { id: 134, n: "Norway", img: "assets/sprites/flags/134-norway.png" },
  { id: 135, n: "Oman", img: "assets/sprites/flags/135-oman.png" },
  { id: 136, n: "Pakistan", img: "assets/sprites/flags/136-pakistan.png" },
  { id: 137, n: "Palau", img: "assets/sprites/flags/137-palau.png" },
  { id: 138, n: "Palestine", img: "assets/sprites/flags/138-palestine.png" },
  { id: 139, n: "Panama", img: "assets/sprites/flags/139-panama.png" },
  { id: 140, n: "Papua New Guinea", img: "assets/sprites/flags/140-papua-new-guinea.png" },
  { id: 141, n: "Paraguay", img: "assets/sprites/flags/141-paraguay.png" },
  { id: 142, n: "Peru", img: "assets/sprites/flags/142-peru.png" },
  { id: 143, n: "Philippines", img: "assets/sprites/flags/143-philippines.png" },
  { id: 144, n: "Pohnpei State", img: "assets/sprites/flags/144-pohnpei-state.png" },
  { id: 145, n: "Poland", img: "assets/sprites/flags/145-poland.png" },
  { id: 146, n: "Portugal", img: "assets/sprites/flags/146-portugal.png" },
  { id: 147, n: "Puerto Rico", img: "assets/sprites/flags/147-puerto-rico.png" },
  { id: 148, n: "Qatar", img: "assets/sprites/flags/148-qatar.png" },
  { id: 149, n: "Republic Of Ireland", img: "assets/sprites/flags/149-republic-of-ireland.png" },
  { id: 150, n: "Congo", img: "assets/sprites/flags/150-republic-of-the-congo.png" },
  { id: 151, n: "Republika Srpska", img: "assets/sprites/flags/151-republika-srpska.png" },
  { id: 152, n: "Romania", img: "assets/sprites/flags/152-romania.png" },
  { id: 153, n: "Russia", img: "assets/sprites/flags/153-russia.png" },
  { id: 154, n: "Rwanda", img: "assets/sprites/flags/154-rwanda.png" },
  { id: 155, n: "Saint Kitts And Nevis", img: "assets/sprites/flags/155-saint-kitts-and-nevis.png" },
  { id: 156, n: "Saint Lucia", img: "assets/sprites/flags/156-saint-lucia.png" },
  { id: 157, n: "St Vincent", img: "assets/sprites/flags/157-saint-vincent-and-the-grenadines.png" },
  { id: 158, n: "Samoa", img: "assets/sprites/flags/158-samoa.png" },
  { id: 159, n: "San Marino", img: "assets/sprites/flags/159-san-marino.png" },
  { id: 160, n: "Saudi Arabia", img: "assets/sprites/flags/160-saudi-arabia.png" },
  { id: 161, n: "Scotland", img: "assets/sprites/flags/161-scotland.png" },
  { id: 162, n: "Senegal", img: "assets/sprites/flags/162-senegal.png" },
  { id: 163, n: "Serbia", img: "assets/sprites/flags/163-serbia.png" },
  { id: 164, n: "Seychelles", img: "assets/sprites/flags/164-seychelles.png" },
  { id: 165, n: "Sierra Leone", img: "assets/sprites/flags/165-sierra-leone.png" },
  { id: 166, n: "Singapore", img: "assets/sprites/flags/166-singapore.png" },
  { id: 167, n: "Sint Maarten", img: "assets/sprites/flags/167-sint-maarten.png" },
  { id: 168, n: "Slovakia", img: "assets/sprites/flags/168-slovakia.png" },
  { id: 169, n: "Slovenia", img: "assets/sprites/flags/169-slovenia.png" },
  { id: 170, n: "Solomon Islands", img: "assets/sprites/flags/170-solomon-islands.png" },
  { id: 171, n: "Somalia", img: "assets/sprites/flags/171-somalia.png" },
  { id: 172, n: "South Africa", img: "assets/sprites/flags/172-south-africa.png" },
  { id: 173, n: "South Korea", img: "assets/sprites/flags/173-south-korea.png" },
  { id: 174, n: "South Sudan", img: "assets/sprites/flags/174-south-sudan.png" },
  { id: 175, n: "Spain", img: "assets/sprites/flags/175-spain.png" },
  { id: 176, n: "Sri Lanka", img: "assets/sprites/flags/176-sri-lanka.png" },
  { id: 177, n: "Sudan", img: "assets/sprites/flags/177-sudan.png" },
  { id: 178, n: "Suriname", img: "assets/sprites/flags/178-suriname.png" },
  { id: 179, n: "Sweden", img: "assets/sprites/flags/179-sweden.png" },
  { id: 180, n: "Switzerland", img: "assets/sprites/flags/180-switzerland.png" },
  { id: 181, n: "Syria", img: "assets/sprites/flags/181-syria.png" },
  { id: 182, n: "Sao Tome And Principe", img: "assets/sprites/flags/182-sao-tome-and-principe.png" },
  { id: 183, n: "Tajikistan", img: "assets/sprites/flags/183-tajikistan.png" },
  { id: 184, n: "Tanzania", img: "assets/sprites/flags/184-tanzania.png" },
  { id: 185, n: "Thailand", img: "assets/sprites/flags/185-thailand.png" },
  { id: 186, n: "The Bahamas", img: "assets/sprites/flags/186-the-bahamas.png" },
  { id: 187, n: "The Gambia", img: "assets/sprites/flags/187-the-gambia.png" },
  { id: 188, n: "Timor Leste", img: "assets/sprites/flags/188-timor-leste.png" },
  { id: 189, n: "Togo", img: "assets/sprites/flags/189-togo.png" },
  { id: 190, n: "Tonga", img: "assets/sprites/flags/190-tonga.png" },
  { id: 191, n: "Trinidad", img: "assets/sprites/flags/191-trinidad-and-tobago.png" },
  { id: 192, n: "Tunisia", img: "assets/sprites/flags/192-tunisia.png" },
  { id: 193, n: "Turkey", img: "assets/sprites/flags/193-turkey.png" },
  { id: 194, n: "Turkmenistan", img: "assets/sprites/flags/194-turkmenistan.png" },
  { id: 195, n: "Tuvalu", img: "assets/sprites/flags/195-tuvalu.png" },
  { id: 196, n: "Uganda", img: "assets/sprites/flags/196-uganda.png" },
  { id: 197, n: "Ukraine", img: "assets/sprites/flags/197-ukraine.png" },
  { id: 198, n: "UAE", img: "assets/sprites/flags/198-united-arab-emirates.png" },
  { id: 199, n: "UK", img: "assets/sprites/flags/199-united-kingdom.png" },
  { id: 200, n: "USA", img: "assets/sprites/flags/200-united-states-of-america.png" },
  { id: 201, n: "United States Virgin Islands", img: "assets/sprites/flags/201-united-states-virgin-islands.png" },
  { id: 202, n: "Uruguay", img: "assets/sprites/flags/202-uruguay.png" },
  { id: 203, n: "Uzbekistan", img: "assets/sprites/flags/203-uzbekistan.png" },
  { id: 204, n: "Vanuatu", img: "assets/sprites/flags/204-vanuatu.png" },
  { id: 205, n: "Vatican City", img: "assets/sprites/flags/205-vatican-city.png" },
  { id: 206, n: "Venezuela", img: "assets/sprites/flags/206-venezuela.png" },
  { id: 207, n: "Vietnam", img: "assets/sprites/flags/207-vietnam.png" },
  { id: 208, n: "Wales", img: "assets/sprites/flags/208-wales.png" },
  { id: 209, n: "Yap State", img: "assets/sprites/flags/209-yap-state.png" },
  { id: 210, n: "Yemen", img: "assets/sprites/flags/210-yemen.png" },
  { id: 211, n: "Zambia", img: "assets/sprites/flags/211-zambia.png" },
  { id: 212, n: "Zimbabwe", img: "assets/sprites/flags/212-zimbabwe.png" }
];
const BRAND_SPRITES = [
  { id: 1, n: "Instagram", img: "assets/sprites/brands/01-instagram.png" },
  { id: 2, n: "Kodak", img: "assets/sprites/brands/02-kodak.png" },
  { id: 3, n: "Linux", img: "assets/sprites/brands/03-linux.png" },
  { id: 4, n: "Maserati", img: "assets/sprites/brands/04-maserati.png" },
  { id: 5, n: "McDonald's", img: "assets/sprites/brands/05-mcdonalds.png" },
  { id: 6, n: "Microsoft", img: "assets/sprites/brands/06-microsoft.png" },
  { id: 7, n: "MTV", img: "assets/sprites/brands/07-mtv.png" },
  { id: 8, n: "Netflix", img: "assets/sprites/brands/08-netflix.png" },
  { id: 9, n: "P&G", img: "assets/sprites/brands/09-pandg.png" },
  { id: 10, n: "Pepsi", img: "assets/sprites/brands/10-pepsi.png" },
  { id: 11, n: "Philips", img: "assets/sprites/brands/11-philips.png" },
  { id: 12, n: "Pringles", img: "assets/sprites/brands/12-pringles.png" },
  { id: 13, n: "Shell", img: "assets/sprites/brands/13-shell.png" },
  { id: 14, n: "Starbucks", img: "assets/sprites/brands/14-starbucks.png" },
  { id: 15, n: "Target", img: "assets/sprites/brands/15-target.png" },
  { id: 16, n: "Uber", img: "assets/sprites/brands/16-uber.png" },
  { id: 17, n: "Unilever", img: "assets/sprites/brands/17-unilever.png" },
  { id: 18, n: "UPS", img: "assets/sprites/brands/18-ups.png" },
  { id: 19, n: "Volkswagen", img: "assets/sprites/brands/19-volkswagen.png" },
  { id: 20, n: "Yamaha", img: "assets/sprites/brands/20-yamaha.png" },
  { id: 21, n: "YouTube", img: "assets/sprites/brands/21-youtube.png" },
  { id: 22, n: "Adidas Original", img: "assets/sprites/brands/22-adidas-original.png" },
  { id: 23, n: "Apple", img: "assets/sprites/brands/23-apple.png" },
  { id: 24, n: "BMW", img: "assets/sprites/brands/24-bmw.png" },
  { id: 25, n: "Caltex", img: "assets/sprites/brands/25-caltex.png" },
  { id: 26, n: "ChatGPT", img: "assets/sprites/brands/26-chatgpt.png" },
  { id: 27, n: "Donki", img: "assets/sprites/brands/27-donki.png" },
  { id: 28, n: "Dairy Queen", img: "assets/sprites/brands/28-dq.png" },
  { id: 29, n: "Facebook", img: "assets/sprites/brands/29-facebook.png" },
  { id: 30, n: "Honda", img: "assets/sprites/brands/30-honda.png" },
];
const TOOLS_SPRITES = [
  { id: 1, n: "Excavator", img: "assets/sprites/tools/01-excavator.png" },
  { id: 2, n: "Forklift", img: "assets/sprites/tools/02-forklift.png" },
  { id: 3, n: "Generator", img: "assets/sprites/tools/03-generator.png" },
  { id: 4, n: "Glove", img: "assets/sprites/tools/04-glove.png" },
  { id: 5, n: "Hammer", img: "assets/sprites/tools/05-hammer.png" },
  { id: 6, n: "Hinge", img: "assets/sprites/tools/06-hinge.png" },
  { id: 7, n: "Jackhammer", img: "assets/sprites/tools/07-jackhammer.png" },
  { id: 8, n: "Ladder", img: "assets/sprites/tools/08-ladder.png" },
  { id: 9, n: "Level", img: "assets/sprites/tools/09-level.png" },
  { id: 10, n: "Nail Gun", img: "assets/sprites/tools/10-nail-gun.png" },
  { id: 11, n: "Pile", img: "assets/sprites/tools/11-pile.png" },
  { id: 12, n: "Plier", img: "assets/sprites/tools/12-plier.png" },
  { id: 13, n: "Power Drill", img: "assets/sprites/tools/13-power-drill.png" },
  { id: 14, n: "Safety Goggles", img: "assets/sprites/tools/14-safety-goggles.png" },
  { id: 15, n: "Safety Helmet", img: "assets/sprites/tools/15-safety-helmet.png" },
  { id: 16, n: "Screwdriver", img: "assets/sprites/tools/16-screwdriver.png" },
  { id: 17, n: "Silicone Gun", img: "assets/sprites/tools/17-silicone-gun.png" },
  { id: 18, n: "Tape Measure", img: "assets/sprites/tools/18-tape-measure.png" },
  { id: 19, n: "Toolbox", img: "assets/sprites/tools/19-toolbox.png" },
  { id: 20, n: "Tower Crane", img: "assets/sprites/tools/20-tower-crane.png" },
  { id: 21, n: "US Socket", img: "assets/sprites/tools/21-us-socket.png" },
  { id: 22, n: "Wrench", img: "assets/sprites/tools/22-wrench.png" },
  { id: 23, n: "Blueprints", img: "assets/sprites/tools/23-blueprints.png" },
  { id: 24, n: "Boots", img: "assets/sprites/tools/24-boots.png" },
  { id: 25, n: "Bricks", img: "assets/sprites/tools/25-bricks.png" },
  { id: 26, n: "Bulldozer", img: "assets/sprites/tools/26-bulldozer.png" },
  { id: 27, n: "Cement Mixer", img: "assets/sprites/tools/27-cement-mixer.png" },
  { id: 28, n: "Clamp", img: "assets/sprites/tools/28-clamp.png" },
  { id: 29, n: "Dump Truck", img: "assets/sprites/tools/29-dump-truck.png" },
  { id: 30, n: "European Socket", img: "assets/sprites/tools/30-european-socket.png" },
];
const TRAVEL_SPRITES = [
  { id: 1, n: "Airplane", img: "assets/sprites/travel/01-airplane.png" },
  { id: 2, n: "Shinkansen", img: "assets/sprites/travel/02-shinkansen.png" },
  { id: 3, n: "Suitcase", img: "assets/sprites/travel/03-suitcase.png" },
  { id: 4, n: "Backpack", img: "assets/sprites/travel/04-backpack.png" },
  { id: 5, n: "Water Bottle", img: "assets/sprites/travel/05-water-bottle.png" },
  { id: 6, n: "Sweater", img: "assets/sprites/travel/06-sweater.png" },
  { id: 7, n: "Headphone", img: "assets/sprites/travel/07-headphone.png" },
  { id: 8, n: "Sweatpant", img: "assets/sprites/travel/08-sweatpant.png" },
  { id: 9, n: "Jacket", img: "assets/sprites/travel/09-jacket.png" },
  { id: 10, n: "Toiletry Set", img: "assets/sprites/travel/10-toiletry-set.png" },
  { id: 11, n: "Flip Flops", img: "assets/sprites/travel/11-flip-flops.png" },
  { id: 12, n: "Diving Goggles", img: "assets/sprites/travel/12-diving-goggles.png" },
  { id: 13, n: "Action Camera", img: "assets/sprites/travel/13-action-camera.png" },
  { id: 14, n: "Surf Board", img: "assets/sprites/travel/14-surf-board.png" },
  { id: 15, n: "DSLR Camera", img: "assets/sprites/travel/15-dslr-camera.png" },
  { id: 16, n: "Beach Ball", img: "assets/sprites/travel/16-beach-ball.png" },
  { id: 17, n: "Propeller Plane", img: "assets/sprites/travel/17-propeller-plane.png" },
  { id: 18, n: "Passport", img: "assets/sprites/travel/18-passport.png" },
  { id: 19, n: "Boarding Passes", img: "assets/sprites/travel/19-boarding-passes.png" },
  { id: 20, n: "First Aid Set", img: "assets/sprites/travel/20-first-aid-set.png" },
  { id: 21, n: "Universal Adaptor", img: "assets/sprites/travel/21-universal-adaptor.png" },
  { id: 22, n: "Packaged Snacks", img: "assets/sprites/travel/22-packaged-snacks.png" },
  { id: 23, n: "Aviator Sunglasses", img: "assets/sprites/travel/23-aviator-sunglasses.png" },
  { id: 24, n: "Neck Pillow", img: "assets/sprites/travel/24-neck-pillow.png" },
  { id: 25, n: "Yellow Cab", img: "assets/sprites/travel/25-yellow-cab.png" },
  { id: 26, n: "TSA Lock", img: "assets/sprites/travel/26-tsa-lock.png" },
  { id: 27, n: "Route 66 Sign", img: "assets/sprites/travel/27-route-66-sign.png" },
  { id: 28, n: "Beach Bed", img: "assets/sprites/travel/28-beach-bed.png" },
  { id: 29, n: "Disposable Camera", img: "assets/sprites/travel/29-disposable-camera.png" },
  { id: 30, n: "Postcard", img: "assets/sprites/travel/30-postcard.png" },
];
const SPRITE_SETS = {
  original: {
    name: "POKEMON",
    label: "Pokémon sprites",
    sprites: SPRITES,
    scale: 0.85,
  },
  brands: {
    name: "BRANDS",
    label: "Brand logo sprites",
    sprites: BRAND_SPRITES,
    scale: 1.12,
  },
  flags: {
    name: "FLAGS",
    label: "World flag sprites",
    sprites: FLAGS_SPRITES,
    scale: 1,
  },
  foodies: {
    name: "FOODIES 1",
    label: "Foodies 1 sprites",
    sprites: [
      { id: 1, n: "Beer", img: "assets/sprites/foodies/01-beer.png" },
      { id: 2, n: "Bento", img: "assets/sprites/foodies/02-bento.png" },
      {
        id: 3,
        n: "Boba Milk Tea",
        img: "assets/sprites/foodies/03-boba-milk-tea.png",
      },
      { id: 4, n: "Burger", img: "assets/sprites/foodies/04-burger.png" },
      { id: 5, n: "Cheese", img: "assets/sprites/foodies/05-cheese.png" },
      {
        id: 6,
        n: "Chocolate Bar",
        img: "assets/sprites/foodies/06-chocolate-bar.png",
      },
      { id: 7, n: "Coffee", img: "assets/sprites/foodies/07-coffee.png" },
      { id: 8, n: "Cupcake", img: "assets/sprites/foodies/08-cupcake.png" },
      { id: 9, n: "Custard", img: "assets/sprites/foodies/09-custard.png" },
      { id: 10, n: "Donut", img: "assets/sprites/foodies/10-donut.png" },
      {
        id: 11,
        n: "French Fries",
        img: "assets/sprites/foodies/11-french-fries.png",
      },
      { id: 12, n: "Grape", img: "assets/sprites/foodies/12-grape.png" },
      { id: 13, n: "Hotdog", img: "assets/sprites/foodies/13-hotdog.png" },
      {
        id: 14,
        n: "Ice Cream",
        img: "assets/sprites/foodies/14-ice-cream.png",
      },
      { id: 15, n: "Lollipop", img: "assets/sprites/foodies/15-lollipop.png" },
      { id: 16, n: "Macaron", img: "assets/sprites/foodies/16-macaron.png" },
      { id: 17, n: "Milk", img: "assets/sprites/foodies/17-milk.png" },
      { id: 18, n: "Orange", img: "assets/sprites/foodies/18-orange.png" },
      { id: 19, n: "Pizza", img: "assets/sprites/foodies/19-pizza.png" },
      { id: 20, n: "Popcorn", img: "assets/sprites/foodies/20-popcorn.png" },
      { id: 21, n: "Ramen", img: "assets/sprites/foodies/21-ramen.png" },
      { id: 22, n: "Sandwich", img: "assets/sprites/foodies/22-sandwich.png" },
      { id: 23, n: "Soda", img: "assets/sprites/foodies/23-soda.png" },
      {
        id: 24,
        n: "Strawberry",
        img: "assets/sprites/foodies/24-strawberry.png",
      },
      { id: 25, n: "Sushi", img: "assets/sprites/foodies/25-sushi.png" },
      { id: 26, n: "Taco", img: "assets/sprites/foodies/26-taco.png" },
      { id: 27, n: "Waffle", img: "assets/sprites/foodies/27-waffle.png" },
      {
        id: 28,
        n: "Watermelon",
        img: "assets/sprites/foodies/28-watermelon.png",
      },
      { id: 29, n: "Apple", img: "assets/sprites/foodies/29-apple.png" },
      { id: 30, n: "Banana", img: "assets/sprites/foodies/30-banana.png" },
    ],
    scale: 1,
  },
  foodies2: {
    name: "FOODIES 2",
    label: "Foodies 2 sprites",
    sprites: [
      { id: 1, n: "BBQ Sauce", img: "assets/sprites/foodies2/01-bbq-sauce.png" },
      { id: 2, n: "Beer Can", img: "assets/sprites/foodies2/02-beer-can.png" },
      { id: 3, n: "Beer", img: "assets/sprites/foodies2/03-beer.png" },
      { id: 4, n: "Blueberry Donut", img: "assets/sprites/foodies2/04-blueberry-donut.png" },
      { id: 5, n: "Cake", img: "assets/sprites/foodies2/05-cake.png" },
      { id: 6, n: "Canned Tuna", img: "assets/sprites/foodies2/06-canned-tuna.png" },
      { id: 7, n: "Cheese Burger", img: "assets/sprites/foodies2/07-cheese-burger.png" },
      { id: 8, n: "Chocolate Sundae", img: "assets/sprites/foodies2/08-chocolate-sundae.png" },
      { id: 9, n: "Croissant", img: "assets/sprites/foodies2/09-croissant.png" },
      { id: 10, n: "Cup Noodle", img: "assets/sprites/foodies2/10-cup-noodle.png" },
      { id: 11, n: "Fortune Cookie", img: "assets/sprites/foodies2/11-fortune-cookie.png" },
      { id: 12, n: "Grilled Chicken", img: "assets/sprites/foodies2/12-grilled-chicken.png" },
      { id: 13, n: "Ice cream Bowl", img: "assets/sprites/foodies2/13-ice-cream-bowl.png" },
      { id: 14, n: "Ice cream Cone", img: "assets/sprites/foodies2/14-ice-cream-cone.png" },
      { id: 15, n: "Ketchup", img: "assets/sprites/foodies2/15-ketchup.png" },
      { id: 16, n: "Lollipop", img: "assets/sprites/foodies2/16-lollipop.png" },
      { id: 17, n: "Milk Shake", img: "assets/sprites/foodies2/17-milk-shake.png" },
      { id: 18, n: "Mustard", img: "assets/sprites/foodies2/18-mustard.png" },
      { id: 19, n: "Parma Ham", img: "assets/sprites/foodies2/19-parma-ham.png" },
      { id: 20, n: "Pineapple", img: "assets/sprites/foodies2/20-pineapple.png" },
      { id: 21, n: "Salad", img: "assets/sprites/foodies2/21-salad.png" },
      { id: 22, n: "Soft Serve", img: "assets/sprites/foodies2/22-soft-serve.png" },
      { id: 23, n: "Soup", img: "assets/sprites/foodies2/23-soup.png" },
      { id: 24, n: "Strawberry Donut", img: "assets/sprites/foodies2/24-strawberry-donut.png" },
      { id: 25, n: "Sunny Side Up", img: "assets/sprites/foodies2/25-sunny-side-up.png" },
      { id: 26, n: "Sushi", img: "assets/sprites/foodies2/26-sushi.png" },
      { id: 27, n: "Tempura", img: "assets/sprites/foodies2/27-tempura.png" },
      { id: 28, n: "Tuna Sandwich", img: "assets/sprites/foodies2/28-tuna-sandwich.png" },
      { id: 29, n: "Watermelon", img: "assets/sprites/foodies2/29-watermelon.png" },
      { id: 30, n: "Yakiniku", img: "assets/sprites/foodies2/30-yakiniku.png" },
    ],
    scale: 1,
  },
  football: {
    name: "FOOTBALL",
    label: "Football club logo sprites",
    sprites: [
      { id: 1, n: "AC Milan", img: "assets/sprites/football/01-ac-milan.png" },
      { id: 2, n: "Ajax Amsterdam", img: "assets/sprites/football/02-ajax-amsterdam.png" },
      { id: 3, n: "Arsenal", img: "assets/sprites/football/03-arsenal.png" },
      { id: 4, n: "Atalanta", img: "assets/sprites/football/04-atalanta.png" },
      { id: 5, n: "Atletico Madrid", img: "assets/sprites/football/05-atletico-madrid.png" },
      { id: 6, n: "Barcelona", img: "assets/sprites/football/06-barcelona.png" },
      { id: 7, n: "Bayer Leverkusen", img: "assets/sprites/football/07-bayer-leverkusen.png" },
      { id: 8, n: "Bayern Munich", img: "assets/sprites/football/08-bayern-munich.png" },
      { id: 9, n: "Blackburn Rovers", img: "assets/sprites/football/09-blackburn-rovers.png" },
      { id: 10, n: "Borussia Dortmund", img: "assets/sprites/football/10-borussia-dortmund.png" },
      { id: 11, n: "Brentford", img: "assets/sprites/football/11-brentford.png" },
      { id: 12, n: "Brighton", img: "assets/sprites/football/12-brighton.png" },
      { id: 13, n: "Chelsea", img: "assets/sprites/football/13-chelsea.png" },
      { id: 14, n: "Derby County", img: "assets/sprites/football/14-derby-county.png" },
      { id: 15, n: "Everton", img: "assets/sprites/football/15-everton.png" },
      { id: 16, n: "Inter Milan", img: "assets/sprites/football/16-inter-milan.png" },
      { id: 17, n: "Juventus", img: "assets/sprites/football/17-juventus.png" },
      { id: 18, n: "Leeds United", img: "assets/sprites/football/18-leeds-united.png" },
      { id: 19, n: "Leicester City", img: "assets/sprites/football/19-leicester-city.png" },
      { id: 20, n: "Liverpool", img: "assets/sprites/football/20-liverpool.png" },
      { id: 21, n: "Manchester City", img: "assets/sprites/football/21-manchester-city.png" },
      { id: 22, n: "Manchester United", img: "assets/sprites/football/22-manchester-united.png" },
      { id: 23, n: "Marseille", img: "assets/sprites/football/23-marseille.png" },
      { id: 24, n: "Middlesbrough", img: "assets/sprites/football/24-middlesbrough.png" },
      { id: 25, n: "Napoli", img: "assets/sprites/football/25-napoli.png" },
      { id: 26, n: "Newcastle United", img: "assets/sprites/football/26-newcastle-united.png" },
      { id: 27, n: "Nottingham Forest", img: "assets/sprites/football/27-nottingham-forest.png" },
      { id: 28, n: "Olympiacos", img: "assets/sprites/football/28-olympiacos.png" },
      { id: 29, n: "Paris Saint-Germain", img: "assets/sprites/football/29-paris-saint-germain.png" },
      { id: 30, n: "Rangers", img: "assets/sprites/football/30-rangers.png" },
      { id: 31, n: "Real Madrid", img: "assets/sprites/football/31-real-madrid.png" },
      { id: 32, n: "Salzburg", img: "assets/sprites/football/32-salzburg.png" },
      { id: 33, n: "Tottenham Hotspur", img: "assets/sprites/football/33-tottenham-hotspur.png" },
      { id: 34, n: "West Ham United", img: "assets/sprites/football/34-west-ham-united.png" },
      { id: 35, n: "Wolverhampton Wanderers", img: "assets/sprites/football/35-wolverhampton-wanderers.png" },
    ],
    scale: 1.12,
  },
  gadgets: {
    name: "GADGETS",
    label: "Optimized gadget sprites",
    sprites: GADGET_SPRITES,
    scale: 1,
  },
  home: {
    name: "HOME",
    label: "Home sprites",
    sprites: HOME_SPRITES,
    scale: 1,
  },
  sports: {
    name: "SPORTS",
    label: "Optimized sports sprites",
    sprites: SPORTS_SPRITES,
    scale: 1.24,
  },
  tools: {
    name: "TOOLS",
    label: "Tools sprites",
    sprites: TOOLS_SPRITES,
    scale: 1,
  },
  travel: {
    name: "TRAVEL",
    label: "Travel item sprites",
    sprites: TRAVEL_SPRITES,
    scale: 1,
  },
};
let currentSpriteSetId = determineInitialSpriteSet();
let entities = [];

function buildEntities(setId) {
  const set = SPRITE_SETS[setId] || SPRITE_SETS.flags;
  return set.sprites.map((e) => ({
    id: e.id,
    name: e.n,
    img: e.img,
    scale: e.scale || set.scale || 0.85,
  }));
}

function applySpriteSet(setId, opts = {}) {
  currentSpriteSetId = "flags";
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
  return "flags";
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
const movementIconEl = $("movementIcon");

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
const COMBO_POINTS = [100, 150, 200, 300, 400, 500];
const TIME_BONUS_PER_SECOND = 50;
const PERFECT_BONUS = 5000;
let isQuickGame = false,
  currentSaveSlotId = null;
let nextLevelReadyAfterComplete = false;
let scoreHistory = [];
let currentStrategy = STRATEGIES[0];

function getLevelTime(lvl) {
  const safeLevel = Math.max(1, Number(lvl) || 1);
  // Levels 1-48 stay at 8:00. From Level 49 onward, reduce by
  // 15 seconds every 48 levels, with 7:00 as the shortest allowance.
  const reductionBlocks = Math.max(0, Math.floor((safeLevel - 1) / TIMER_REDUCTION_LEVEL_BLOCK));
  const seconds = TOTAL_TIME - reductionBlocks * TIMER_REDUCTION_STEP;
  return Math.max(MIN_LEVEL_TIME, seconds);
}

function getMainGameUniqueFlagCount(lvl) {
  const safeLevel = Math.max(1, Number(lvl) || 1);
  const stepIndex = Math.min(
    MAIN_GAME_UNIQUE_FLAG_STEPS.length - 1,
    Math.floor((safeLevel - 1) / LEVEL_LOOP_SIZE)
  );
  return MAIN_GAME_UNIQUE_FLAG_STEPS[stepIndex];
}

function getBoardUniqueFlagCount(lvl) {
  return isQuickGame ? QUICK_GAME_UNIQUE_FLAGS : getMainGameUniqueFlagCount(lvl);
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
  // Toggle empty/dimmed state on buttons when count hits 0
  const hintBtn = $("hintBtn");
  const shuffleBtn = $("shuffleBtn");
  if (hintBtn) hintBtn.classList.toggle("empty", hintCount <= 0);
  if (shuffleBtn) shuffleBtn.classList.toggle("empty", shuffleCount <= 0);
}
function refillHelpersAfterClearedLevel(clearedLevel, perfectClear = false) {
  let changed = false;

  // Locked FMW helper refill rules:
  // - Complete every 3 levels: +1 Hint
  // - Complete every 5 levels: +1 Shuffle
  // - Complete each 8-level movement cycle: +2 Hints +1 Shuffle
  // - Perfect clear / no helper used: +1 Hint
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
  if (muted) return;
  const a = uiAudio[name];
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    a.muted = muted;
    a.play().catch(() => {});
  } catch (e) {}
}

let bgmPausedByLifecycle = false;
let bgmWasPlayingBeforeLifecyclePause = false;
let bgmResumeRetryTimer = null;

function canPlayBgmNow() {
  return !muted && gameStarted && !paused && !document.hidden;
}

function playBgmIfAllowed() {
  if (!canPlayBgmNow()) return;
  try {
    bgm.muted = false;
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
    bgmWasPlayingBeforeLifecyclePause || (!muted && !bgm.paused);
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
    const slot = SPRITE_SETS[old.spriteSet] ? old.spriteSet : "original";
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
  return isQuickGame ? "quick" : `set:${currentSpriteSetId || "original"}`;
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
  return getSaveForSet("flags") ? "flags" : null;
}

function determineInitialSpriteSet() {
  migrateLegacySave();
  const latest = getLatestSavedSetId();
  if (latest) return latest;
  return "flags";
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
    score,
    levelScore,
    timeLeft,
    levelTotalTime,
    hintCount,
    shuffleCount,
    comboCount,
    lastMatchAt,
    bestCombo,
    usedHintLvl,
    usedShuffLvl,
    strategyId: currentStrategy.id,
    theme: currentTheme,
    spriteSet: slot,
    board: serializeBoard(),
    scoreHistory,
    freshLevelCheckpoint: !!saveMode.freshLevelCheckpoint,
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

function persistHelperInventoryOnly() {
  if (isQuickGame) return;
  const slot = SPRITE_SETS[currentSaveSlotId] ? currentSaveSlotId : currentSpriteSetId;
  const saves = loadAllSaves();
  const save = saves[slot];
  if (!save) return;
  save.hintCount = hintCount;
  save.shuffleCount = shuffleCount;
  save.usedHintLvl = usedHintLvl;
  save.usedShuffLvl = usedShuffLvl;
  save.ts = Date.now();
  saves[slot] = save;
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
  applySpriteSet(save.spriteSet || "original");
  currentSaveSlotId = save.spriteSet || currentSpriteSetId;
  isQuickGame = false;
  level = save.level;
  score = save.score;
  levelScore = save.levelScore || 0;
  // Always recalculate from current rules so old saves cannot preserve legacy timer values.
  levelTotalTime = getLevelTime(level);
  timeLeft = save.freshLevelCheckpoint ? levelTotalTime : Math.min(save.timeLeft || levelTotalTime, levelTotalTime);
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
  currentStrategy =
    STRATEGIES.find((s) => s.id === save.strategyId) || STRATEGIES[0];
  if (save.freshLevelCheckpoint) {
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
  return `${currentSpriteSetId || "original"}|${level || 1}`;
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

function buildRandomPairPool(sourceEntities, pairCount, uniqueCount = pairCount) {
  const pool = [];

  if (!Array.isArray(sourceEntities) || sourceEntities.length === 0) {
    return pool;
  }

  const limitedUniqueCount = Math.max(
    1,
    Math.min(uniqueCount, pairCount, sourceEntities.length)
  );

  // First choose exactly the required number of unique flags for this level.
  // Then distribute the 72 pairs as evenly as possible across that selected set.
  // Example: level 1 uses 24 flags × 3 pairs each = 72 pairs.
  const selectedEntities = shuf([...sourceEntities]).slice(0, limitedUniqueCount);
  const basePairsPerFlag = Math.floor(pairCount / selectedEntities.length);
  const extraPairs = pairCount % selectedEntities.length;
  const extraIndexes = new Set(
    shuf([...selectedEntities.keys()]).slice(0, extraPairs)
  );

  selectedEntities.forEach((entity, index) => {
    const repeats = basePairsPerFlag + (extraIndexes.has(index) ? 1 : 0);
    for (let i = 0; i < repeats; i++) {
      pool.push(entity);
    }
  });

  return shuf(pool);
}

function createBoard() {
  const pairCount = (ROWS * COLS) / 2;
  const previousSignature = getRecentBoardSignature();
  let values = [];
  let signature = "";

  // Retry a few times if the exact same board somehow appears for the same
  // sprite set + level in the current session. This is mostly a guard; with
  // crypto randomness the repeat chance is already extremely small.
  for (let attempt = 0; attempt < 8; attempt++) {
    const uniqueFlagCount = getBoardUniqueFlagCount(level);
    const selectedPairs = buildRandomPairPool(entities, pairCount, uniqueFlagCount);
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


// Small QA helper for browser console checks during development.
// Example: __fmwDebug.expectedUniqueFlagsForLevel(1) -> 24
//          __fmwDebug.currentBoardUniqueFlags() -> current visible unique flag count
window.__fmwDebug = {
  expectedUniqueFlagsForLevel: getMainGameUniqueFlagCount,
  expectedBoardUniqueFlagsForLevel: (lvl, quick = false) =>
    quick ? QUICK_GAME_UNIQUE_FLAGS : getMainGameUniqueFlagCount(lvl),
  currentBoardUniqueFlags: () => {
    try {
      return new Set(
        board.flat()
          .filter((tile) => tile && !tile.removed && tile.entity)
          .map((tile) => tile.entity.id),
      ).size;
    } catch (e) {
      return 0;
    }
  },
  helperInventory: () => ({ hints: hintCount, shuffles: shuffleCount }),
  movementRuleForLevel: (lvl) => getStrategy(lvl).name,
};

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

function setSelectedCountryName(name) {
  const pill = $("countryNamePill");
  if (!pill) return;
  const clean = String(name || "").trim();
  pill.textContent = clean ? clean.toUpperCase() : "SELECT A FLAG";
  pill.classList.toggle("active", !!clean);
  pill.classList.toggle("has-selection", !!clean);
  // Shrink font for very long names
  if (clean.length > 22) {
    pill.style.fontSize = "clamp(9px, 1.1vw, 11px)";
    pill.style.letterSpacing = ".04em";
  } else if (clean.length > 16) {
    pill.style.fontSize = "clamp(10px, 1.3vw, 12px)";
    pill.style.letterSpacing = ".06em";
  } else {
    pill.style.fontSize = "";
    pill.style.letterSpacing = "";
  }
}

function resetSelectedCountryName() {
  setSelectedCountryName("");
}

// ─────────────────────────────────────────────
//  SCORING HELPERS
// ─────────────────────────────────────────────
function comboPts() {
  return COMBO_POINTS[
    Math.min(COMBO_POINTS.length - 1, Math.max(0, comboCount - 1))
  ];
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
  try { resetSelectedCountryName(); } catch(e) {}
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
    setSelectedCountryName(board[r][c].entity.name);
    moveStatus.textContent = board[r][c].entity.name.toUpperCase();
    return;
  }
  if (selected.r === r && selected.c === c) {
    clearSel();
    resetSelectedCountryName();
    sfx.select();
    moveStatus.textContent = "SELECTION CLEARED";
    return;
  }
  let a = selected,
    b = { r, c, el };
  setSelectedCountryName(board[b.r][b.c].entity.name);
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
      score += pts;
      levelScore += pts;
      setScoreDisplay();
      showMatchFeedback(a, b, pts, isComboMatch);
      setTimeout(resetSelectedCountryName, 350);
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
  document.body.classList.toggle(
    "critical-time",
    timeLeft <= 15 && gameStarted && !paused,
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
  const bestScore = updateAndGetBestScore(score);

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
  if (goBestCombo) goBestCombo.textContent = bestCombo > 0 ? `×${bestCombo}` : "—";
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
  persistHelperInventoryOnly();
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
    updateHelperDisplay();
    persistHelperInventoryOnly();
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
  if (!movementIconEl) return;
  const ruleName = currentStrategy ? currentStrategy.name : "NORMAL";
  const ruleClassMap = {
    "NORMAL": "movement-normal",
    "BOTTOM": "movement-down",
    "TOP": "movement-up",
    "LEFT": "movement-left",
    "RIGHT": "movement-right",
    "X CENTER": "movement-xcenter",
    "Y CENTER": "movement-ycenter",
    "RANDOM": "movement-random"
  };
  movementIconEl.className = `movement-icon ${ruleClassMap[ruleName] || "movement-normal"}`;
  movementIconEl.setAttribute("aria-label", `${ruleName.toLowerCase()} movement`);
  movementIconEl.title = ruleName;
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

  score += timeBonus + perfect;
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
  if (lcBestCombo) lcBestCombo.textContent = bestCombo > 0 ? `×${bestCombo}` : "—";
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

  const quitBtn = $("levelCompleteQuitBtn");
  if (quitBtn) quitBtn.textContent = isQuickGame ? "⌂ End Quick Game" : "⌂ Home";
  levelCompleteOverlay.classList.remove("hidden");
}

function prepareNextLevelState(perfectClear = false) {
  const clearedLevel = level;
  level++;
  levelScore = 0;
  setScoreDisplay();
  resetLevelScoring();
  refillHelpersAfterClearedLevel(clearedLevel, perfectClear);
  if (isQuickGame) applyQuickGameRandomSet();
  currentStrategy = getStrategy(level);
  levelEl.textContent = String(level).padStart(2, "0");
  updateRuleTag();
  levelTotalTime = getLevelTime(level);
  timeLeft = levelTotalTime;
  timerWarned = false;
  updateHelperDisplay();
  updateTimer();
  createBoard();
  renderBoard();
}

function startNextLevel() {
  levelCompleteOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  $("endQuickConfirmOverlay")?.classList.add("hidden");
  $("quitConfirmOverlay")?.classList.add("hidden");
  $("helperMessageOverlay")?.classList.add("hidden");
  if (!nextLevelReadyAfterComplete) {
    prepareNextLevelState(false);
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
  // Show level start popup — timer deferred until OK
  if (!isQuickGame) {
    showLevelStartPopup(level, currentStrategy, () => {
      startTimer();
    });
  } else {
    startTimer();
  }
}

function levelCompleteQuit() {
  if (isQuickGame) {
    levelCompleteOverlay.classList.add("hidden");
    endQuickGame(true);
    return;
  }
  if (!nextLevelReadyAfterComplete) {
    prepareNextLevelState(false);
  }
  nextLevelReadyAfterComplete = false;
  saveGame({ freshLevelCheckpoint: true });
  sfx.save();
  returnToTitleAfterSave();
}

// ─────────────────────────────────────────────
//  GAME LIFECYCLE
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  LEVEL START POPUP
//  Shows on fresh level start only.
//  Timer begins only after player taps OK.
// ─────────────────────────────────────────────
let levelStartPending = false; // tracks if timer is held pending OK

function showLevelStartPopup(levelNum, strategy, onOk) {
  const overlay = $("levelStartOverlay");
  if (!overlay) { onOk(); return; } // fallback if element missing

  // Populate content
  const numEl   = $("levelStartNum");
  const iconEl  = $("levelStartIcon");
  const nameEl  = $("levelStartRuleName");
  const descEl  = $("levelStartRuleDesc");
  const okBtn   = $("levelStartOkBtn");

  if (numEl)  numEl.textContent  = String(levelNum).padStart(2, "0");
  if (nameEl) nameEl.textContent = strategy.name;
  if (descEl) descEl.textContent = strategy.desc || strategy.label;

  // Update icon class
  if (iconEl) {
    iconEl.className = "movement-icon fmw-levelstart-icon " + (strategy.iconClass || "movement-normal");
  }

  // Show overlay
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  // OK button
  function handleOk(e) {
    e.preventDefault();
    e.stopPropagation();
    okBtn.removeEventListener("click", handleOk);
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    levelStartPending = false;
    onOk();
  }
  okBtn.addEventListener("click", handleOk);
  levelStartPending = true;
}

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
  level = 1;
  resetLevelScoring();
  currentStrategy = getStrategy(1);
  levelTotalTime = getLevelTime(1);
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
  // Show level start popup — timer starts only after OK
  if (!isQuickGame) {
    showLevelStartPopup(level, currentStrategy, () => {
      startTimer();
      moveStatus.textContent = "SYSTEM ONLINE";
    });
  } else {
    startTimer();
    moveStatus.textContent = `QUICK GAME · ${(SPRITE_SETS[selectedSet] || SPRITE_SETS.flags).name}`;
  }
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
  startGame({ quick: true, randomSet: true });
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
  $("themePicker")?.classList.add("hidden");
  appShell.classList.remove("paused");
  restoreGame(save);
  nextLevelReadyAfterComplete = false;
  timerWarned = false;
  paused = false;
  gameStarted = true;
  unlockAudio();
  sfx.level();
  playBgmIfAllowed();
  moveStatus.textContent = `SAVE RESTORED  LV ${level}`;
  if (!isQuickGame) {
    showLevelStartPopup(level, currentStrategy, () => startTimer());
  } else {
    startTimer();
  }
}

function setupPauseModal() {
  const title = document.querySelector("#pauseOverlay h1");
  const msg = $("pauseMessage");
  const saveContinue = $("saveContinueBtn");
  const saveQuit = $("saveFromPauseBtn");
  const endQuick = $("endQuickGameBtn");
  const pauseActions = $("pauseActions");

  // FMW pause popup is a simple control popup only.
  // Obsolete Pocket Match save/end/sound controls must never appear here.
  const setPauseBtnHidden = (btn) => {
    if (!btn) return;
    btn.classList.add("hidden");
    btn.hidden = true;
    btn.style.display = "none";
  };

  pauseOverlay.classList.remove("quick-pause");
  if (pauseActions) pauseActions.classList.remove("quick-pause-actions");
  setPauseBtnHidden(saveContinue);
  setPauseBtnHidden(saveQuit);
  setPauseBtnHidden(endQuick);
  setPauseBtnHidden($("pauseSoundToggle"));

  if (title) title.textContent = "PAUSED";
  if (msg) msg.textContent = "The timer is stopped. Your saved progress remains safe.";

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
  currentStrategy = getStrategy(level);
  levelTotalTime = getLevelTime(level);
  timeLeft = levelTotalTime;
  timerWarned = false;
  updateRuleTag();
  updateTimer();
  createBoard();
  renderBoard();
  paused = false;
  gameStarted = true;
  moveStatus.textContent = `RETRY  LV ${level}`;
  if (!isQuickGame) {
    showLevelStartPopup(level, currentStrategy, () => startTimer());
  } else {
    startTimer();
  }
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
  muted = nextMuted;
  bgm.muted = muted;
  Object.values(uiAudio).forEach((a) => (a.muted = muted));
  const topSoundBtn = $("musicBtn");
  if (topSoundBtn) topSoundBtn.textContent = muted ? "×" : "♪";
  if (!muted) playBgmIfAllowed();
  _syncPauseToggleState();
  if (typeof syncSettingsToggles === "function") syncSettingsToggles();
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
  unlockAudio();
  muted = !muted;
  bgm.muted = muted;
  Object.values(uiAudio).forEach((a) => (a.muted = muted));
  $("musicBtn").textContent = muted ? "×" : "♪";
  if (!muted) playBgmIfAllowed();
};


// Flag Match World fresh settings + pause bindings
const settingsBtn = $("settingsBtn");
const settingsOverlay = $("settingsOverlay");
const settingsBackBtn = $("settingsBackBtn");
const pauseSettingsBtn = $("pauseSettingsBtn");
const pauseRestartBtn = $("pauseRestartBtn");
const pauseHomeBtn = $("pauseHomeBtn");
const settingsMusicToggle = $("settingsMusicToggle");
const settingsSoundToggle = $("settingsSoundToggle");
const settingsHapticsToggle = $("settingsHapticsToggle");
function openSettingsOverlay(){
  if (!settingsOverlay) return;
  settingsOverlay.classList.remove("hidden");
  settingsOverlay.setAttribute("aria-hidden", "false");
}
function closeSettingsOverlay(){
  if (!settingsOverlay) return;
  settingsOverlay.classList.add("hidden");
  settingsOverlay.setAttribute("aria-hidden", "true");
}
if (settingsBtn) settingsBtn.onclick = openSettingsOverlay;
if (pauseSettingsBtn) pauseSettingsBtn.onclick = openSettingsOverlay;
if (settingsBackBtn) settingsBackBtn.onclick = closeSettingsOverlay;
if (settingsOverlay) settingsOverlay.addEventListener("click", (e)=>{ if(e.target===settingsOverlay) closeSettingsOverlay(); });
if (pauseRestartBtn) pauseRestartBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); pauseOverlay.classList.add("hidden"); appShell.classList.remove("paused"); restartCurrentLevel(); };
if (pauseHomeBtn) pauseHomeBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); confirmQuitGame(); };
function syncSettingsToggles(){
  [settingsMusicToggle, settingsSoundToggle].forEach(btn=>{ if(btn) btn.setAttribute("aria-pressed", muted ? "false" : "true"); });
}
if (settingsMusicToggle) settingsMusicToggle.onclick = ()=>{ _setGameSoundMuted(!muted); syncSettingsToggles(); };
if (settingsSoundToggle) settingsSoundToggle.onclick = ()=>{ _setGameSoundMuted(!muted); syncSettingsToggles(); };
if (settingsHapticsToggle) settingsHapticsToggle.onclick = ()=>{ const on=settingsHapticsToggle.getAttribute("aria-pressed")!=="true"; settingsHapticsToggle.setAttribute("aria-pressed", on?"true":"false"); };

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

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
try {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || currentTheme, false);
} catch (err) {
  applyTheme(currentTheme, false);
}
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


// =========================================================
// Flag Match World v5 - agreed startup/popup behavior override
// =========================================================
(function fmwV5AgreedUi(){
  const FMW_MUSIC_KEY = "fmw_music_enabled_v5";
  const FMW_SFX_KEY = "fmw_sfx_enabled_v5";
  let fmwMusicEnabled = localStorage.getItem(FMW_MUSIC_KEY) !== "false";
  let fmwSfxEnabled = localStorage.getItem(FMW_SFX_KEY) !== "false";
  let fmwSettingsReturn = "startup";
  const q = (id) => document.getElementById(id);
  const hide = (id, hidden=true) => { const el=q(id); if(el) el.classList.toggle('hidden', hidden); };
  const modalOpen = (on) => document.body.classList.toggle('fmw-modal-open', !!on);

  try { applySpriteSet('flags', {silent:true}); currentSpriteSetId='flags'; currentSaveSlotId='flags'; } catch(e) {}

  const oldWithAudio = typeof withAudio === 'function' ? withAudio : null;
  if (oldWithAudio) withAudio = function(run){ if(!fmwSfxEnabled) return; return oldWithAudio(run); };
  const oldPlayUiAudio = typeof playUiAudio === 'function' ? playUiAudio : null;
  if (oldPlayUiAudio) playUiAudio = function(name){ if(!fmwSfxEnabled) return; return oldPlayUiAudio(name); };
  if (typeof canPlayBgmNow === 'function') canPlayBgmNow = function(){ return fmwMusicEnabled && gameStarted && !paused && !document.hidden; };

  function applySoundSettings(){
    try { bgm.muted = !fmwMusicEnabled || muted; if(!fmwMusicEnabled) bgm.pause(); else playBgmIfAllowed(); } catch(e) {}
    try { Object.values(uiAudio).forEach(a => a.muted = !fmwSfxEnabled || muted); } catch(e) {}
  }
  function syncSettingsToggles(){
    const music=q('settingsMusicToggle'), sound=q('settingsSoundToggle');
    if(music){ music.classList.toggle('off', !fmwMusicEnabled); music.setAttribute('aria-pressed', fmwMusicEnabled?'true':'false'); }
    if(sound){ sound.classList.toggle('off', !fmwSfxEnabled); sound.setAttribute('aria-pressed', fmwSfxEnabled?'true':'false'); }
  }
  function renderStartupMosaic(){
    const el=q('fmwStartMosaic'); if(!el || typeof FLAGS_SPRITES === 'undefined') return;
    const w=window.innerWidth||1024, h=window.innerHeight||768;
    const cw=w>1200?72:w>760?66:54;
    const cols=Math.max(8,Math.ceil((w+80)/cw));
    const rows=Math.ceil((h+120)/((cw*2/3)+6))+3;
    const count=cols*rows; el.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    if(el.childElementCount===count) return;
    el.innerHTML='';
    for(let i=0;i<count;i++){
      const d=document.createElement('div'); d.className='fmw-start-flag';
      const img=document.createElement('img'); img.alt=''; img.loading='eager'; img.src=FLAGS_SPRITES[i%FLAGS_SPRITES.length].img;
      d.appendChild(img); el.appendChild(d);
    }
  }
  function updateStartupSaveUi(){
    const save=loadSave('flags');
    const btn=q('continueFromSaveBtn');
    if(btn){ btn.disabled=!save; btn.classList.toggle('disabled', !save); btn.textContent=save?`Continue · Level ${String(save.level).padStart(2,'0')}`:'Continue'; }
    const sl=q('saveLevel'), ss=q('saveScore'), sd=q('saveDate'), del=q('deleteSaveBtn');
    if(sl) sl.textContent=save?`Flags · LV ${String(save.level).padStart(2,'0')}`:'Flags';
    if(ss) ss.textContent=save?`${formatScore(save.score)} pts`:'No saved game';
    if(sd) sd.textContent=save?formatSaveDate(save.ts):'—';
    if(del) del.classList.add('hidden');
  }
  const oldRefreshSaveSlot = typeof refreshSaveSlot==='function' ? refreshSaveSlot : null;
  refreshSaveSlot = function(){ try{ if(oldRefreshSaveSlot) oldRefreshSaveSlot(); }catch(e){} updateStartupSaveUi(); };
  refreshStartScreen = function(){ refreshSaveSlot(); renderStartupMosaic(); };

  const oldStartGame = startGame;
  startGame = function(options={}){
    try { hide('settingsOverlay'); hide('restartConfirmOverlay'); hide('homeConfirmOverlay'); hide('newGameConfirmOverlay'); modalOpen(false); } catch(e) {}
    oldStartGame({ ...(typeof options==='object'?options:{}), randomSet:false });
    try { applySpriteSet('flags',{silent:true}); currentSpriteSetId='flags'; if(!isQuickGame) currentSaveSlotId='flags'; } catch(e) {}
    applySoundSettings();
  };
  startQuickGame = function(){ startGame({quick:true, randomSet:false}); };
  startNewGameFromTitle = function(force=false){
    currentSpriteSetId='flags';
    const existing=loadSave('flags');
    if(existing && !force){ const msg=q('newGameConfirmMsg'); if(msg) msg.innerHTML='Your saved progress will be deleted.<br>This cannot be undone.'; hide('newGameConfirmOverlay', false); modalOpen(true); return; }
    if(existing) deleteSave('flags');
    refreshStartScreen();
    startGame({quick:false});
  };
  const oldContinueFromSave = continueFromSave;
  continueFromSave = function(){
    currentSpriteSetId='flags'; currentSaveSlotId='flags';
    const save=loadSave('flags');
    if(!save){ deleteSave('flags'); refreshStartScreen(); try{sfx.invalid();}catch(e){} return; }
    oldContinueFromSave(); applySoundSettings();
  };
  function setupPauseCopy(){
    const title=q('pauseTitle'), msg=q('pauseMessage'), restart=q('pauseRestartBtn');
    if(title) title.textContent=isQuickGame?'QUICK GAME PAUSED':'PAUSED';
    if(msg) msg.textContent=isQuickGame?'Quick Game is single-session only.':'The timer is stopped. Your saved progress remains safe.';
    if(restart) restart.textContent=isQuickGame?'Restart Quick Game':'Restart Level';
    const lvl=q('pauseLevelBadge'); if(lvl) lvl.textContent=isQuickGame?'Quick':`LV ${level}`;
    const live=q('pauseLiveScore'); if(live) live.textContent=formatScore(score||levelScore||0);
    const combo=q('pauseBestCombo'); if(combo) combo.textContent=bestCombo>1?`×${bestCombo}`:'—';
  }
  pauseGame = function(){
    if(!gameStarted || paused) return;
    paused=true; clearInterval(timerId); clearSel(); clearPath(); document.body.classList.remove('low-time'); appShell.classList.add('paused');
    setupPauseCopy(); hide('pauseOverlay',false); modalOpen(true); moveStatus.textContent='GAME PAUSED'; try{sfx.select();}catch(e){}
  };
  const oldResumeGame = resumeGame;
  resumeGame = function(){ hide('settingsOverlay'); hide('restartConfirmOverlay'); hide('homeConfirmOverlay'); modalOpen(false); oldResumeGame(); };
  function openSettings(from='startup'){
    fmwSettingsReturn=from; syncSettingsToggles(); if(from==='pause') hide('pauseOverlay'); hide('settingsOverlay',false); modalOpen(true);
  }
  function closeSettings(){ hide('settingsOverlay'); if(fmwSettingsReturn==='pause' && gameStarted && paused){ setupPauseCopy(); hide('pauseOverlay',false); modalOpen(true); } else modalOpen(false); }
  function showRestartConfirm(){
    hide('pauseOverlay');
    const t=q('restartConfirmTitle'), m=q('restartConfirmMsg'), b=q('confirmRestartBtn');
    if(t) t.textContent=isQuickGame?'RESTART QUICK GAME?':'RESTART LEVEL?';
    if(m) m.innerHTML=isQuickGame?'Your current quick game session will be reset.':'Your current attempt will be reset.<br>Your saved progress will remain.';
    if(b) b.textContent=isQuickGame?'Restart Quick Game':'Restart Level';
    hide('restartConfirmOverlay',false); modalOpen(true);
  }
  function showHomeConfirm(){
    hide('pauseOverlay');
    const m=q('homeConfirmMsg'); if(m) m.innerHTML=isQuickGame?'Your current quick game session will be lost.':'Your current unfinished attempt will be lost.<br>Your saved progress will remain.';
    hide('homeConfirmOverlay',false); modalOpen(true);
  }
  function cancelConfirm(){ hide('restartConfirmOverlay'); hide('homeConfirmOverlay'); if(gameStarted && paused){ setupPauseCopy(); hide('pauseOverlay',false); modalOpen(true); } else modalOpen(false); }
  function confirmRestart(){ hide('restartConfirmOverlay'); modalOpen(false); if(isQuickGame) startQuickGame(); else restartCurrentLevel(); }
  function confirmHome(){ hide('homeConfirmOverlay'); modalOpen(false); if(isQuickGame) endQuickGame(true); else quitCurrentGameWithoutSaving(); }

  const oldShowLevelComplete = showLevelComplete;
  showLevelComplete = function(){
    const savedCombo = bestCombo; // capture before oldShowLevelComplete resets it via prepareNextLevelState
    oldShowLevelComplete(); modalOpen(true);
    const title=q('levelCompleteTitle'); if(title) title.textContent=isQuickGame?'QUICK GAME COMPLETE':'LEVEL COMPLETE';
    const main=q('mainCompleteActions'), quick=q('quickCompleteActions'); if(main) main.classList.toggle('hidden', isQuickGame); if(quick) quick.classList.toggle('hidden', !isQuickGame);
    const last=scoreHistory[scoreHistory.length-1]||{};
    const match=q('lcMatchScore'); if(match) match.textContent=formatScore(last.matchComboScore||levelScore||0);
    const time=q('lcTimeBonus'); if(time) time.textContent=formatScore(last.timeBonus||0);
    const perf=q('lcPerfectBonus'); if(perf) perf.textContent=formatScore(last.perfectBonus||0);
    const total=q('lcTotalScore'); if(total) total.textContent=formatScore(isQuickGame?(last.levelScore||levelScore):score);
    const combo=q('lcBestCombo'); if(combo) combo.textContent=savedCombo>0?`×${savedCombo}`:'—';
  };
  const oldStartNextLevel = startNextLevel;
  startNextLevel = function(){ modalOpen(false); oldStartNextLevel(); };
  function replayCompletedLevel(){ if(level>1) level--; nextLevelReadyAfterComplete=false; hide('levelCompleteOverlay'); modalOpen(false); restartCurrentLevel(); }
  levelCompleteQuit = function(){ hide('levelCompleteOverlay'); modalOpen(false); if(isQuickGame) endQuickGame(true); else returnToTitleAfterSave(); };
  const oldShowGameOver = showGameOver;
  showGameOver = function(){
    oldShowGameOver(); modalOpen(true);
    const title=q('goTitle'); if(title) title.textContent='GAME OVER';
    const msg=q('goMessage'); if(msg) msg.textContent=isQuickGame?'Quick Game ended.':'The clock ran out.';
    const row=q('goLevelRow'); if(row) row.classList.toggle('hidden', isQuickGame);
    const lvl=q('goLevel'); if(lvl) lvl.textContent=`LV ${String(level).padStart(2,'0')}`;
    const sc=q('goScore'); if(sc) sc.textContent=formatScore(score);
    const combo=q('goBestCombo'); if(combo) combo.textContent=bestCombo>0?`×${bestCombo}`:'—';
    const tiles=q('goTilesRemaining'); if(tiles && board){ let rem=0; for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r]&&board[r][c]&&!board[r][c].removed) rem++; tiles.textContent=String(rem); }
    const retry=q('gameOverNewGameBtn'); if(retry) retry.textContent=isQuickGame?'New Quick Game':'Retry';
    const home=q('gameOverQuitBtn'); if(home) home.textContent='Home';
  };
  newGameFromGameOver = function(){ hide('gameOverOverlay'); modalOpen(false); if(isQuickGame) startQuickGame(); else restartCurrentLevel(); };
  quitFromGameOver = function(){ hide('gameOverOverlay'); modalOpen(false); returnToTitleAfterSave(); };
  const oldReturnToTitle = returnToTitleAfterSave;
  returnToTitleAfterSave = function(){ oldReturnToTitle(); hide('settingsOverlay'); hide('restartConfirmOverlay'); hide('homeConfirmOverlay'); modalOpen(false); refreshStartScreen(); };

  const bind=(id,fn)=>{ const el=q(id); if(el) el.onclick=fn; };
  bind('startBtn',()=>startNewGameFromTitle(false)); bind('continueFromSaveBtn',continueFromSave); bind('quickGameBtn',startQuickGame); bind('settingsBtn',()=>openSettings('startup'));
  bind('pauseBtn',pauseGame); bind('continueBtn',(e)=>{e.preventDefault();e.stopPropagation();resumeGame();}); bind('pauseRestartBtn',showRestartConfirm); bind('pauseSettingsBtn',()=>openSettings('pause')); bind('pauseHomeBtn',showHomeConfirm);
  bind('settingsBackBtn',closeSettings); bind('settingsMusicToggle',()=>{fmwMusicEnabled=!fmwMusicEnabled; localStorage.setItem(FMW_MUSIC_KEY,String(fmwMusicEnabled)); applySoundSettings(); syncSettingsToggles();}); bind('settingsSoundToggle',()=>{fmwSfxEnabled=!fmwSfxEnabled; localStorage.setItem(FMW_SFX_KEY,String(fmwSfxEnabled)); applySoundSettings(); syncSettingsToggles();});
  bind('cancelRestartBtn',cancelConfirm); bind('confirmRestartBtn',confirmRestart); bind('cancelHomeBtn',cancelConfirm); bind('confirmHomeBtn',confirmHome); bind('cancelNewGameBtn',()=>{hide('newGameConfirmOverlay'); modalOpen(false);}); bind('confirmNewGameBtn',()=>{hide('newGameConfirmOverlay'); modalOpen(false); startNewGameFromTitle(true);});
  bind('nextLevelBtn',startNextLevel); bind('replayLevelBtn',replayCompletedLevel); bind('levelCompleteQuitBtn',levelCompleteQuit); bind('quickCompleteHomeBtn',levelCompleteQuit); bind('newQuickFromCompleteBtn',startQuickGame); bind('gameOverNewGameBtn',newGameFromGameOver); bind('gameOverQuitBtn',quitFromGameOver);
  window.addEventListener('resize', renderStartupMosaic, {passive:true}); window.addEventListener('orientationchange', renderStartupMosaic, {passive:true});
  renderStartupMosaic(); applySoundSettings(); refreshStartScreen(); syncSettingsToggles();
})();


// FMW v5 visual/data polish patch: keep Best Combo display consistent.
(function fmwNormalizeBestComboDisplay(){
  const oldShowLevelCompleteFinal = showLevelComplete;
  showLevelComplete = function(){
    const savedCombo = bestCombo; // capture before the call chain resets it
    oldShowLevelCompleteFinal();
    const comboEl = $("lcBestCombo");
    if (comboEl) comboEl.textContent = savedCombo > 0 ? `×${savedCombo}` : "—";
    setTimeout(() => {
      const again = $("lcBestCombo");
      if (again) again.textContent = savedCombo > 0 ? `×${savedCombo}` : "—";
    }, 0);
  };
})();


// FMW v5 startup safety patch
// Ensures the app always opens on the startup screen, not a mid-game overlay.
// Guards against iOS bfcache restore, late-running init code, and ChatGPT cleanup regressions.
(function fmwForceStartupOnInitialLoad() {
  const POPUP_IDS = [
    'pauseOverlay', 'levelCompleteOverlay', 'gameOverOverlay',
    'settingsOverlay', 'restartConfirmOverlay', 'homeConfirmOverlay',
    'newGameConfirmOverlay', 'helperMessageOverlay',
    'quitConfirmOverlay', 'endQuickConfirmOverlay', 'saveOverlay', 'themePicker'
  ];

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', !!hidden);
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    // inline display beats any restored CSS/bfcache layout on iOS
    if (hidden) el.style.display = 'none';
    else el.style.removeProperty('display');
  }

  function isGameActive() {
    try { return typeof gameStarted !== 'undefined' && gameStarted; } catch(e) { return false; }
  }

  function showStartupScreenCleanly() {
    // Never interfere if a game is already running or paused
    if (isGameActive()) return;
    try { clearInterval(timerId); } catch(e) {}
    try { gameStarted = false; paused = false; } catch(e) {}
    POPUP_IDS.forEach(id => setHidden(id, true));
    setHidden('overlay', false);
    const shell = document.querySelector('.app-shell');
    if (shell) shell.classList.remove('paused');
    document.body.classList.remove('low-time', 'modal-open', 'fmw-modal-open');
    document.documentElement.classList.remove('modal-open', 'fmw-modal-open');
    try { if (typeof refreshStartScreen === 'function') refreshStartScreen(); } catch(e) {}
    try { if (typeof renderStartupMosaic === 'function') renderStartupMosaic(); } catch(e) {}
  }

  const run = () => showStartupScreenCleanly();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  // Repeat after late init/fit routines settle — guarded so they can't fire mid-game
  [0, 50, 200, 600].forEach(ms => setTimeout(run, ms));
  // bfcache restore on iOS: only reset if no game is active
  window.addEventListener('pageshow', run);
})();

// Boarding Pass second polish patch: dynamic itinerary codes and restored tagline.
(function fmwBoardingPassSecondPolish(){
  const q = (id) => document.getElementById(id);
  const moveLetters = ["A","B","C","D","E","F","G","H"];
  function movementLetterForLevel(lvl){
    const n = Math.max(1, parseInt(lvl, 10) || 1);
    return moveLetters[(n - 1) % 8] || "A";
  }
  function flightCodeForLevel(lvl){
    const n = Math.max(1, parseInt(lvl, 10) || 1);
    return `${String(n).padStart(2,"0")}${movementLetterForLevel(n)}`;
  }
  function ensureMenuRow(btn, kicker, label, code){
    if(!btn) return;
    btn.innerHTML = `<span class="bp-mk"><i>${kicker}</i><b>${label}</b></span><span class="bp-seat">${code}</span>`;
  }
  function applyBoardingPassStartupCopy(){
    const tag = document.querySelector('.bp-tagline');
    if(tag){
      tag.innerHTML = `<span class="bp-tagline-main">Match flags across the globe</span> — <span class="bp-tagline-info"><b>212 flags.</b> One board. Infinite routes.</span>`;
    }
    const fieldLabels = Array.from(document.querySelectorAll('.bp-passenger .bp-field'));
    fieldLabels.forEach((field) => {
      const i = field.querySelector('i');
      const b = field.querySelector('b');
      if(!i || !b) return;
      const label = i.textContent.trim().toLowerCase();
      if(label === 'flags') b.textContent = '212';
    });
  }
  function applyDynamicBoardingPassCodes(){
    let save = null;
    try { save = (typeof loadSave === 'function') ? loadSave('flags') : null; } catch(e) {}
    const continueLevel = save && save.level ? save.level : 1;
    const code = save ? flightCodeForLevel(continueLevel) : 'LV';
    const label = save ? `Continue · Level ${String(continueLevel).padStart(2,'0')}` : 'Continue';

    const c = q('continueFromSaveBtn');
    ensureMenuRow(c, 'Resume', label, code);
    if(c){ c.disabled = !save; c.classList.toggle('disabled', !save); }
    ensureMenuRow(q('startBtn'), 'Depart', 'New Game', 'NEW');
    ensureMenuRow(q('quickGameBtn'), 'Express', 'Quick Game', 'QG');
    ensureMenuRow(q('settingsBtn'), 'Cabin', 'Settings', '⚙');

    const gates = document.querySelectorAll('.bp-gate span');
    if(gates && gates[1]) gates[1].textContent = `Seat ${code}`;
  }
  function applyAll(){
    applyBoardingPassStartupCopy();
    applyDynamicBoardingPassCodes();
  }

  const oldRefreshSaveSlot2 = (typeof refreshSaveSlot === 'function') ? refreshSaveSlot : null;
  if(oldRefreshSaveSlot2){
    refreshSaveSlot = function(){
      try { oldRefreshSaveSlot2(); } catch(e) {}
      applyAll();
    };
  }
  const oldRefreshStartScreen2 = (typeof refreshStartScreen === 'function') ? refreshStartScreen : null;
  if(oldRefreshStartScreen2){
    refreshStartScreen = function(){
      try { oldRefreshStartScreen2(); } catch(e) {}
      applyAll();
    };
  }
  document.addEventListener('DOMContentLoaded', applyAll, {once:true});
  window.addEventListener('pageshow', applyAll, {passive:true});
  setTimeout(applyAll, 0);
})();
