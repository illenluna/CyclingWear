// Cycling Wear — chamadas ao backend
// Um 401 em qualquer rota /api dispara o handler registrado (volta ao login).

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export class UnauthorizedError extends Error {}

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  if (res.status === 401 && url.startsWith('/api/')) {
    onUnauthorized();
    throw new UnauthorizedError('Sessão expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// === Autenticação ===
export const getSession = () => request('/auth/me');
export const getAuthConfig = () => request('/auth/config');

export function loginWithGoogle(credential) {
  return request('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
}

export const logout = () => request('/auth/logout', { method: 'POST' });

// === Itens ===
export const listItems = () => request('/api/items');

export function saveItem(id, formData) {
  const url = id ? `/api/items/${id}` : '/api/items';
  return request(url, { method: id ? 'PUT' : 'POST', body: formData });
}

export const deleteItem = (id) => request(`/api/items/${id}`, { method: 'DELETE' });
