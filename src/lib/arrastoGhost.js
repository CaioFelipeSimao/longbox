// A body-mounted visual leaves scroll containers and their stacking contexts
// untouched. The real node keeps its layout box and pointer capture in the list.
// Reusable for cards in strips and in sheet scroll bodies.
export function criarGhost(card, grabOffset, reduced = false, { zIndex = 14 } = {}) {
  const rect = card.getBoundingClientRect();
  const node = card.cloneNode(true);
  const style = card.ownerDocument.defaultView.getComputedStyle(card);
  for (const prop of Array.from(style)) {
    if (prop.startsWith("--")) node.style.setProperty(prop, style.getPropertyValue(prop));
  }
  node.style.font = style.font;
  node.style.color = style.color;
  node.removeAttribute("id");
  node.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("inert", "");
  node.tabIndex = -1;
  node.dataset.dragGhost = "true";
  node.dataset.dragging = "true";
  Object.assign(node.style, { position: "fixed", left: "0px", top: "0px",
    width: rect.width + "px", height: rect.height + "px", margin: "0",
    pointerEvents: "none", zIndex: String(zIndex), animation: "none", opacity: "1",
    transition: "none", transformOrigin: `${grabOffset.x}px ${grabOffset.y}px` });
  // v165: the wish list is a fixed layer at z-index 35; a ghost under it was invisible.
  if (card.closest(".desejos-capa")) node.style.zIndex = "40";
  card.ownerDocument.body.appendChild(node);
  card.dataset.dragHole = "true";
  // v185: grow 6%, but never more than 24px wider: a full-width séries row on a PC
  // grew 80px and ran off the screen. Covers and sheet cards (up to 400px) keep 6%.
  const escala = Math.min(1.06, 1 + 24 / Math.max(1, rect.width));
  let timer = 0, removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    clearTimeout(timer);
    node.remove();
    delete card.dataset.dragHole;
  };
  const follow = (pointer) => {
    if (removed) return;
    node.style.transform = `translate(${pointer.x - grabOffset.x}px, ${pointer.y - grabOffset.y}px) scale(${reduced ? 1 : escala})`;
  };
  const settle = (target, done) => {
    if (removed) return;
    node.dataset.dragSettling = "true";
    node.getBoundingClientRect();
    node.style.transition = reduced ? "none" : "transform 200ms var(--ease-out, ease-out)";
    node.style.transform = `translate(${target.left}px, ${target.top}px) scale(1)`;
    const finish = () => { remove(); done(); };
    if (reduced) finish(); else timer = setTimeout(finish, 200);
  };
  return { node, follow, settle, remove };
}
