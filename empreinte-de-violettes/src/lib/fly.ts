"use client";

/** Petite animation « vol vers le panier » depuis un élément source. */
export function flyToCart(from: Element | null, image?: string) {
  if (typeof window === "undefined" || !from) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.querySelector("[data-cart-target]");
  if (!target) return;
  const a = from.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  // l'en-tête peut être masqué au moment du clic : on vise sa position d'arrivée
  const b = r.bottom < 0 ? new DOMRect(r.left, 18, r.width, r.height) : r;
  const size = Math.min(140, a.width * 0.5);
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "300",
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    pointerEvents: "none",
    background: image ? `center/cover no-repeat url("${image.startsWith("https://images.unsplash.com") ? image.split("?")[0] + "?w=200&q=60" : image}")` : "linear-gradient(135deg,#C6A15B,#F3E4BB)",
    boxShadow: "0 0 0 2px #C6A15B, 0 20px 50px rgba(0,0,0,0.45)",
  });
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = el.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 120}px) scale(0.7)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.6 },
    ],
    { duration: 900, easing: "cubic-bezier(0.65,0,0.35,1)" },
  );
  anim.onfinish = () => el.remove();
}
