// Cycling Wear — utilidades

// === Segurança ===
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const escapeAttr = escapeHtml;

export function uniqueSorted(arr) {
  return [...new Set(arr.map(v => (v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

// === Imagens ===
// Pede ao Cloudinary uma versão redimensionada (sem ampliar), no melhor formato
// que o navegador aceita (WebP/AVIF) e com qualidade automática.
// URLs que não são do Cloudinary são devolvidas sem alteração.
export function imgUrl(url, width) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${width},c_limit,f_auto,q_auto/`);
}
