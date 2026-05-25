export function renderHud(state) {
  const el = document.getElementById('hud');
  if (!el) return;
  const timeBlock = matchMedia('(min-width: 900px)').matches ? `<div class="stat-block"><div class="stat-label">TIME</div><div class="stat-value" id="hudTime">08:00</div></div>` : '';
  el.innerHTML = `<div style="display:flex;gap:8px"><div class="stat-block"><div class="stat-label">LEVEL</div><div class="stat-value">${String(state.level).padStart(2,'0')}</div></div><div class="stat-block"><div class="stat-label">SCORE</div><div class="stat-value" id="hudScore">0</div></div>${timeBlock}</div><div class="country-pill" id="countryPill"></div><div style="display:flex;gap:8px"><button id="hintBtn" class="secondary-btn">💡 <span>${state.helpers.hint}</span></button><button id="shuffleBtn" class="secondary-btn">🔀 <span>${state.helpers.shuffle}</span></button><button id="pauseBtn" class="secondary-btn">Ⅱ</button></div>`;
}
export function setCountryName(name='') { const el=document.getElementById('countryPill'); if(el) el.textContent=name; }
