// Dünya geometrisi (dünya px). Ana yürüyüş yolu ("omurga") x=SPX boyunca dikey.
export const W = 820, H = 1420;
export const ROAD = { y0: 0, y1: 118 }, WALK_Y = 138, FENCE_Y = 152;
export const SPX = 420;               // yürüyüş hattı
export const SPINE = { x0: 368, x1: 472 };
export const LQ = 384, RQ = 457;      // sol / sağ kuyruk hatları

const p = (x, y) => ({ x, y });
export const G = {
  gise: {
    rect: { x: 478, y: 166, w: 104, h: 84 }, label: p(530, 160),
    svc: [p(462, 190), p(462, 214), p(462, 238)],
    queue: [p(446, 172), p(446, WALK_Y), p(800, WALK_Y)],
    pile: p(540, 268),
  },
  soyunma: {
    rect: { x: 92, y: 346, w: 206, h: 118 }, label: p(195, 340), inside: true,
    svc: [p(312, 405)], queue: [p(334, 405), p(LQ, 405), p(LQ, 290)],
    pile: p(334, 448),
  },
  dus: {
    rect: { x: 104, y: 506, w: 182, h: 96 }, label: p(195, 500), inside: true,
    svc: [p(300, 554)], queue: [p(322, 554), p(LQ, 554), p(LQ, 486)],
    pile: p(334, 590),
  },
  cay: {
    rect: { x: 46, y: 650, w: 150, h: 112 }, label: p(121, 644),
    svc: [p(214, 678), p(214, 704), p(214, 730)],
    queue: [p(244, 704), p(LQ, 704), p(LQ, 630)],
    pile: p(258, 650),
    seats: [], tables: [],
  },
  bufe: {
    rect: { x: 92, y: 966, w: 206, h: 100 }, label: p(195, 960),
    svc: [p(316, 996), p(316, 1022)], queue: [p(340, 1009), p(LQ, 1009), p(LQ, 940)],
    pile: p(334, 1050),
  },
  otopark: {
    rect: { x: 22, y: 166, w: 324, h: 150 }, label: p(184, 160),
    slots: [p(72, 262), p(140, 262), p(208, 262), p(276, 262)], aisle: 196, entryX: 40,
    pile: p(310, 196),
  },
  saha1: { rect: { x: 498, y: 292, w: 296, h: 468 }, label: p(646, 284), gate: p(498, 526), bench: { x: RQ, y0: 300 }, pile: p(452, 740) },
  saha2: { rect: { x: 498, y: 866, w: 296, h: 468 }, label: p(646, 858), gate: p(498, 1100), bench: { x: RQ, y0: 874 }, pile: p(452, 1314) },
};
// çay bahçesi masaları (kafe seviyesinde fazlası açılır)
const T = [p(262, 800), p(330, 800), p(262, 872), p(330, 872), p(80, 840), p(150, 840), p(80, 905), p(150, 905)];
T.forEach((t, i) => { G.cay.tables.push({ ...t, tier: i < 4 ? 0 : 1 }); G.cay.seats.push({ x: t.x - 20, y: t.y, table: i, face: 0 }, { x: t.x + 20, y: t.y, table: i, face: Math.PI }); });

export const LAMPS = [p(90, 126), p(300, 126), p(560, 126), p(760, 126), p(SPINE.x0 - 4, 330), p(SPINE.x0 - 4, 640), p(SPINE.x0 - 4, 950), p(SPINE.x0 - 4, 1250)];
export const TREES = [
  [12, 380, 'l'], [16, 520, 's'], [10, 640, 's'], [20, 1000, 'l'], [16, 1150, 's'], [24, 1300, 'l'], [130, 1180, 's'], [240, 1250, 'l'], [330, 1360, 's'],
  [812, 330, 's'], [814, 560, 'l'], [810, 760, 's'], [816, 980, 'l'], [812, 1200, 's'], [810, 1390, 'l'], [140, 1360, 'l'], [440, 1400, 's'], [620, 1405, 'l'],
];

// polyline üzerinde d mesafedeki nokta
export function along(poly, d) {
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l || i === poly.length - 2) { const t = l ? Math.min(d / l, 1.6) : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    d -= l;
  }
  return { ...poly[0] };
}
// omurga üzerinden rota: önce omurgaya, sonra hedefin hizasına, sonra hedefe
export function route(from, to) {
  const pts = [];
  if (Math.abs(from.x - SPX) > 6) pts.push({ x: SPX, y: from.y });
  if (Math.abs(to.y - from.y) > 4) pts.push({ x: SPX, y: to.y });
  pts.push({ x: to.x, y: to.y });
  return pts;
}
