// Mulberry32, tüm rastgelelik state.seed üzerinden ilerler.
export function random(state) {
  state.seed = ((state.seed >>> 0) + 0x6D2B79F5) >>> 0;
  let value = state.seed;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
export function randomInt(state, min, max) { return min + Math.floor(random(state) * (max - min + 1)); }
