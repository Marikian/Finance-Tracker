// Small motion helpers. Everything degrades to instant under reduced-motion.
const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

/**
 * Count a number element up to its value.
 * @param {HTMLElement} node   target element (text is replaced)
 * @param {number} to          final value
 * @param {(n:number)=>string} format  formatter (e.g. money)
 * @param {number} [duration]  ms
 */
export function countUp(node, to, format, duration = 520) {
  if (reduce() || !Number.isFinite(to)) { node.textContent = format(to); return; }
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    node.textContent = format(from + (to - from) * easeOutQuint(t));
    if (t < 1) requestAnimationFrame(frame);
    else node.textContent = format(to);
  }
  requestAnimationFrame(frame);
}
