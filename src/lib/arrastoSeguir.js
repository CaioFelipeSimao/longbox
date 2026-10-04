// Layout-free geometry shared by pointer-following reorder gestures.
export function pontoNaCaixaExpandida(pointer, rect, margem = 16) {
  return !!rect && pointer.x >= rect.left - margem && pointer.x <= rect.right + margem &&
    pointer.y >= rect.top - margem && pointer.y <= rect.bottom + margem;
}

// Fixed page-coordinate rects in slot order, including the dragged card's slot.
// Half-open bounds assign a shared gap midpoint to exactly one slot. Clamp any
// expansion at neighbour midpoints so even excessive slack cannot overlap slots.
export function slotNoPonto(pointerPage, slotRects, { folga = 0 } = {}) {
  const x = Math.max(0, typeof folga === "number" ? folga : folga.x || 0);
  const y = Math.max(0, typeof folga === "number" ? folga : folga.y || 0);
  for (let i = 0; i < slotRects.length; i++) {
    const rect = slotRects[i];
    if (!rect) continue;
    let left = rect.left - x, right = rect.right + x;
    let top = rect.top - y, bottom = rect.bottom + y;
    if (pointerPage.x < left || pointerPage.x >= right || pointerPage.y < top || pointerPage.y >= bottom) continue;
    for (const other of slotRects) {
      if (!other || other === rect) continue;
      if (other.right <= rect.left) left = Math.max(left, (other.right + rect.left) / 2);
      if (other.left >= rect.right) right = Math.min(right, (rect.right + other.left) / 2);
      if (other.bottom <= rect.top) top = Math.max(top, (other.bottom + rect.top) / 2);
      if (other.top >= rect.bottom) bottom = Math.min(bottom, (rect.bottom + other.top) / 2);
    }
    if (pointerPage.x >= left && pointerPage.x < right && pointerPage.y >= top && pointerPage.y < bottom) return i;
  }
  return null;
}

// Always derive the preview from the gesture's original order, never its last
// preview. A distant target shifts every intervening neighbour exactly once.
export function reordenarParaSlot(ids, id, indice) {
  const next = ids.slice();
  const from = next.indexOf(id);
  if (from < 0 || !Number.isInteger(indice) || indice < 0 || indice >= next.length) return next;
  next.splice(from, 1);
  next.splice(indice, 0, id);
  return next;
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
