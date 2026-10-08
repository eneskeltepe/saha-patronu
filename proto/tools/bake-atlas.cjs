// One-time asset baker: packs the Kenney sprites we use into proto/assets/atlas.png + atlas.json.
// Usage: node proto/tools/bake-atlas.cjs <kenney-dl dir>   (needs playwright-core + Chrome)
const PW = 'C:/Users/EnesKaltepe/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core';
const fs = require('fs'), path = require('path');
const K = process.argv[2];
if (!K) { console.error('usage: node bake-atlas.cjs <kenney-dl dir>'); process.exit(1); }
const OUT = path.resolve(__dirname, '../assets');

const sheets = {
  obj: ['racing/Spritesheets/spritesheet_objects'],
  veh: ['racing/Spritesheets/spritesheet_vehicles'],
  chr: ['racing/Spritesheets/spritesheet_characters'],
  eq: ['sports/Spritesheet/sheet_equipment', 'sheet_equipment.png'],
};
const want = {
  obj: ['tree_large', 'tree_small', 'tent_red', 'tent_blue', 'tribune_full', 'tribune_empty', 'tribune_overhang_striped', 'tribune_overhang_red',
    'cone_straight', 'barrier_white', 'barrier_red', 'light_yellow', 'light_white', 'rock1', 'rock2', 'tires_white', 'barrel_red', 'barrel_blue', 'lights'],
  veh: ['blue', 'red', 'green', 'yellow', 'black'].flatMap((c) => [`car_${c}_1`, `car_${c}_3`, `car_${c}_5`]),
  chr: ['black', 'blonde', 'brown'].flatMap((h) => ['blue', 'red', 'green', 'white'].map((c) => `character_${h}_${c}`)),
  eq: ['ball_soccer2', 'ball_soccer1', 'card_yellow', 'flag_white'],
};

const data = {}, rects = {};
for (const [k, [base]] of Object.entries(sheets)) {
  const png = fs.readFileSync(path.join(K, base + '.png'));
  data[k] = 'data:image/png;base64,' + png.toString('base64');
  const xml = fs.readFileSync(path.join(K, base + '.xml'), 'utf8');
  rects[k] = {};
  for (const m of xml.matchAll(/name="([^"]+)\.png" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) rects[k][m[1]] = [+m[2], +m[3], +m[4], +m[5]];
}
const items = [];
for (const [k, names] of Object.entries(want)) for (const n of names) {
  if (!rects[k][n]) throw new Error('missing ' + n);
  items.push({ k, n, r: rects[k][n] });
}

(async () => {
  const pw = require(PW);
  const b = await pw.chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  const res = await p.evaluate(async ({ data, items }) => {
    const imgs = {};
    await Promise.all(Object.entries(data).map(([k, u]) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(imgs[k] = i); i.src = u; })));
    // extra kit colours: recolour the blue shirts to orange / yellow / black
    const extra = [];
    for (const h of ['black', 'blonde', 'brown']) for (const [c, rgb] of [['crimson', [225, 50, 60]], ['yellow', [250, 200, 30]], ['purple', [150, 80, 200]]]) {
      const src = items.find((it) => it.n === `character_${h}_blue`);
      extra.push({ k: 'chr', n: `character_${h}_${c}`, r: src.r, tint: rgb });
    }
    const all = items.concat(extra).sort((a, b) => b.r[3] - a.r[3]);
    const W = 1024, PAD = 2; let x = 0, y = 0, rowH = 0; const out = {};
    for (const it of all) {
      const [, , w, h] = it.r;
      if (x + w + PAD > W) { x = 0; y += rowH + PAD; rowH = 0; }
      out[it.n] = [x, y, w, h]; it.at = [x, y];
      x += w + PAD; rowH = Math.max(rowH, h);
    }
    const H = y + rowH;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    for (const it of all) {
      const [sx, sy, w, h] = it.r;
      g.drawImage(imgs[it.k], sx, sy, w, h, it.at[0], it.at[1], w, h);
      if (it.tint) {
        const id = g.getImageData(it.at[0], it.at[1], w, h), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], gg = d[i + 1], bb = d[i + 2];
          if (bb > r + 40 && bb > gg + 10) { // blue shirt pixel: keep its brightness, swap hue
            const l = bb / 220;
            d[i] = Math.min(255, it.tint[0] * l); d[i + 1] = Math.min(255, it.tint[1] * l); d[i + 2] = Math.min(255, it.tint[2] * l);
          }
        }
        g.putImageData(id, it.at[0], it.at[1]);
      }
    }
    return { png: cv.toDataURL('image/png'), frames: out, W, H };
  }, { data, items });
  fs.writeFileSync(path.join(OUT, 'atlas.png'), Buffer.from(res.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(res.frames));
  console.log('atlas', res.W + 'x' + res.H, Object.keys(res.frames).length, 'frames');
  await b.close();
})();
