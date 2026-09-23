// Cycling Wear — ponto de entrada do frontend
// Checa a sessão, carrega os itens e liga as abas Closet e Kit Matching.

import { state, resetState } from './state.js';
import * as api from './api.js';
import { showLogin, showApp, setLoginHandler } from './auth.js';
import { renderCloset, populateFilters, bindClosetEvents, closeModals } from './closet.js';
import { renderKit } from './kit.js';
import { registerServiceWorker, initOfflineMode, clearDataCache } from './pwa.js';

const btnLogout = document.getElementById('btnLogout');
let eventsBound = false; // listeners são ligados uma única vez, mesmo após logout/login

api.setUnauthorizedHandler(showLogin);
setLoginHandler(init);
registerServiceWorker();
initOfflineMode();
bootstrap();

async function bootstrap() {
  try {
    const { authenticated } = await api.getSession();
    if (authenticated) {
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

async function init() {
  await loadItems();
  populateFilters();
  renderCloset();
  if (!eventsBound) {
    bindClosetEvents(reload);
    btnLogout.addEventListener('click', handleLogout);
    initTabs();
    eventsBound = true;
  }
}

async function loadItems() {
  try {
    state.items = await api.listItems();
  } catch (e) {
    console.error('Erro ao carregar itens', e);
    state.items = [];
  }
}

async function reload() {
  await loadItems();
  populateFilters();
  renderCloset();
  renderKit();
}

async function handleLogout() {
  try {
    await api.logout();
  } catch (e) { /* ignora */ }
  await clearDataCache().catch(() => {});
  closeModals();
  resetState();
  showLogin();
}

// === Navegação por abas ===
function initTabs() {
  const closetSection = document.getElementById('closetSection');
  const kitSection = document.getElementById('kitSection');
  const btnAdd = document.getElementById('btnAdd');
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const isCloset = tab.dataset.tab === 'inventario';
      closetSection.classList.toggle('hidden', !isCloset);
      kitSection.classList.toggle('hidden', isCloset);
      btnAdd.classList.toggle('hidden', !isCloset);
      if (!isCloset) renderKit();
    });
  });
}
