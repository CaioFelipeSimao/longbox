// A body-mounted visual leaves scroll containers and their stacking contexts
// untouched. The real node keeps its layout box and pointer capture in the list.
// Reusable for cards in strips and in sheet scroll bodies.
export function criarGhost(card, grabOffset, reduced = false) {
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
    pointerEvents: "none", zIndex: "14", animation: "none", opacity: "1",
    transition: "none", transformOrigin: `${grabOffset.x}px ${grabOffset.y}px` });
  card.ownerDocument.body.appendChild(node);
  card.dataset.dragHole = "true";
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
    node.style.transform = `translate(${pointer.x - grabOffset.x}px, ${pointer.y - grabOffset.y}px) scale(${reduced ? 1 : 1.06})`;
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
