// Estado mínimo da "visualização rápida" do card: qual card está sob o mouse e como pedir que ele abra.
// Fica fora do React de propósito: o card só avisa "o mouse está aqui" e quem escuta a tecla Espaço
// (CardPeekHost) decide o que fazer, sem recriar nada a cada passagem do mouse.

let cardSobOMouse: string | null = null;

export const peekHover = {
  definir(id: string | null) {
    cardSobOMouse = id;
  },
  sair(id: string) {
    if (cardSobOMouse === id) cardSobOMouse = null;
  },
  atual() {
    return cardSobOMouse;
  },
};

export const EVENTO_ABRIR_PEEK = 'flowalt:abrir-peek';

export function abrirPeek(cardId: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PEEK, { detail: cardId }));
}
