// Small math and random helpers shared by every module.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});

  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    rad: (deg) => (deg * Math.PI) / 180,
    deg: (rad) => (rad * 180) / Math.PI,
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

    // Random helpers take an rng function so the simulation can be seeded in tests.
    rand: (rng, a, b) => a + (b - a) * rng(),
    chance: (rng, p) => rng() < p,
    pick: (rng, arr) => arr[Math.floor(rng() * arr.length)],
    gauss(rng, mean, sd) {
      let u = 0;
      let v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted(rng, weights) {
      // weights: { key: weight }
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = rng() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return Object.keys(weights)[0];
    },
    // Deterministic RNG (mulberry32) for tests and roster generation.
    seeded(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
  };

  BB.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
