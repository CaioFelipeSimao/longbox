// Layout-free geometry shared by pointer-following reorder gestures.
export function pontoNaCaixaExpandida(pointer, rect, margem = 16) {
  return !!rect && pointer.x >= rect.left - margem && pointer.x <= rect.right + margem &&
    pointer.y >= rect.top - margem && pointer.y <= rect.bottom + margem;
}

// rects contains only neighbours, in slot order: [{ id, rect }]. The current
// slot is a dead zone, so a stationary pointer does not keep swapping cards.
export function alvoSlotMaisProximo(pointer, rects, slotRect = null) {
  if (slotRect && pontoNaCaixaExpandida(pointer, slotRect, 0)) return null;
  let alvo = null;
  let distancia = Infinity;
  for (const { id, rect } of rects) {
    const dx = pointer.x - (rect.left + rect.right) / 2;
    const dy = pointer.y - (rect.top + rect.bottom) / 2;
    const d = dx * dx + dy * dy;
    if (d < distancia) { distancia = d; alvo = id; }
  }
  return alvo;
}

// Positive is down. Scroll limits are explicit so this needs no DOM or window.
export function velocidadeAutoScroll(pointerY, viewportTop, viewportBottom, {
  scrollTop = 0, maxScroll = Infinity, zona = 64, maxVelocidade = 14,
} = {}) {
  if (viewportBottom <= viewportTop || zona <= 0 || maxScroll <= 0) return 0;
  const edge = Math.min(zona, (viewportBottom - viewportTop) / 2);
  let velocidade = 0;
  if (pointerY < viewportTop + edge) {
    velocidade = -maxVelocidade * Math.min(1, (viewportTop + edge - pointerY) / edge);
  } else if (pointerY > viewportBottom - edge) {
    velocidade = maxVelocidade * Math.min(1, (pointerY - viewportBottom + edge) / edge);
  }
  if ((velocidade < 0 && scrollTop <= 0) || (velocidade > 0 && scrollTop >= maxScroll)) return 0;
  return velocidade;
}

// Scale about grabOffset in the caller; translation then keeps the grabbed
// point exactly under the pointer even after the card changes layout slots.
export function transformSeguir(pointer, grabOffset, slotRect) {
  return {
    x: pointer.x - grabOffset.x - slotRect.left,
    y: pointer.y - grabOffset.y - slotRect.top,
  };
}
