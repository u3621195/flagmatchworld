export function createTimer(seconds, onTick, onDone) {
  let remaining = seconds, timer = null, last = 0, paused = true;
  const tick = (now) => {
    if (paused) return;
    if (!last) last = now;
    remaining -= (now - last) / 1000; last = now;
    if (remaining <= 0) { remaining = 0; onTick?.(remaining); onDone?.(); return; }
    onTick?.(remaining); timer = requestAnimationFrame(tick);
  };
  return { start(){ if(!paused) return; paused=false; last=0; timer=requestAnimationFrame(tick); }, pause(){ paused=true; if(timer) cancelAnimationFrame(timer); }, reset(s=seconds){ remaining=s; last=0; onTick?.(remaining); }, get remaining(){ return remaining; } };
}
