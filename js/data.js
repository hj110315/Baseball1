// Static tables: difficulty settings, pitch types, preset teams and roster generation.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  // ---------------------------------------------------------------------------
  // Difficulty. Times are animation seconds from release to the plate.
  // Timing windows are in milliseconds either side of a perfect swing.
  // ---------------------------------------------------------------------------
  const DIFFICULTIES = {
    easy: {
      label: 'Easy',
      travelFb: 1.05, // fastball travel time; other pitches scale from it
      mphFb: 86,
      windows: { perfect: 48, good: 110, foul: 155 },
      showPitchType: true, // label the pitch at release
      showLocation: true, // show where the pitch will cross the plate
      cpuCommand: 0.3, // CPU pitcher's location error (zone units)
      cpuStrikeBias: 0.08, // CPU throws more strikes on Easy
      cpuFbShare: 0.68, // share of fastball-family pitches the CPU throws
      cpuSigma: 112, // CPU batter's timing error (ms)
      cpuChase: 1.3, // multiplier on how often the CPU chases bad pitches
      cpuPower: 0.93,
      cpuFielding: 0.93,
      playerControl: 0.12, // your pitching location error (zone units)
      cpuSteal: 0.05,
      cpuCatcher: 0.15, // extra seconds the CPU catcher needs to throw out a stealer
    },
    medium: {
      label: 'Medium',
      travelFb: 0.86,
      mphFb: 91,
      windows: { perfect: 36, good: 88, foul: 128 },
      showPitchType: true,
      showLocation: false,
      cpuCommand: 0.24,
      cpuStrikeBias: 0.03,
      cpuFbShare: 0.55,
      cpuSigma: 94,
      cpuChase: 1.0,
      cpuPower: 1.0,
      cpuFielding: 1.0,
      playerControl: 0.17,
      cpuSteal: 0.08,
      cpuCatcher: 0.05,
    },
    hard: {
      label: 'Hard',
      travelFb: 0.72,
      mphFb: 95,
      windows: { perfect: 27, good: 70, foul: 105 },
      showPitchType: false,
      showLocation: false,
      cpuCommand: 0.17,
      cpuStrikeBias: 0,
      cpuFbShare: 0.46,
      cpuSigma: 80,
      cpuChase: 0.72,
      cpuPower: 1.06,
      cpuFielding: 1.06,
      playerControl: 0.22,
      cpuSteal: 0.11,
      cpuCatcher: 0,
    },
  };

  // Reference timing windows used to score the CPU's swings, so its hitting
  // only changes with its timing error and not with your difficulty windows.
  const CPU_WINDOWS = { perfect: 36, good: 88, foul: 128 };

  // ---------------------------------------------------------------------------
  // Pitch types, for a right-handed pitcher (mirrored for lefties).
  //   mphDelta   speed relative to the pitcher's fastball
  //   travelMul  travel time relative to the fastball
  //   breakX/Y   movement in feet at the plate: x toward first base, y up
  //   extraSigma how much harder it is to locate (zone units)
  //   phiShift   launch angle change on contact (negative = more grounders)
  //   evMul      exit velocity multiplier on contact
  //   chase      extra chance a CPU hitter chases it out of the zone
  //   fool       how much a speed change from the previous pitch throws off timing
  //   family     'fast' or 'off' (used for the CPU's pitch mix)
  // ---------------------------------------------------------------------------
  const PITCHES = {
    fb: { key: 'fb', name: 'Fastball', label: 'Fastball', short: 'FF', mphDelta: 0, travelMul: 1, breakX: -0.15, breakY: 0.25, extraSigma: 0, phiShift: 2, evMul: 1, chase: 0, fool: 1, family: 'fast' },
    si: { key: 'si', name: 'Sinker', label: 'Sinker', short: 'SI', mphDelta: -2, travelMul: 1.03, breakX: -0.75, breakY: -0.5, extraSigma: 0.02, phiShift: -7, evMul: 0.98, chase: 0.02, fool: 1, family: 'fast' },
    ct: { key: 'ct', name: 'Cutter', label: 'Cutter', short: 'FC', mphDelta: -4, travelMul: 1.06, breakX: 0.4, breakY: 0.0, extraSigma: 0.03, phiShift: -1, evMul: 0.94, chase: 0.04, fool: 1, family: 'fast' },
    sl: { key: 'sl', name: 'Slider', label: 'Slider', short: 'SL', mphDelta: -8, travelMul: 1.16, breakX: 1.05, breakY: -0.6, extraSigma: 0.05, phiShift: -2, evMul: 0.97, chase: 0.1, fool: 1, family: 'off' },
    cv: { key: 'cv', name: 'Curveball', label: 'Curve', short: 'CU', mphDelta: -14, travelMul: 1.26, breakX: 0.75, breakY: -1.55, extraSigma: 0.05, phiShift: -2, evMul: 0.98, chase: 0.07, fool: 0.7, family: 'off' },
    ch: { key: 'ch', name: 'Change-up', label: 'Change', short: 'CH', mphDelta: -9, travelMul: 1.28, breakX: -0.55, breakY: -0.75, extraSigma: 0.03, phiShift: -3, evMul: 0.97, chase: 0.08, fool: 1.5, family: 'off' },
    sp: { key: 'sp', name: 'Splitter', label: 'Splitter', short: 'FS', mphDelta: -7, travelMul: 1.18, breakX: -0.2, breakY: -1.35, extraSigma: 0.06, phiShift: -6, evMul: 0.96, chase: 0.12, fool: 1.4, family: 'off' },
  };
  const PITCH_ORDER = ['fb', 'si', 'ct', 'sl', 'cv', 'ch', 'sp'];

  // ---------------------------------------------------------------------------
  // Teams. All names are fictional.
  // ---------------------------------------------------------------------------
  const COLORS = [
    { name: 'Red', hex: '#d64541' },
    { name: 'Orange', hex: '#ec7a2c' },
    { name: 'Gold', hex: '#e9b52c' },
    { name: 'Green', hex: '#2e8b57' },
    { name: 'Teal', hex: '#17908a' },
    { name: 'Sky', hex: '#2f9bd9' },
    { name: 'Navy', hex: '#24427a' },
    { name: 'Purple', hex: '#6d4bb0' },
    { name: 'Pink', hex: '#d9488f' },
    { name: 'Charcoal', hex: '#3b3f47' },
  ];

  const CPU_TEAMS = [
    { id: 'hawks', name: 'Harbor Hawks', abbr: 'HAW', color: '#24427a' },
    { id: 'comets', name: 'Valley Comets', abbr: 'VAL', color: '#d64541' },
    { id: 'bolts', name: 'Iron City Bolts', abbr: 'ICB', color: '#e9b52c' },
    { id: 'foxes', name: 'Desert Foxes', abbr: 'DES', color: '#ec7a2c' },
    { id: 'owls', name: 'Northside Owls', abbr: 'NOR', color: '#6d4bb0' },
    { id: 'kings', name: 'River Kings', abbr: 'RIV', color: '#17908a' },
    { id: 'bears', name: 'Summit Bears', abbr: 'SUM', color: '#7a5236' },
    { id: 'gulls', name: 'Coastal Gulls', abbr: 'COA', color: '#2f9bd9' },
  ];

  const FIRST = [
    'Alex', 'Ben', 'Carlos', 'Dante', 'Eli', 'Felix', 'Gabe', 'Hiro', 'Isaac', 'Jae', 'Kai', 'Leo',
    'Marco', 'Nate', 'Omar', 'Pablo', 'Quinn', 'Rafa', 'Sam', 'Theo', 'Uri', 'Vic', 'Wes', 'Yuki',
    'Zane', 'Andre', 'Bo', 'Cole', 'Diego', 'Evan', 'Finn', 'Gus', 'Hank', 'Ivan', 'Jonah', 'Kenji',
    'Luis', 'Max', 'Noah', 'Owen', 'Pete', 'Ray', 'Seth', 'Toby', 'Vince', 'Will', 'Xavi', 'Min-jun',
  ];
  const LAST = [
    'Alvarez', 'Baker', 'Castillo', 'Duarte', 'Ellis', 'Fujita', 'Garza', 'Hale', 'Ibarra', 'Jensen',
    'Kwon', 'Lopez', 'Moreno', 'Nakamura', 'Ortega', 'Park', 'Quintero', 'Reyes', 'Santos', 'Torres',
    'Vega', 'Walsh', 'Young', 'Zamora', 'Brooks', 'Cruz', 'Dunn', 'Flores', 'Grant', 'Hayes', 'Kim',
    'Lee', 'Mendez', 'Novak', 'Price', 'Ramos', 'Silva', 'Tanaka', 'Usher', 'Voss', 'Ward', 'Yang',
  ];

  // Batting order positions, shaped like a real lineup:
  // fast leadoff hitters, power in the middle.
  const LINEUP_SHAPE = [
    { pos: 'CF', contact: 1.08, power: 0.9, speed: 1.12 },
    { pos: 'SS', contact: 1.06, power: 0.95, speed: 1.06 },
    { pos: '1B', contact: 1.05, power: 1.08, speed: 0.95 },
    { pos: 'RF', contact: 1.0, power: 1.14, speed: 0.98 },
    { pos: '3B', contact: 0.98, power: 1.08, speed: 0.96 },
    { pos: 'LF', contact: 0.98, power: 1.0, speed: 1.0 },
    { pos: '2B', contact: 0.97, power: 0.92, speed: 1.04 },
    { pos: 'C', contact: 0.94, power: 0.97, speed: 0.9 },
    { pos: 'DH', contact: 0.93, power: 1.02, speed: 0.94 },
  ];

  function makeRoster(seed) {
    const rng = U.seeded(seed);
    const used = new Set();
    const name = () => {
      for (let i = 0; i < 50; i++) {
        const n = U.pick(rng, FIRST)[0] + '. ' + U.pick(rng, LAST);
        if (!used.has(n)) {
          used.add(n);
          return n;
        }
      }
      return 'J. Doe';
    };
    const jitter = () => U.rand(rng, -0.05, 0.05);
    const lineup = LINEUP_SHAPE.map((s, i) => ({
      name: name(),
      pos: s.pos,
      num: 1 + Math.floor(rng() * 60),
      hand: rng() < 0.3 ? 'L' : 'R',
      contact: +(s.contact + jitter()).toFixed(2),
      power: +(s.power + jitter()).toFixed(2),
      speed: +(s.speed + jitter()).toFixed(2),
      slot: i,
    }));
    // Pitching staff: a starter and four relievers, each with their own pitches.
    const staff = [];
    for (let i = 0; i < 5; i++) {
      const starter = i === 0;
      const closer = i === 4;
      const tpl = U.pick(rng, starter ? STARTER_ARSENALS : RELIEF_ARSENALS);
      staff.push({
        name: name(),
        pos: 'P',
        role: starter ? 'SP' : closer ? 'CL' : 'RP',
        num: 1 + Math.floor(rng() * 60),
        hand: rng() < 0.3 ? 'L' : 'R',
        velo: +(U.rand(rng, -2, 2) + (closer ? 2 : starter ? 0 : 1)).toFixed(1), // mph vs. the difficulty's fastball
        control: +U.rand(rng, 0.88, 1.12).toFixed(2), // multiplies location error (lower is better)
        stamina: Math.round(starter ? U.rand(rng, 85, 100) : U.rand(rng, 22, 34)), // pitches before tiring
        arsenal: tpl.map((key) => ({ key, q: +U.rand(rng, 0.92, 1.1).toFixed(2) })),
      });
    }
    return { lineup, staff, pitcher: staff[0] };
  }

  // Pitch sets. The first pitch is always from the fastball family.
  const STARTER_ARSENALS = [
    ['fb', 'sl', 'ch', 'cv'],
    ['fb', 'cv', 'ch', 'ct'],
    ['si', 'sl', 'ch', 'fb'],
    ['fb', 'sp', 'sl', 'cv'],
    ['fb', 'ct', 'cv', 'ch', 'sl'],
    ['si', 'ct', 'cv', 'ch'],
  ];
  const RELIEF_ARSENALS = [
    ['fb', 'sl', 'ch'],
    ['si', 'sl', 'ct'],
    ['fb', 'sp', 'sl'],
    ['fb', 'cv', 'ch'],
    ['ct', 'cv', 'ch'],
    ['si', 'ch', 'sl'],
    ['fb', 'sl', 'cv', 'sp'],
  ];

  function abbrFor(name) {
    const words = String(name || '').trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (!words.length) return 'YOU';
    if (words.length >= 3) return words.slice(0, 3).map((w) => w[0]).join('');
    if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).padEnd(3, 'X');
    return words[0].slice(0, 3).padEnd(3, 'X');
  }

  BB.DIFFICULTIES = DIFFICULTIES;
  BB.CPU_WINDOWS = CPU_WINDOWS;
  BB.PITCHES = PITCHES;
  BB.PITCH_ORDER = PITCH_ORDER;
  BB.COLORS = COLORS;
  BB.CPU_TEAMS = CPU_TEAMS;
  BB.makeRoster = makeRoster;
  BB.abbrFor = abbrFor;
})(typeof window !== 'undefined' ? window : globalThis);
