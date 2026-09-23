// Cycling Wear — constantes compartilhadas do frontend

// Tipos fixos (fonte única: popula o <select> do formulário e o filtro)
export const TIPOS = ['Jersey', 'Bretelle', 'Short', 'Camiseta', 'Legging', 'Jaqueta'];

// Agrupamento usado no Kit Matching
export const TIPOS_TOP    = ['Jersey', 'Camiseta', 'Jaqueta'];
export const TIPOS_BOTTOM = ['Bretelle', 'Short', 'Legging'];

// Larguras (px) pedidas ao Cloudinary por contexto — já consideram telas 2x
export const IMG_WIDTH = {
  card:   500,  // grid do Closet (card de até ~260px)
  kit:    320,  // miniaturas do Kit Matching (~150px)
  slot:   480,  // preview combinado do Kit (~220px)
  detail: 1000  // modal de detalhes
};
