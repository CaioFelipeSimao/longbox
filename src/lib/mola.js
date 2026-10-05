export const OMEGA = 20;

// Exact critically damped step toward zero; position is px, velocity is px/s.
export function passoMola({ x, v }, dt, omega = OMEGA) {
  dt = Math.max(0, dt); // a negative dt would run the spring backwards and invent velocity
  const A = x;
  const B = v + omega * x;
  const e = Math.exp(-omega * dt);
  return { x: (A + B * dt) * e, v: (B - omega * (A + B * dt)) * e };
}

export function emRepouso({ x, v }, limX = 0.3, limV = 8) {
  return Math.abs(x) < limX && Math.abs(v) < limV;
}

export function passo2D({ ox, oy, vx, vy }, dt) {
  const horizontal = passoMola({ x: ox, v: vx }, dt);
  const vertical = passoMola({ x: oy, v: vy }, dt);
  return { ox: horizontal.x, oy: vertical.x, vx: horizontal.v, vy: vertical.v };
}
