// Cycling Wear — aba Closet: vitrine, filtros, formulário e detalhes

import { TIPOS, IMG_WIDTH } from './config.js';
import { state } from './state.js';
import * as api from './api.js';
import { UnauthorizedError } from './api.js';
import { escapeHtml, escapeAttr, uniqueSorted, imgUrl } from './utils.js';

// === Referências do DOM ===
const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const counter = document.getElementById('counter');
const search = document.getElementById('search');
const filterTipo = document.getElementById('filterTipo');
const filterMarca = document.getElementById('filterMarca');
const filterCor = document.getElementById('filterCor');

const btnAdd = document.getElementById('btnAdd');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
const itemForm = document.getElementById('itemForm');
const btnSave = document.getElementById('btnSave');
const tipoSelect = document.getElementById('tipo');

const fotoInput = document.getElementById('foto');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewImg = document.getElementById('photoPreviewImg');
const colorSuggestions = document.getElementById('colorSuggestions');

const modalDetail = document.getElementById('modalDetail');
const detailImg = document.getElementById('detailImg');
const detailTipo = document.getElementById('detailTipo');
const detailMarca = document.getElementById('detailMarca');
const detailCor = document.getElementById('detailCor');
const detailTamanho = document.getElementById('detailTamanho');
const detailNotas = document.getElementById('detailNotas');
const btnEdit = document.getElementById('btnEdit');
const btnDelete = document.getElementById('btnDelete');

// === Renderização da vitrine ===
export function renderCloset() {
  const { items } = state;
  const filtered = applyFilters(items);
  grid.innerHTML = '';

  if (items.length === 0) {
    emptyState.classList.remove('hidden');
    counter.textContent = '0 itens';
    return;
  }
  emptyState.classList.add('hidden');

  // Texto do contador: "X de Y itens" se filtros aplicados, senão "Y itens"
  const hasFilter = filtered.length !== items.length;
  counter.textContent = hasFilter
    ? `${filtered.length} de ${items.length} itens`
    : `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${escapeAttr(imgUrl(item.foto, IMG_WIDTH.card))}"
           alt="${escapeHtml(item.tipo)}"
           class="card-img"
           loading="lazy">
      <div class="card-body">
        <div class="card-tipo">${escapeHtml(item.tipo)}</div>
        <div class="card-marca">${escapeHtml(item.marca || '—')}</div>
      </div>
    `;
    card.addEventListener('click', () => openDetail(item.id));
    grid.appendChild(card);
  });
}

