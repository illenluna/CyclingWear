// Cycling Wear — estado da aplicação (compartilhado entre os módulos)

export const state = {
  items: [],         // todos os itens vindos da API
  editingId: null,   // id do item sendo editado (null = novo)
  viewingId: null,   // id do item aberto em detalhes
  kitTopId: null,    // id do item selecionado como superior no Kit Matching
  kitBottomId: null  // id do item selecionado como inferior no Kit Matching
};

export function resetState() {
  state.items = [];
  state.editingId = null;
  state.viewingId = null;
  state.kitTopId = null;
  state.kitBottomId = null;
}
