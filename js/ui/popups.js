export function showPopup({ title, body='', buttons=[] , type='' }) {
  const layer = document.getElementById('modalLayer');
  layer.className = 'modal-backdrop';
  layer.innerHTML = `<div class="popup-card ${type}"><div class="popup-title">${title}</div><div class="popup-body">${body}</div><div class="popup-actions">${buttons.map(b=>`<button class="${b.kind||'secondary-btn'}" data-action="${b.action}">${b.label}</button>`).join('')}</div></div>`;
  return layer;
}
export function hidePopup(){ const layer=document.getElementById('modalLayer'); layer.className='hidden'; layer.innerHTML=''; }
