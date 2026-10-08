// Juice: pitch'ten para sayacına uçan bozuk paralar.
import { icon } from './icons.js';
import { sfx } from './audio.js';

function pulse() {
  const chip = document.getElementById('hud-money-chip');
  if (!chip) return;
  chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse');
}
export function coinBurst(from, n = 6) {
  const chip = document.getElementById('hud-money-chip');
  if (!chip || !from || document.hidden) return;
  const r = chip.getBoundingClientRect(), tx = r.left + 26, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'coin-fly'; el.innerHTML = icon('coin');
    document.body.appendChild(el);
    const sx = from.x + (Math.random() - 0.5) * 80, sy = from.y - 20 - Math.random() * 40;
    const a = el.animate([
      { transform: `translate(${from.x - 11}px,${from.y - 11}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${sx - 11}px,${sy - 11}px) scale(1.15)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${tx - 11}px,${ty - 11}px) scale(.55)`, opacity: 1 },
    ], { duration: 650 + Math.random() * 250, delay: i * 55, easing: 'cubic-bezier(.45,.05,.75,.35)', fill: 'backwards' });
    a.onfinish = () => { el.remove(); pulse(); if (i % 2 === 0) sfx('coin'); };
    a.oncancel = () => el.remove();
  }
}
