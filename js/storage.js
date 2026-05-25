const KEY='flagMatchWorld.v1.save';
export function loadSave(){ try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null} }
export function saveGame(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
export function clearSave(){ localStorage.removeItem(KEY); }
