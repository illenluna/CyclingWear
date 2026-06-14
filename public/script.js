// Cycling Wear — lógica do frontend
// Gerencia carregamento, renderização, filtros, formulário e detalhes.

// === Estado da aplicação ===
let items = [];        // todos os itens vindos da API
let editingId = null;  // id do item sendo editado (null = novo)
let viewingId = null;  // id do item aberto em detalhes
let kitTopId = null;   // id do item selecionado como superior no Kit Matching
let kitBottomId = null;// id do item selecionado como inferior no Kit Matching

// Tipos fixos (definidos no MVP)
const TIPOS = ['Jersey', 'Bretelle', 'Short', 'Camiseta', 'Legging', 'Jaqueta'];

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

// Referências da camada de autenticação
const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const googleBtnEl = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');

// === Bootstrap: checa sessão antes de iniciar o app ===
bootstrap();

async function bootstrap() {
  try {
    const res = await fetch('/auth/me', { credentials: 'same-origin' });
    const data = await res.json();
    if (data.authenticated) {
      showApp();
      await init();
    } else {
      showLogin();
    }
  } catch (e) {
    console.error('Erro ao checar sessão', e);
    showLogin();
  }
}

function showLogin() {
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  initGoogleSignIn();
}

function showApp() {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

// Inicializa o botão do Google. A biblioteca gsi/client carrega de forma assíncrona
// (atributo `async defer` no <script>), então pode ainda não estar disponível —
// se for o caso, tentamos de novo em alguns ms.
async function initGoogleSignIn() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    return setTimeout(initGoogleSignIn, 150);
  }
  try {
    const res = await fetch('/auth/config');
    const { clientId } = await res.json();
    if (!clientId) throw new Error('Client ID não configurado no servidor');

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      ux_mode: 'popup'
    });
    // Limpa antes de renderizar (caso a função seja chamada duas vezes)
    googleBtnEl.innerHTML = '';
    window.google.accounts.id.renderButton(googleBtnEl, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      locale: 'pt-BR'
    });
  } catch (e) {
    showLoginError('Não foi possível inicializar o login: ' + e.message);
  }
}

async function handleGoogleCredential(response) {
  hideLoginError();
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ credential: response.credential })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha no login');
    }
    showApp();
    await init();
  } catch (e) {
    showLoginError(e.message);
  }
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function hideLoginError() {
  loginError.classList.add('hidden');
  loginError.textContent = '';
}

async function handleLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (e) { /* ignora */ }
  // Limpa estado em memória e volta para a tela de login
  items = [];
  editingId = null;
  viewingId = null;
  showLogin();
}

async function init() {
  await loadItems();
  populateFilters();
  render();
  bindEvents();
  initTabs();
}

async function loadItems() {
  try {
    const res = await fetch('/api/items', { credentials: 'same-origin' });
    if (res.status === 401) { showLogin(); return; }
    items = await res.json();
  } catch (e) {
    console.error('Erro ao carregar itens', e);
    items = [];
  }
}

// === Renderização da vitrine ===
function render() {
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
      <img src="${escapeAttr(item.foto)}"
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

function populateFilters() {
  // Tipos: sempre os mesmos
  filterTipo.innerHTML = '<option value="">Todos os tipos</option>'
    + TIPOS.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');

  // Marcas: derivadas dos itens existentes
  const marcas = uniqueSorted(items.map(i => i.marca));
  filterMarca.innerHTML = '<option value="">Todas as marcas</option>'
    + marcas.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('');

  // Cores: derivadas dos itens existentes
  const cores = uniqueSorted(items.map(i => i.cor));
  filterCor.innerHTML = '<option value="">Todas as cores</option>'
    + cores.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
}

function uniqueSorted(arr) {
  return [...new Set(arr.map(v => (v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

// === Modal de Formulário (Adicionar / Editar) ===
function openForm(item = null) {
  editingId = item ? item.id : null;
  modalTitle.textContent = item ? 'Editar item' : 'Adicionar item';
  itemForm.reset();
  photoPreview.classList.add('hidden');
  photoPreviewImg.src = '';

  if (item) {
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('marca').value = item.marca || '';
    document.getElementById('cor').value = item.cor || '';
    document.getElementById('tamanho').value = item.tamanho || '';
    document.getElementById('notas').value = item.notas || '';
    photoPreviewImg.src = item.foto;
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
  editingId = null;
}

function renderColorSuggestions() {
  const cores = uniqueSorted(items.map(i => i.cor));
  colorSuggestions.innerHTML = '';
  if (cores.length === 0) return;
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
  const item = items.find(i => i.id === id);
  if (!item) return;
  viewingId = id;
  detailImg.src = item.foto;
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
  viewingId = null;
}

// === Eventos ===
function bindEvents() {
  btnAdd.addEventListener('click', () => openForm());
  btnLogout.addEventListener('click', handleLogout);

  // Fechar formulário
  modalForm.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', closeForm);
  });

  // Fechar detalhes
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
      if (editingId && (!fotoInput.files || fotoInput.files.length === 0)) {
        formData.delete('foto');
      }
      const url = editingId ? `/api/items/${editingId}` : '/api/items';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: formData, credentials: 'same-origin' });
      if (res.status === 401) { showLogin(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar');
      }
      await loadItems();
      populateFilters();
      render();
      closeForm();
    } catch (err) {
      alert('Não foi possível salvar: ' + err.message);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Salvar';
    }
  });

  // Filtros e busca: re-renderiza ao mudar
  [search, filterTipo, filterMarca, filterCor].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Editar a partir dos detalhes
  btnEdit.addEventListener('click', () => {
    const item = items.find(i => i.id === viewingId);
    if (!item) return;
    closeDetail();
    openForm(item);
  });

  // Excluir a partir dos detalhes
  btnDelete.addEventListener('click', async () => {
    if (!viewingId) return;
    if (!confirm('Excluir este item? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`/api/items/${viewingId}`, { method: 'DELETE', credentials: 'same-origin' });
      if (res.status === 401) { showLogin(); return; }
      if (!res.ok) throw new Error('Erro ao excluir');
      await loadItems();
      populateFilters();
      render();
      closeDetail();
    } catch (err) {
      alert('Não foi possível excluir: ' + err.message);
    }
  });

  // Tecla Esc fecha qualquer modal aberto
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modalForm.classList.contains('hidden')) closeForm();
    if (!modalDetail.classList.contains('hidden')) closeDetail();
  });
}

