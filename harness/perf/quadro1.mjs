import fs from "fs";
const ev = JSON.parse(fs.readFileSync("trace.json", "utf8")).traceEvents;
const mark = ev.find((e) => e.name === "troca" && e.ph !== "M");
const t0 = mark.ts;
let dec = 0, n = 0;
for (const e of ev) if (e.name === "Decode Image" && e.ph === "X" && e.ts >= t0 && e.ts < t0 + 1500000) { dec += e.dur / 1000; n++; }
// Presented frames: gaps between DrawFrame / BeginFrame on the compositor.
const quadros = ev.filter((e) => (e.name === "DrawFrame" || e.name === "Graphics.Pipeline.DrawAndSwap" || e.name === "Display::DrawAndSwap") && e.ts >= t0 && e.ts < t0 + 1500000).map((e) => e.ts).sort((a, b) => a - b);
let pior = 0; for (let i = 1; i < quadros.length; i++) pior = Math.max(pior, (quadros[i] - quadros[i - 1]) / 1000);
console.log("  decodificações: " + n + ", " + dec.toFixed(1) + " ms no total | maior intervalo entre quadros exibidos: " + pior.toFixed(0) + " ms (" + quadros.length + " quadros)");
