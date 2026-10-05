import fs from "node:fs";

// The app is CommonJS, but this pure ESM source needs neither a build nor DOM.
const source = fs.readFileSync(new URL("../src/lib/mola.js", import.meta.url), "utf8");
const { OMEGA, passoMola, emRepouso, passo2D } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
let passes = 0, falhas = 0;
const check = (nome, ok) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome);
};
const perto = (a, b, epsilon = 1e-10) => Math.abs(a - b) < epsilon;

check("natural frequency is 20 rad/s", OMEGA === 20);
const neg = passoMola({ x: 274, v: 0 }, -0.0253);
check("a negative dt leaves the state untouched (no invented velocity)", neg.x === 274 && neg.v === 0);
let estado = { x: 300, v: 0 };
let semOvershoot = true;
for (let frame = 0; frame < 30; frame++) {
  estado = passoMola(estado, 1 / 60);
  if (estado.x < -300 * 0.02 || estado.x > 300 * 1.02) semOvershoot = false;
}
check("300px displacement rests within half a second at 60fps", emRepouso(estado));
check("zero initial velocity never overshoots by more than two percent", semOvershoot);
let negativo = { x: -300, v: 0 };
let simetrico = true;
for (let frame = 0; frame < 120; frame++) {
  negativo = passoMola(negativo, 1 / 60);
  if (negativo.x > 300 * 0.02 || negativo.x < -300 * 1.02) simetrico = false;
}
check("negative displacement also stays within the overshoot limit", simetrico);

const retarget = Object.freeze({ x: 100, v: -2000 });
const dt = 1e-6;
const primeiro = passoMola(retarget, dt);
check("retarget preserves first-frame displacement from incoming velocity",
  perto(primeiro.x, retarget.x + retarget.v * dt, 1e-7));
const paradoNoTempo = passoMola(retarget, 0);
check("zero dt preserves position and velocity", paradoNoTempo.x === retarget.x && paradoNoTempo.v === retarget.v);
check("scalar step returns a new state without mutating the input",
  paradoNoTempo !== retarget && retarget.x === 100 && retarget.v === -2000);
const longo = passoMola({ x: 300, v: -2000 }, 1);
check("one-second step returns finite numbers near zero",
  Number.isFinite(longo.x) && Number.isFinite(longo.v) && Math.abs(longo.x) < 0.001 && Math.abs(longo.v) < 0.001);

check("rest accepts both signs inside the default thresholds",
  emRepouso({ x: 0.299, v: -7.99 }) && emRepouso({ x: -0.299, v: 7.99 }));
check("rest excludes either position threshold boundary",
  !emRepouso({ x: 0.3, v: 0 }) && !emRepouso({ x: -0.3, v: 0 }));
check("rest excludes either velocity threshold boundary",
  !emRepouso({ x: 0, v: 8 }) && !emRepouso({ x: 0, v: -8 }));
check("rest respects custom thresholds",
  emRepouso({ x: -0.9, v: 1.9 }, 1, 2) && !emRepouso({ x: 1, v: 0 }, 1, 2));
const lento = passoMola({ x: 100, v: 0 }, 0.1, 10);
check("custom natural frequency follows the analytic solution",
  perto(lento.x, 200 / Math.E) && perto(lento.v, -1000 / Math.E));

const entrada2D = Object.freeze({ ox: 300, oy: -100, vx: -250, vy: 700 });
const resultado2D = passo2D(entrada2D, 1 / 60);
const horizontal = passoMola({ x: entrada2D.ox, v: entrada2D.vx }, 1 / 60);
const vertical = passoMola({ x: entrada2D.oy, v: entrada2D.vy }, 1 / 60);
check("2D step evolves each axis independently",
  resultado2D.ox === horizontal.x && resultado2D.vx === horizontal.v &&
  resultado2D.oy === vertical.x && resultado2D.vy === vertical.v);
const outraHorizontal = passo2D({ ...entrada2D, ox: 0, vx: 10000 }, 1 / 60);
check("changing one axis leaves the other unchanged",
  outraHorizontal.oy === resultado2D.oy && outraHorizontal.vy === resultado2D.vy);
check("2D step returns a new object without mutating its input",
  resultado2D !== entrada2D && entrada2D.ox === 300 && entrada2D.oy === -100 && entrada2D.vx === -250 && entrada2D.vy === 700);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
