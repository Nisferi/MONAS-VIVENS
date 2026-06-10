/**
 * Golden-реплеи: канонические партии с вмешательствами прогоняются на
 * каждом коммите; хэши мира на контрольных тиках сравниваются с эталоном.
 * Любое молчаливое изменение движка ломает реплеи, дуэли и Очаг —
 * этот тест не даст ему пройти незамеченным.
 *
 * Обновление эталона (после ОСОЗНАННОГО изменения правил):
 *   bash scripts/golden.sh --update
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const outDir = process.argv[2];
const update = process.argv[3] === '--update';
const GOLDEN_PATH = new URL('../tests/golden.json', import.meta.url);

const mod = async (p) => import(pathToFileURL(`${outDir}/${p}`).href);
const { createWorld, setGridSize } = await mod('core/grid.js');
const { generateTerrain } = await mod('core/terrain.js');
const { tick } = await mod('core/rules.js');
const { ClusterTracker } = await mod('phi/clusters.js');
const { NeikosMeter } = await mod('phi/neikos.js');
const { computePhi } = await mod('phi/phi.js');
const { makeRun } = await mod('run/setup.js');
const { TabletEngine } = await mod('tablets/engine.js');

/** FNV-1a по клеткам, родам и энергии. */
function hashWorld(w) {
  let h = 0x811c9dc5;
  const mix = (b) => {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (let i = 0; i < w.cells.length; i++) {
    mix(w.cells[i]);
    mix(w.kind[i]);
  }
  const e = Math.round(w.energy * 1000);
  mix(e & 0xff); mix((e >> 8) & 0xff); mix((e >> 16) & 0xff);
  return h >>> 0;
}

/** Канонические партии: разные биомы/режимы + вмешательства реплейного вида. */
const CASES = [
  {
    name: 'swamp-clay-64',
    run: ['золотой-1', 'swamp', 'clay', 64, 'flow'],
    checkpoints: [200, 1000, 2500],
    events: [
      { t: 300, k: 'me', me: { birthMin: 3, birthMax: 3, surviveMin: 2, surviveMax: 4, ashLifetime: 8 } },
      { t: 700, k: 'carve', c: { kind: 'energyBelow', threshold: 50 }, a: 'sleep' },
      { t: 900, k: 'sow', i: 2080, s: 1 },
      { t: 900, k: 'sow', i: 2081, s: 1 },
    ],
  },
  {
    name: 'spring-spark-48',
    run: ['золотой-2', 'spring', 'spark', 48, 'flow'],
    checkpoints: [200, 1800],
    events: [{ t: 500, k: 'carve', c: { kind: 'stormSoon', threshold: 75 }, a: 'infuse' }],
  },
  {
    name: 'cave-echo-96-sower',
    run: ['золотой-3', 'cave', 'echo', 96, 'sower'],
    checkpoints: [30, 120, 2200],
    events: [
      { t: 0, k: 'sow', i: 4656, s: 0 }, { t: 0, k: 'sow', i: 4657, s: 0 },
      { t: 0, k: 'sow', i: 4752, s: 1 }, { t: 0, k: 'sow', i: 4753, s: 1 },
      { t: 0, k: 'sow', i: 4754, s: 2 }, { t: 0, k: 'sow', i: 4848, s: 2 },
      { t: 0, k: 'sow', i: 4849, s: 0 }, { t: 0, k: 'sow', i: 4850, s: 1 },
    ],
  },
];

function play(c) {
  const cfg = makeRun(...c.run);
  setGridSize(cfg.size);
  const land = generateTerrain(cfg.seed, cfg.terrain);
  let me = { ...cfg.me };
  let w = createWorld(cfg.seed, cfg.density, cfg.startEnergy, land);
  const tr = new ClusterTracker();
  tr.reset();
  const nm = new NeikosMeter();
  const te = new TabletEngine();
  const events = [...c.events].sort((a, b) => a.t - b.t);
  let ei = 0;
  const hashes = {};
  const last = Math.max(...c.checkpoints);
  while (w.tick < last) {
    while (ei < events.length && events[ei].t <= w.tick) {
      const ev = events[ei++];
      if (ev.k === 'me') me = { ...me, ...ev.me };
      else if (ev.k === 'sow') {
        if (w.cells[ev.i] !== 1 && w.terrain[ev.i] !== 1) {
          w.cells[ev.i] = 1; w.age[ev.i] = 0; w.kind[ev.i] = ev.s;
        }
      } else if (ev.k === 'carve') te.carve(ev.c, ev.a, w);
    }
    w = tick(w, me);
    const cl = tr.update(w);
    te.update(w, cl, computePhi(cl, nm.update(tr.events)), me);
    if (c.checkpoints.includes(w.tick)) hashes[w.tick] = hashWorld(w);
  }
  return hashes;
}

const actual = {};
for (const c of CASES) actual[c.name] = play(c);

if (update) {
  writeFileSync(GOLDEN_PATH, `${JSON.stringify(actual, null, 2)}\n`);
  console.log('Эталон обновлён:', JSON.stringify(actual));
  process.exit(0);
}

const expected = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
let failed = false;
for (const c of CASES) {
  for (const [tickNo, hash] of Object.entries(expected[c.name] ?? {})) {
    const got = actual[c.name]?.[tickNo];
    const ok = got === hash;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name} @${tickNo}: ${got} ${ok ? '==' : '!='} ${hash}`);
  }
}
if (failed) {
  console.error('\nДетерминизм движка изменился. Если это осознанно — bash scripts/golden.sh --update');
  process.exit(1);
}
console.log('\nЗолотые реплеи целы: детерминизм подтверждён.');