// === Kit Matching ===
const TIPOS_TOP    = ['Jersey', 'Camiseta', 'Jaqueta'];
const TIPOS_BOTTOM = ['Bretelle', 'Short', 'Legging'];

const kitSection    = document.getElementById('kitSection');
const kitTopGrid    = document.getElementById('kitTopGrid');
const kitBottomGrid = document.getElementById('kitBottomGrid');
const kitPreviewTop    = document.getElementById('kitPreviewTop');
const kitPreviewBottom = document.getElementById('kitPreviewBottom');
const kitPreviewLabels = document.getElementById('kitPreviewLabels');

function renderKit() {
  renderKitGrid(kitTopGrid, TIPOS_TOP, 'top');
  renderKitGrid(kitBottomGrid, TIPOS_BOTTOM, 'bottom');
  updateKitPreview();
}

function renderKitGrid(container, tipos, slot) {
  const filtered = items.filter(i => tipos.includes(i.tipo));
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<p class="kit-empty">Nenhum item cadastrado</p>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kit-card';
    const selectedId = slot === 'top' ? kitTopId : kitBottomId;
    if (item.id === selectedId) card.classList.add('selected');

    card.innerHTML = `
      <img src="${escapeAttr(item.foto)}" alt="${escapeHtml(item.tipo)}" loading="lazy">
      <div class="kit-card-label">${escapeHtml(item.marca || item.tipo)}</div>
    `;
    card.addEventListener('click', () => {
      if (slot === 'top') {
        kitTopId = kitTopId === item.id ? null : item.id;
      } else {
        kitBottomId = kitBottomId === item.id ? null : item.id;
      }
      renderKit();
    });
    container.appendChild(card);
  });
}

function updateKitPreview() {
  const top    = kitTopId    ? items.find(i => i.id === kitTopId)    : null;
  const bottom = kitBottomId ? items.find(i => i.id === kitBottomId) : null;

  kitPreviewTop.innerHTML = top
    ? `<img src="${escapeAttr(top.foto)}" alt="${escapeHtml(top.tipo)}">`
    : `<span class="kit-slot-empty">Selecione<br>superior</span>`;

  kitPreviewBottom.innerHTML = bottom
    ? `<img src="${escapeAttr(bottom.foto)}" alt="${escapeHtml(bottom.tipo)}">`
    : `<span class="kit-slot-empty">Selecione<br>inferior</span>`;

  if (top || bottom) {
    const parts = [];
    if (top)    parts.push(`${top.tipo}${top.marca ? ' · ' + top.marca : ''}`);
    if (bottom) parts.push(`${bottom.tipo}${bottom.marca ? ' · ' + bottom.marca : ''}`);
    kitPreviewLabels.textContent = parts.join('\n');
  } else {
    kitPreviewLabels.textContent = '';
  }
}

// === Navegação por abas ===
function initTabs() {
  const inventarioMain = document.querySelector('main.main:not(#kitSection)');
  const tabs = document.querySelectorAll('.tab');
  const btnAddEl = document.getElementById('btnAdd');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      if (target === 'inventario') {
        inventarioMain.classList.remove('hidden');
        kitSection.classList.add('hidden');
        btnAddEl.classList.remove('hidden');
      } else {
        inventarioMain.classList.add('hidden');
        kitSection.classList.remove('hidden');
        btnAddEl.classList.add('hidden');
        renderKit();
      }
    });
  });
}

// === Utilidades de segurança ===
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
