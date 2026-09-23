// Cycling Wear — aba Kit Matching: combina uma peça superior com uma inferior

import { TIPOS_TOP, TIPOS_BOTTOM, IMG_WIDTH } from './config.js';
import { state } from './state.js';
import { escapeHtml, escapeAttr, imgUrl } from './utils.js';

const kitTopGrid       = document.getElementById('kitTopGrid');
const kitBottomGrid    = document.getElementById('kitBottomGrid');
const kitPreviewTop    = document.getElementById('kitPreviewTop');
const kitPreviewBottom = document.getElementById('kitPreviewBottom');
const kitPreviewLabels = document.getElementById('kitPreviewLabels');

export function renderKit() {
  renderKitGrid(kitTopGrid, TIPOS_TOP, 'top');
  renderKitGrid(kitBottomGrid, TIPOS_BOTTOM, 'bottom');
  updateKitPreview();
}

function renderKitGrid(container, tipos, slot) {
  const filtered = state.items.filter(i => tipos.includes(i.tipo));
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<p class="kit-empty">Nenhum item cadastrado</p>`;
    return;
  }

  const selectedId = slot === 'top' ? state.kitTopId : state.kitBottomId;

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kit-card';
    if (item.id === selectedId) card.classList.add('selected');

    card.innerHTML = `
      <img src="${escapeAttr(imgUrl(item.foto, IMG_WIDTH.kit))}" alt="${escapeHtml(item.tipo)}" loading="lazy">
      <div class="kit-card-label">${escapeHtml(item.marca || item.tipo)}</div>
    `;
    card.addEventListener('click', () => {
      if (slot === 'top') {
        state.kitTopId = state.kitTopId === item.id ? null : item.id;
      } else {
        state.kitBottomId = state.kitBottomId === item.id ? null : item.id;
      }
      renderKit();
    });
    container.appendChild(card);
  });
}

function updateKitPreview() {
  const top    = state.kitTopId    ? state.items.find(i => i.id === state.kitTopId)    : null;
  const bottom = state.kitBottomId ? state.items.find(i => i.id === state.kitBottomId) : null;

  kitPreviewTop.innerHTML = top
    ? `<img src="${escapeAttr(imgUrl(top.foto, IMG_WIDTH.slot))}" alt="${escapeHtml(top.tipo)}">`
    : `<span class="kit-slot-empty">Selecione<br>superior</span>`;

  kitPreviewBottom.innerHTML = bottom
    ? `<img src="${escapeAttr(imgUrl(bottom.foto, IMG_WIDTH.slot))}" alt="${escapeHtml(bottom.tipo)}">`
    : `<span class="kit-slot-empty">Selecione<br>inferior</span>`;

  const parts = [];
  if (top)    parts.push(`${top.tipo}${top.marca ? ' · ' + top.marca : ''}`);
  if (bottom) parts.push(`${bottom.tipo}${bottom.marca ? ' · ' + bottom.marca : ''}`);
  kitPreviewLabels.textContent = parts.join('\n');
}