function applyFilters(list) {
  const q = search.value.trim().toLowerCase();
  const ftipo = filterTipo.value;
  const fmarca = filterMarca.value;
  const fcor = filterCor.value;

  return list.filter(item => {
    if (ftipo && item.tipo !== ftipo) return false;
    if (fmarca && item.marca !== fmarca) return false;
    if (fcor && item.cor !== fcor) return false;
    if (q) {
      const hay = [item.tipo, item.marca, item.cor, item.tamanho, item.notas]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Recria as opções dos filtros preservando a seleção atual (quando ainda existe)
export function populateFilters() {
  fillSelect(filterTipo, 'Todos os tipos', TIPOS);
  fillSelect(filterMarca, 'Todas as marcas', uniqueSorted(state.items.map(i => i.marca)));
  fillSelect(filterCor, 'Todas as cores', uniqueSorted(state.items.map(i => i.cor)));
}

function fillSelect(select, placeholder, values) {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`
    + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
  if (values.includes(current)) select.value = current;
}

// === Modal de Formulário (Adicionar / Editar) ===
function openForm(item = null) {
  state.editingId = item ? item.id : null;
  modalTitle.textContent = item ? 'Editar item' : 'Adicionar item';
  itemForm.reset();
  photoPreview.classList.add('hidden');
  photoPreviewImg.src = '';

  if (item) {
    tipoSelect.value = item.tipo;
    document.getElementById('marca').value = item.marca || '';
    document.getElementById('cor').value = item.cor || '';
    document.getElementById('tamanho').value = item.tamanho || '';
    document.getElementById('notas').value = item.notas || '';
    photoPreviewImg.src = imgUrl(item.foto, IMG_WIDTH.slot);
    photoPreview.classList.remove('hidden');
    fotoInput.required = false;
  } else {
    fotoInput.required = true;
  }

  renderColorSuggestions();
  modalForm.classList.remove('hidden');
}

function closeForm() {
  modalForm.classList.add('hidden');
  state.editingId = null;
}

function renderColorSuggestions() {
  const cores = uniqueSorted(state.items.map(i => i.cor));
  colorSuggestions.innerHTML = '';
  cores.forEach(c => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = c;
    chip.addEventListener('click', () => {
      document.getElementById('cor').value = c;
    });
    colorSuggestions.appendChild(chip);
  });
}

// === Modal de Detalhes ===
function openDetail(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  state.viewingId = id;
  detailImg.src = imgUrl(item.foto, IMG_WIDTH.detail);
  detailImg.alt = item.tipo;
  detailTipo.textContent = item.tipo;
  detailMarca.textContent = item.marca || '—';
  detailCor.textContent = item.cor || '—';
  detailTamanho.textContent = item.tamanho || '—';
  detailNotas.textContent = item.notas || '—';
  modalDetail.classList.remove('hidden');
}

function closeDetail() {
  modalDetail.classList.add('hidden');
  state.viewingId = null;
}

// === Eventos ===
// `reload` recarrega os itens e re-renderiza tudo após criar/editar/excluir.
export function bindClosetEvents(reload) {
  // Opções do tipo no formulário vêm da lista central de TIPOS
  tipoSelect.innerHTML = '<option value="">Selecione...</option>'
    + TIPOS.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');

  btnAdd.addEventListener('click', () => openForm());

  modalForm.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', closeForm);
  });
  modalDetail.querySelectorAll('[data-close-detail]').forEach(el => {
    el.addEventListener('click', closeDetail);
  });

  // Pré-visualização da foto ao escolher
  fotoInput.addEventListener('change', () => {
    const file = fotoInput.files && fotoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreviewImg.src = e.target.result;
      photoPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // Enviar formulário (criar ou editar)
  itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
    try {
      const formData = new FormData(itemForm);
      // Se está editando e nenhuma foto nova foi selecionada, remove o campo vazio
      if (state.editingId && (!fotoInput.files || fotoInput.files.length === 0)) {
        formData.delete('foto');
      }
      await api.saveItem(state.editingId, formData);
      await reload();
      closeForm();
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) alert('Não foi possível salvar: ' + err.message);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Salvar';
    }
  });

  // Filtros e busca: re-renderiza ao mudar
  [search, filterTipo, filterMarca, filterCor].forEach(el => {
    el.addEventListener('input', renderCloset);
    el.addEventListener('change', renderCloset);
  });

  // Editar a partir dos detalhes
  btnEdit.addEventListener('click', () => {
    const item = state.items.find(i => i.id === state.viewingId);
    if (!item) return;
    closeDetail();
    openForm(item);
  });

  // Excluir a partir dos detalhes
  btnDelete.addEventListener('click', async () => {
    if (!state.viewingId) return;
    if (!confirm('Excluir este item? Esta ação não pode ser desfeita.')) return;
    try {
      await api.deleteItem(state.viewingId);
      await reload();
      closeDetail();
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) alert('Não foi possível excluir: ' + err.message);
    }
  });

  // Tecla Esc fecha qualquer modal aberto
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modalForm.classList.contains('hidden')) closeForm();
    if (!modalDetail.classList.contains('hidden')) closeDetail();
  });
}

// Fecha modais ao sair da conta
export function closeModals() {
  closeForm();
  closeDetail();
}
