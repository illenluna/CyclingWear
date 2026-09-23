// Cycling Wear — tela de login (Google Identity Services) e sessão

import * as api from './api.js';

const loginScreen = document.getElementById('loginScreen');
const appShell    = document.getElementById('appShell');
const googleBtnEl = document.getElementById('googleSignInBtn');
const loginError  = document.getElementById('loginError');

let onLogin = () => {};

export function setLoginHandler(fn) { onLogin = fn; }

export function showLogin() {
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  initGoogleSignIn();
}

export function showApp() {
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
    const { clientId } = await api.getAuthConfig();
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
    await api.loginWithGoogle(response.credential);
    showApp();
    await onLogin();
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
