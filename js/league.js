// The franchise league: 30 fictional teams, player generation, ratings,
// depth charts, contracts, the schedule, and adapters from ratings to the
// numbers the game simulation uses. No DOM access (Node-testable).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  // ---------------------------------------------------------------------------
  // Teams. All names are fictional.
  // ---------------------------------------------------------------------------
  const LEAGUES = ['Coast League', 'Heartland League'];
  const DIVS = ['North', 'Central', 'South'];
  // [id, city, name, color, color2, market]
  const TEAM_ROWS = [
    // Coast League
    ['HAW', 'Harbor City', 'Hawks', '#24427a', '#f2c94c', 3],
    ['NOR', 'Northside', 'Owls', '#6d4bb0', '#f4d35e', 2],
    ['BAY', 'Bayport', 'Pilots', '#1b6ca8', '#e8e3d3', 2],
    ['GRA', 'Granite Falls', 'Grizzlies', '#5b4636', '#c9a227', 1],
    ['LAK', 'Lakeshore', 'Lynx', '#2a9d8f', '#264653', 2],
    ['VAL', 'Valley', 'Comets', '#d64541', '#1d2433', 3],
    ['SIL', 'Silver City', 'Stallions', '#6c7a91', '#1d2433', 2],
    ['RVB', 'Riverbend', 'Otters', '#8a5a44', '#8ecae6', 1],
    ['CAP', 'Capitol', 'Sentinels', '#b5213b', '#1f3a5f', 3],
    ['PRA', 'Prairie', 'Bison', '#9c6644', '#ede0d4', 1],
    ['DES', 'Desert', 'Foxes', '#ec7a2c', '#2b2d42', 2],
    ['COA', 'Coastal', 'Gulls', '#2f9bd9', '#f7f7f2', 2],
    ['SUN', 'Sunset Beach', 'Waves', '#ff7f51', '#2ec4b6', 3],
    ['MES', 'Mesa', 'Scorpions', '#c1121f', '#fdf0d5', 1],
    ['PAL', 'Palm Harbor', 'Parrots', '#3a9d23', '#ffd60a', 2],
    // Heartland League
    ['ICB', 'Iron City', 'Bolts', '#e9b52c', '#22223b', 3],
    ['SUM', 'Summit', 'Bears', '#7a5236', '#e9c46a', 2],
    ['TIM', 'Timberline', 'Lumberjacks', '#2d6a4f', '#d8f3dc', 1],
    ['FRO', 'Frostburg', 'Huskies', '#457b9d', '#f1faee', 1],
    ['RID', 'Ridgeview', 'Kestrels', '#3d405b', '#8d99ae', 2],
    ['RIV', 'River', 'Kings', '#17908a', '#f4f1de', 2],
    ['UNI', 'Union City', 'Engineers', '#e07a5f', '#3d405b', 3],
    ['GPH', 'Golden Plains', 'Harvesters', '#dda15e', '#283618', 1],
    ['STE', 'Steeltown', 'Smelters', '#5c677d', '#fca311', 2],
    ['TWR', 'Twin Rivers', 'Paddlers', '#0077b6', '#90e0ef', 2],
    ['DEL', 'Delta', 'Gators', '#386641', '#a7c957', 1],
    ['MAG', 'Magnolia', 'Monarchs', '#7b2cbf', '#e0aaff', 2],
    ['CAN', 'Canyon', 'Roadrunners', '#e76f51', '#264653', 1],
    ['GUL', 'Gulf Coast', 'Pelicans', '#0096c7', '#023e8a', 3],
    ['OLD', 'Old Town', 'Outlaws', '#9d0208', '#ffba08', 2],
  ];
  const TEAMS = TEAM_ROWS.map((r, i) => ({
    id: r[0],
    city: r[1],
    name: r[2],
    abbr: r[0],
    color: r[3],
    color2: r[4],
    market: r[5],
    league: Math.floor(i / 15),
    div: Math.floor((i % 15) / 5),
  }));
  const BUDGET = { 1: 115, 2: 150, 3: 195 }; // $M payroll by market size

  const FIRST = [
    'Aaron', 'Adrian', 'Alex', 'Andre', 'Angel', 'Ben', 'Blake', 'Bo', 'Brandon', 'Brent', 'Caleb', 'Cam', 'Carlos',
    'Chris', 'Cole', 'Colin', 'Connor', 'Dante', 'Darius', 'Dev', 'Diego', 'Dominic', 'Drew', 'Dylan', 'Eddie',
    'Eli', 'Emilio', 'Eric', 'Ethan', 'Evan', 'Felix', 'Finn', 'Gabe', 'Gavin', 'Grant', 'Gus', 'Hank', 'Hector',
    'Hiro', 'Hunter', 'Ian', 'Isaac', 'Ivan', 'Jace', 'Jae', 'Jake', 'Jalen', 'Javier', 'Jesse', 'Joel', 'Jonah',
    'Jordan', 'Jose', 'Julian', 'Kai', 'Kenji', 'Kevin', 'Kyle', 'Lane', 'Leo', 'Liam', 'Logan', 'Luca', 'Luis',
    'Malik', 'Manny', 'Marco', 'Mason', 'Mateo', 'Max', 'Micah', 'Miguel', 'Min-jun', 'Nate', 'Nico', 'Noah',
    'Omar', 'Oscar', 'Owen', 'Pablo', 'Pedro', 'Pete', 'Quinn', 'Rafael', 'Ramon', 'Ray', 'Reid', 'Rico', 'Riley',
    'Ryan', 'Sam', 'Santiago', 'Sean', 'Seth', 'Shawn', 'Shota', 'Silas', 'Tate', 'Theo', 'Tomas', 'Trent', 'Troy',
    'Tyler', 'Victor', 'Vince', 'Wade', 'Wes', 'Will', 'Xavier', 'Yuki', 'Zach', 'Zane', 'Andres', 'Bryce', 'Cody',
    'Dario', 'Elias', 'Franco', 'Gio', 'Hugo', 'Isaiah', 'Jun', 'Kobe', 'Lorenzo', 'Marcus', 'Nolan', 'Orlando',
  ];
  const LAST = [
    'Abreu', 'Acosta', 'Adams', 'Alvarez', 'Archer', 'Ayala', 'Baker', 'Banks', 'Barnes', 'Bell', 'Blake', 'Bowen',
    'Brooks', 'Burke', 'Bryant', 'Cabrera', 'Calder', 'Campos', 'Carter', 'Castillo', 'Chang', 'Choi', 'Cole',
    'Collins', 'Cortes', 'Cruz', 'Daniels', 'Delgado', 'Diaz', 'Dixon', 'Doyle', 'Duarte', 'Dunn', 'Ellis',
    'Espinoza', 'Evans', 'Fajardo', 'Fields', 'Fischer', 'Flores', 'Ford', 'Fowler', 'Fujita', 'Garcia', 'Garza',
    'Gibson', 'Gomez', 'Grant', 'Graves', 'Hale', 'Hall', 'Harper', 'Hayes', 'Herrera', 'Hill', 'Holt', 'Howard',
    'Ibarra', 'Ishikawa', 'Jacobs', 'James', 'Jensen', 'Jimenez', 'Kane', 'Keller', 'Kim', 'Knight', 'Kwon',
    'Lambert', 'Lane', 'Lee', 'Lopez', 'Lowe', 'Lugo', 'Maddox', 'Marsh', 'Martinez', 'Mendez', 'Meyer', 'Miller',
    'Molina', 'Moreno', 'Morris', 'Murphy', 'Nakamura', 'Navarro', 'Nelson', 'Novak', 'Ochoa', 'Oliver', 'Ortega',
    'Ortiz', 'Owens', 'Park', 'Parker', 'Pena', 'Perez', 'Pierce', 'Porter', 'Price', 'Quinn', 'Quintero', 'Ramos',
    'Reed', 'Reyes', 'Rhodes', 'Rivera', 'Rojas', 'Romero', 'Ross', 'Ruiz', 'Salazar', 'Sanchez', 'Santos', 'Sato',
    'Shaw', 'Silva', 'Soto', 'Stone', 'Suarez', 'Sullivan', 'Tanaka', 'Tate', 'Torres', 'Tucker', 'Turner', 'Usher',
    'Valdez', 'Vargas', 'Vega', 'Voss', 'Wade', 'Walker', 'Walsh', 'Ward', 'Warren', 'Watts', 'Webb', 'Wells',
    'West', 'Wilson', 'Wolfe', 'Wright', 'Yang', 'Yates', 'Young', 'Zamora', 'Zimmer', 'Beltran', 'Okafor', 'Petrov',
  ];

  // ---------------------------------------------------------------------------
  // Ratings
  // ---------------------------------------------------------------------------
  const HIT_KEYS = ['con', 'pow', 'eye', 'spd', 'fld', 'arm'];
  const PIT_KEYS = ['vel', 'ctl', 'sta', 'stf'];
  const FIELD_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  // Position profiles: rating offsets for generated players.
  const PROFILE = {
    C: { con: -3, pow: 0, eye: 0, spd: -12, fld: 5, arm: 8 },
    '1B': { con: 2, pow: 8, eye: 3, spd: -8, fld: -6, arm: -6 },
    '2B': { con: 3, pow: -5, eye: 2, spd: 4, fld: 5, arm: -2 },
    '3B': { con: 0, pow: 5, eye: 0, spd: -3, fld: 3, arm: 8 },
    SS: { con: 0, pow: -5, eye: 0, spd: 6, fld: 9, arm: 7 },
    LF: { con: 2, pow: 5, eye: 1, spd: 0, fld: -3, arm: -3 },
    CF: { con: 2, pow: -2, eye: 1, spd: 10, fld: 7, arm: 2 },
    RF: { con: 0, pow: 6, eye: 0, spd: 0, fld: 0, arm: 9 },
    DH: { con: 4, pow: 10, eye: 4, spd: -8, fld: -15, arm: -10 },
  };
  // How much each rating counts toward overall, by position.
  const WEIGHTS = {
    C: { con: 0.26, pow: 0.2, eye: 0.12, spd: 0.04, fld: 0.22, arm: 0.16 },
    SS: { con: 0.27, pow: 0.18, eye: 0.12, spd: 0.13, fld: 0.2, arm: 0.1 },
    CF: { con: 0.27, pow: 0.18, eye: 0.12, spd: 0.13, fld: 0.2, arm: 0.1 },
    '2B': { con: 0.29, pow: 0.22, eye: 0.13, spd: 0.11, fld: 0.17, arm: 0.08 },
    DH: { con: 0.36, pow: 0.36, eye: 0.2, spd: 0.08, fld: 0, arm: 0 },
    std: { con: 0.3, pow: 0.27, eye: 0.14, spd: 0.09, fld: 0.12, arm: 0.08 },
    SP: { vel: 0.25, ctl: 0.27, stf: 0.33, sta: 0.15 },
    RP: { vel: 0.3, ctl: 0.27, stf: 0.38, sta: 0.05 },
  };
  // Who can play where without a big drop-off (penalty to their overall there).
  const FIT = {
    C: { C: 0 },
    '1B': { '1B': 0, LF: 4, RF: 4, '3B': 6, DH: 0 },
    '2B': { '2B': 0, SS: 5, '3B': 3, '1B': 2, LF: 3, RF: 4, CF: 6 },
    '3B': { '3B': 0, '1B': 1, '2B': 4, SS: 7, LF: 3, RF: 3 },
    SS: { SS: 0, '2B': 1, '3B': 2, '1B': 2, CF: 6, LF: 3, RF: 4 },
    LF: { LF: 0, RF: 1, CF: 5, '1B': 3 },
    CF: { CF: 0, LF: 0, RF: 0, '1B': 4 },
    RF: { RF: 0, LF: 0, CF: 4, '1B': 2 },
    DH: { DH: 0, '1B': 6, LF: 8, RF: 8 },
  };

  function weightsFor(p, pos) {
    if (p.r.vel != null) return WEIGHTS[pos === 'RP' || (pos == null && p.pos === 'RP') ? 'RP' : 'SP'];
    return WEIGHTS[pos || p.pos] || WEIGHTS.std;
  }
  function rawOvr(p, pos) {
    const w = weightsFor(p, pos);
    let s = 0;
    for (const k in w) s += w[k] * p.r[k];
    return s;
  }
  // Overall at a position (hitters), including the out-of-position penalty.
  function ovrAt(p, pos) {
    if (isPitcher(p)) return pos === 'P' ? p.ovr : 20;
    if (pos === 'DH') return Math.round(rawOvr(p, 'DH') - 2);
    const fit = FIT[p.pos] && FIT[p.pos][pos];
    const pen = fit == null ? (pos === 'C' ? 40 : 12) : fit;
    return Math.round(rawOvr(p, pos) - pen);
  }
  function refreshOvr(p) {
    p.ovr = Math.round(U.clamp(rawOvr(p), 20, 99));
    if (p.pot < p.ovr) p.pot = p.ovr;
    return p.ovr;
  }
  const isPitcher = (p) => p.pos === 'SP' || p.pos === 'RP';
  // Offense-only score used for batting order and DH choice.
  const offense = (p) => p.r.con * 0.38 + p.r.pow * 0.34 + p.r.eye * 0.18 + p.r.spd * 0.1;

  // ---------------------------------------------------------------------------
  // Player generation
  // ---------------------------------------------------------------------------
  const STARTER_ARSENALS = [
    ['fb', 'sl', 'ch', 'cv'], ['fb', 'cv', 'ch', 'ct'], ['si', 'sl', 'ch', 'fb'], ['fb', 'sp', 'sl', 'cv'],
    ['fb', 'ct', 'cv', 'ch', 'sl'], ['si', 'ct', 'cv', 'ch'], ['fb', 'sl', 'ch'], ['fb', 'cv', 'ch'],
  ];
  const RELIEF_ARSENALS = [
    ['fb', 'sl', 'ch'], ['si', 'sl', 'ct'], ['fb', 'sp', 'sl'], ['fb', 'cv', 'ch'], ['ct', 'cv', 'ch'],
    ['si', 'ch', 'sl'], ['fb', 'sl', 'cv', 'sp'], ['fb', 'sl'], ['fb', 'sp'], ['si', 'sl'],
  ];
  const BODIES = ['lean', 'athletic', 'stocky', 'tall'];
  const STANCES = ['upright', 'crouch', 'open', 'highHands'];
  const WINDUPS = ['classic', 'overTop', 'sidearm', 'highKick'];
  const CELEBRATES = ['flip', 'point', 'fist', 'admire'];

  function ratingClamp(v) {
    return Math.round(U.clamp(v, 20, 99));
  }

  function makeName(L, rng) {
    const first = U.pick(rng, FIRST);
    const last = U.pick(rng, LAST);
    return { first, last, name: first[0] + '. ' + last };
  }

  function makeLook(rng, p) {
    let body;
    if (isPitcher(p)) body = U.weighted(rng, { lean: 2, athletic: 3, stocky: 1.5, tall: 3 });
    else if (p.r.pow > 70) body = U.weighted(rng, { lean: 0.5, athletic: 2, stocky: 3, tall: 1.5 });
    else if (p.r.spd > 70) body = U.weighted(rng, { lean: 3, athletic: 3, stocky: 0.3, tall: 1 });
    else body = U.pick(rng, BODIES);
    return {
      body,
      stance: U.pick(rng, STANCES),
      windup: U.weighted(rng, { classic: 4, overTop: 2, sidearm: 1, highKick: 2 }),
      celebrate: U.pick(rng, CELEBRATES),
    };
  }

  // Salary in $M from overall and age (young players are cheap until free agency).
  function salaryFor(p) {
    const base = Math.max(0.75, Math.pow(Math.max(0, p.ovr - 50) / 10, 2.4) * 1.2);
    const youth = p.age <= 24 ? 0.35 : p.age <= 26 ? 0.7 : 1;
    return Math.round(Math.max(0.75, base * youth) * 10) / 10;
  }
  function makeContract(rng, p) {
    const years = p.age >= 34 ? 1 + Math.floor(rng() * 2) : p.age <= 25 ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 5);
    return { years, salary: salaryFor(p) };
  }

  function newStat() {
    return {
      bat: { g: 0, gs: 0, pa: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, sb: 0, cs: 0 },
      pit: { g: 0, gs: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, w: 0, l: 0, sv: 0, pitches: 0 },
      vsL: newSplit(),
      vsR: newSplit(),
      home: newSplit(),
      away: newSplit(),
    };
  }
  function newSplit() {
    return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0 };
  }
  function freshStats() {
    return { reg: newStat(), post: newStat(), spring: newStat() };
  }

  // spec: { pos: 'C'..'DH' | 'SP' | 'RP', mean: target overall, age, prospect }
  function makePlayer(L, rng, spec) {
    const pos = spec.pos;
    const pitcher = pos === 'SP' || pos === 'RP';
    const age = spec.age != null ? spec.age : Math.round(U.clamp(U.gauss(rng, 28.3, 3.6), 21, 38));
    const nm = makeName(L, rng);
    const p = {
      id: 'p' + L.nextPid++,
      first: nm.first,
      last: nm.last,
      name: nm.name,
      age,
      bats: 'R',
      throws: 'R',
      pos,
      num: 0,
      teamId: null,
      status: 'active',
      r: {},
      arsenal: null,
      pot: 0,
      ovr: 0,
      look: null,
      contract: null,
      injury: null,
      fatigue: 0,
      arm: { rest: 5, last: 0 },
      draft: null,
      rookie: false,
      stats: freshStats(),
      career: [],
      log: [],
    };
    const mean = spec.mean;
    if (pitcher) {
      const sp = pos === 'SP';
      p.r = {
        vel: ratingClamp(U.gauss(rng, mean + (sp ? 0 : 3), 8)),
        ctl: ratingClamp(U.gauss(rng, mean, 8)),
        sta: ratingClamp(sp ? U.gauss(rng, mean + 12, 7) : U.gauss(rng, mean - 22, 8)),
        stf: ratingClamp(U.gauss(rng, mean + (sp ? 0 : 2), 7)),
      };
      const tpl = U.pick(rng, sp ? STARTER_ARSENALS : RELIEF_ARSENALS);
      p.arsenal = tpl.map((key) => ({ key, q: +U.clamp(U.gauss(rng, 1, 0.04), 0.9, 1.1).toFixed(2) }));
      p.throws = rng() < 0.28 ? 'L' : 'R';
      p.bats = p.throws;
    } else {
      const prof = PROFILE[pos] || PROFILE.LF;
      for (const k of HIT_KEYS) p.r[k] = ratingClamp(U.gauss(rng, mean + prof[k], 7));
      const b = rng();
      p.bats = b < 0.58 ? 'R' : b < 0.9 ? 'L' : 'S';
      const rightOnly = pos === 'C' || pos === 'SS' || pos === '2B' || pos === '3B';
      p.throws = !rightOnly && p.bats === 'L' && rng() < 0.55 ? 'L' : 'R';
    }
    refreshOvr(p);
    // Potential: young players have room to grow.
    const room = age <= 21 ? U.gauss(rng, 15, 7) : age <= 24 ? U.gauss(rng, 9, 5) : age <= 27 ? U.gauss(rng, 3, 3) : 0;
    p.pot = Math.round(U.clamp(p.ovr + Math.max(0, room), p.ovr, 99));
    p.look = makeLook(rng, p);
    p.contract = makeContract(rng, p);
    L.players[p.id] = p;
    return p;
  }

  // A rookie-level prospect (draft or minor leagues).
  function makeProspect(L, rng, opts) {
    const pos = opts && opts.pos ? opts.pos : U.weighted(rng, { SP: 3, RP: 1.5, C: 1, SS: 1.3, CF: 1.1, '2B': 0.9, '3B': 0.9, RF: 0.9, LF: 0.7, '1B': 0.6 });
    const age = opts && opts.age != null ? opts.age : 18 + Math.floor(rng() * 5);
    const p = makePlayer(L, rng, { pos, mean: opts && opts.mean != null ? opts.mean : U.gauss(rng, 40, 5), age });
    const pot = U.clamp(U.gauss(rng, opts && opts.potMean != null ? opts.potMean : 62, 10), p.ovr + 8, 97);
    p.pot = Math.round(pot);
    p.contract = { years: 3, salary: 0.75 };
    p.status = 'prospect';
    return p;
  }

  function pickNumber(rng, used) {
    for (let i = 0; i < 200; i++) {
      const n = 1 + Math.floor(rng() * 99);
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
    return 0;
  }

  // Build a full team: 13 position players, 13 pitchers, and reserves.
  function buildTeam(L, rng, team) {
    const q = U.gauss(rng, 0, 2); // team quality
    const tier = () => {
      const r = rng();
      return r < 0.1 ? 70 : r < 0.32 ? 62 : 55;
    };
    const used = new Set();
    const add = (p, status) => {
      p.teamId = team.id;
      p.status = status;
      p.num = pickNumber(rng, used);
      (status === 'active' ? team.roster : team.reserves).push(p.id);
      return p;
    };
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']) add(makePlayer(L, rng, { pos, mean: tier() + q }), 'active');
    for (const pos of ['C', 'SS', '3B', 'CF']) add(makePlayer(L, rng, { pos, mean: 50 + q }), 'active');
    const spMeans = [70, 65, 62, 59, 57];
    for (const m of spMeans) add(makePlayer(L, rng, { pos: 'SP', mean: m + q + U.gauss(rng, 0, 3) }), 'active');
    const rpMeans = [66, 62, 60, 58, 57, 56, 55, 54];
    for (const m of rpMeans) add(makePlayer(L, rng, { pos: 'RP', mean: m + q + U.gauss(rng, 0, 2) }), 'active');
    // Reserves: depth for injuries, plus prospects.
    for (const pos of ['C', 'SS', 'LF', '1B']) add(makePlayer(L, rng, { pos, mean: 48 + q, age: 22 + Math.floor(rng() * 9) }), 'reserve');
    for (const pos of ['SP', 'SP', 'RP', 'RP']) add(makePlayer(L, rng, { pos, mean: 48 + q, age: 22 + Math.floor(rng() * 9) }), 'reserve');
    for (let i = 0; i < 3; i++) {
      const p = makeProspect(L, rng, { age: 19 + Math.floor(rng() * 4) });
      add(p, 'reserve');
      p.status = 'prospect';
    }
  }

  // ---------------------------------------------------------------------------
  // Depth chart: lineup, rotation, bullpen.
  // ---------------------------------------------------------------------------
  const available = (L, pid) => {
    const p = L.players[pid];
    return p && !p.injury;
  };

  // Pick the best fielder for each position, then the DH, then a batting order.
  // exclude: set of pids to leave out (resting players).
  function bestLineup(L, team, exclude) {
    const hitters = team.roster
      .map((id) => L.players[id])
      .filter((p) => p && !isPitcher(p) && !p.injury && !(exclude && exclude.has(p.id)));
    const taken = new Set();
    const lineup = [];
    for (const pos of ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B']) {
      let best = null;
      let bestScore = -1e9;
      for (const p of hitters) {
        if (taken.has(p.id)) continue;
        const s = ovrAt(p, pos);
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
      if (best) {
        taken.add(best.id);
        lineup.push({ pid: best.id, pos });
      }
    }
    let dh = null;
    for (const p of hitters) if (!taken.has(p.id) && (!dh || offense(p) > offense(dh))) dh = p;
    if (dh) lineup.push({ pid: dh.id, pos: 'DH' });
    return battingOrder(L, lineup);
  }

  // Classic order: on-base guy leads off, best hitter 3rd, power 4th-5th.
  function battingOrder(L, lineup) {
    const P = (e) => L.players[e.pid];
    const obp = (p) => p.r.con * 0.45 + p.r.eye * 0.4 + p.r.spd * 0.15;
    const pow = (p) => p.r.pow * 0.7 + p.r.con * 0.3;
    const left = lineup.slice();
    const takeBest = (score) => {
      let bi = 0;
      for (let i = 1; i < left.length; i++) if (score(P(left[i])) > score(P(left[bi]))) bi = i;
      return left.splice(bi, 1)[0];
    };
    const order = new Array(lineup.length);
    if (!left.length) return [];
    order[2] = takeBest(offense);
    if (left.length) order[0] = takeBest(obp);
    if (left.length) order[3] = takeBest(pow);
    if (left.length) order[1] = takeBest((p) => p.r.con * 0.6 + p.r.eye * 0.4);
    if (left.length) order[4] = takeBest(pow);
    for (let i = 5; i < order.length; i++) if (left.length) order[i] = takeBest(offense);
    return order.filter(Boolean);
  }

  function autoManage(L, team, force) {
    const players = team.roster.map((id) => L.players[id]).filter(Boolean);
    const healthy = players.filter((p) => !p.injury);
    if (force || !team.manual) {
      team.lineup = bestLineup(L, team);
      const sps = healthy.filter((p) => p.pos === 'SP').sort((a, b) => b.ovr - a.ovr);
      const rps = healthy.filter((p) => p.pos === 'RP').sort((a, b) => b.ovr - a.ovr);
      // Rotation: best five starters; fill from relievers if short.
      const rot = sps.slice(0, 5);
      const extra = sps.slice(5);
      while (rot.length < 5 && rps.length) rot.push(rps.pop());
      const keepIdx = team.rotation && team.rotation.length ? team.rotIdx % 5 : 0;
      team.rotation = rot.map((p) => p.id);
      team.rotIdx = keepIdx;
      const pen = extra.concat(rps);
      pen.sort((a, b) => b.ovr - a.ovr);
      team.closer = pen.length ? pen[0].id : null;
      team.bullpen = pen.map((p) => p.id);
    } else {
      // Manual teams keep the user's choices. Injured players stay in the
      // lineup and rotation (the engine subs for them day to day); only players
      // who left the roster are replaced.
      const onRoster = (id) => team.roster.includes(id);
      if (team.lineup.length !== 9 || team.lineup.some((e) => !onRoster(e.pid))) {
        const keep = team.lineup.filter((e) => onRoster(e.pid));
        const fixed = bestLineup(L, team, new Set(keep.map((e) => e.pid)));
        const usedPos = new Set(keep.map((e) => e.pos));
        for (const e of fixed) if (keep.length < 9 && !usedPos.has(e.pos)) {
          keep.push(e);
          usedPos.add(e.pos);
        }
        team.lineup = keep.length === 9 ? keep : bestLineup(L, team);
      }
      team.rotation = team.rotation.filter(onRoster);
      const sps = healthy.filter((p) => p.pos === 'SP' && !team.rotation.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
      while (team.rotation.length < 5 && sps.length) team.rotation.push(sps.shift().id);
      team.bullpen = team.roster.filter((id) => {
        const p = L.players[id];
        return p && isPitcher(p) && !team.rotation.includes(id);
      });
      if (!team.bullpen.includes(team.closer)) team.closer = team.bullpen[0] || null;
    }
  }

  // ---------------------------------------------------------------------------
  // Ratings → simulation numbers (see ARCHITECTURE.md)
  // ---------------------------------------------------------------------------
  // Rating → multiplier with a soft cap: past ±12 from average, each point
  // counts half, so elite ratings help without breaking the game.
  function soft(x) {
    const a = Math.abs(x);
    return Math.sign(x) * (a <= 12 ? a : 12 + (a - 12) * 0.5);
  }
  const mult = (r, slope) => 1 + soft(r - 60) * slope;

  function toGameBatter(p, pos, slot) {
    return {
      pid: p.id,
      name: p.name,
      pos,
      num: p.num,
      hand: p.bats === 'S' ? 'R' : p.bats,
      bats: p.bats,
      contact: mult(p.r.con, 0.0042),
      power: mult(p.r.pow, 0.0045),
      speed: mult(p.r.spd, 0.004),
      eye: mult(p.r.eye, 0.006),
      look: p.look,
      slot,
    };
  }

  // role: 'SP' | 'RP' | 'CL'. Tired arms get less stamina.
  function toGamePitcher(p, role) {
    const starter = role === 'SP';
    let stamina = starter ? 55 + p.r.sta * 0.55 : 12 + p.r.sta * 0.3;
    const rest = p.arm ? p.arm.rest : 9;
    if (starter && rest < 4) stamina *= 0.6;
    if (!starter && rest === 0) stamina *= 0.6;
    else if (!starter && rest === 1 && p.arm.last > 15) stamina *= 0.8;
    const stuff = mult(p.r.stf, 0.0022);
    return {
      pid: p.id,
      name: p.name,
      pos: 'P',
      role,
      num: p.num,
      hand: p.throws,
      velo: soft(p.r.vel - 60) * 0.09,
      control: U.clamp(2 - mult(p.r.ctl, 0.0045), 0.75, 1.25),
      stamina: Math.round(stamina),
      arsenal: (p.arsenal || [{ key: 'fb', q: 1 }]).map((a) => ({ key: a.key, q: +(a.q * stuff).toFixed(3) })),
      look: p.look,
    };
  }

  function fieldDef(p) {
    if (!p || isPitcher(p)) return { q: 1, arm: 1 };
    return { q: mult(p.r.fld, 0.0025), arm: mult(p.r.arm, 0.0025) };
  }

  // ---------------------------------------------------------------------------
  // Calendar helpers (ISO dates, UTC)
  // ---------------------------------------------------------------------------
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------------------
  // Schedules
  // ---------------------------------------------------------------------------
  function newGame(L, type, date, away, home, dayIdx) {
    const id = 'g' + L.nextGid++;
    const g = { id, type, day: dayIdx, date, away, home, status: 'scheduled', score: null, innings: 0, wp: null, lp: null, sv: null, box: null, series: null, meta: null };
    L.games[id] = g;
    return g;
  }

  // Spring training: ~15 days of random matchups.
  function springDays(L, rng) {
    const days = [];
    let date = L.year + '-03-04';
    const ids = L.teams.map((t) => t.id);
    for (let d = 0; d < 15; d++) {
      const order = shuffle(rng, ids.slice());
      const day = { date, phase: 'spring', games: [], event: null };
      for (let i = 0; i < order.length; i += 2) {
        const gm = newGame(L, 'spring', date, order[i], order[i + 1], days.length);
        day.games.push(gm.id);
      }
      days.push(day);
      date = addDays(date, d === 6 ? 2 : 1); // one rest day mid-spring
    }
    return days;
  }

  // Regular season: 54 rounds of 3-game series (162 games per team). Each round
  // pairs every team; opponents are weighted toward the division and league.
  function regularDays(L, rng) {
    const teams = L.teams;
    const byId = {};
    for (const t of teams) byId[t.id] = t;
    const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    const target = (a, b) => (a.league === b.league ? (a.div === b.div ? 4.4 : 2.1) : 1.0);
    const pairs = {};
    const homeSeries = {};
    const lastOpp = {};
    for (const t of teams) homeSeries[t.id] = 0;
    const rounds = [];
    for (let r = 0; r < 54; r++) {
      const order = shuffle(rng, teams.map((t) => t.id));
      const open = new Set(order);
      const round = [];
      for (const a of order) {
        if (!open.has(a)) continue;
        open.delete(a);
        let best = null;
        let bestCost = Infinity;
        for (const b of open) {
          const ta = byId[a];
          const tb = byId[b];
          let cost = (pairs[key(a, b)] || 0) / target(ta, tb) + rng() * 0.35;
          if (lastOpp[a] === b) cost += 3;
          if (cost < bestCost) {
            bestCost = cost;
            best = b;
          }
        }
        open.delete(best);
        pairs[key(a, best)] = (pairs[key(a, best)] || 0) + 1;
        lastOpp[a] = best;
        lastOpp[best] = a;
        let home = homeSeries[a] < homeSeries[best] ? a : homeSeries[best] < homeSeries[a] ? best : rng() < 0.5 ? a : best;
        const away = home === a ? best : a;
        homeSeries[home]++;
        round.push({ away, home });
      }
      rounds.push(round);
    }
    // Lay the rounds out on the calendar.
    const days = [];
    let date = L.year + '-03-27';
    for (let r = 0; r < rounds.length; r++) {
      for (let g = 0; g < 3; g++) {
        const day = { date, phase: 'regular', games: [], event: null };
        for (const m of rounds[r]) day.games.push(newGame(L, 'regular', date, m.away, m.home, days.length).id);
        days.push(day);
        date = addDays(date, 1);
      }
      if (r === 29) {
        // All-Star break: off day, the All-Star Game, off day.
        days.push({ date, phase: 'regular', games: [], event: 'off' });
        date = addDays(date, 1);
        days.push({ date, phase: 'regular', games: [], event: 'allstar' });
        date = addDays(date, 1);
        days.push({ date, phase: 'regular', games: [], event: 'off' });
        date = addDays(date, 1);
      } else if (r % 6 === 5 && r < 53) {
        days.push({ date, phase: 'regular', games: [], event: 'off' });
        date = addDays(date, 1);
      }
    }
    return days;
  }

  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  // ---------------------------------------------------------------------------
  // League creation
  // ---------------------------------------------------------------------------
  function create(opts) {
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
    const rng = U.seeded(seed);
    const L = {
      version: 1,
      seed,
      year: opts.year || 2027,
      phase: 'spring',
      offStep: null,
      day: 0,
      days: [],
      games: {},
      userTeamId: opts.userTeamId,
      difficulty: opts.difficulty || 'medium',
      teams: TEAMS.map((t) =>
        Object.assign({}, t, {
          budget: BUDGET[t.market],
          roster: [],
          reserves: [],
          il: [],
          lineup: [],
          rotation: [],
          rotIdx: 0,
          bullpen: [],
          closer: null,
          rec: newRec(),
          springRec: { w: 0, l: 0 },
          manual: false,
        }),
      ),
      players: {},
      nextPid: 1,
      nextGid: 1,
      news: [],
      history: [],
      awards: null,
      allStar: null,
      post: null,
      draft: null,
      freeAgents: [],
      settings: { autoManage: true },
    };
    const user = L.teams.find((t) => t.id === opts.userTeamId);
    if (user && opts.teamName) {
      // "Lakeshore Lynx" → city "Lakeshore", name "Lynx".
      const parts = String(opts.teamName).trim().split(/\s+/);
      user.name = parts.length > 1 ? parts.pop() : parts[0];
      user.city = parts.length ? parts.join(' ') : user.city;
    }
    if (user && opts.color) user.color = opts.color;
    for (const t of L.teams) buildTeam(L, rng, t);
    for (const t of L.teams) autoManage(L, t, true);
    // A handful of unsigned veterans start in free agency.
    for (let i = 0; i < 16; i++) {
      const pos = U.pick(rng, ['SP', 'RP', 'RP', 'C', 'SS', '2B', 'CF', 'RF', '1B', '3B', 'LF']);
      const p = makePlayer(L, rng, { pos, mean: U.gauss(rng, 54, 5), age: 29 + Math.floor(rng() * 8) });
      p.status = 'fa';
      p.contract = { years: 0, salary: salaryFor(p) };
      L.freeAgents.push(p.id);
    }
    return L;
  }

  function newRec() {
    return { w: 0, l: 0, rs: 0, ra: 0, hw: 0, hl: 0, aw: 0, al: 0, streak: 0, last: [] };
  }

  function payroll(L, team) {
    let s = 0;
    for (const id of team.roster.concat(team.il)) {
      const p = L.players[id];
      if (p && p.contract) s += p.contract.salary;
    }
    return Math.round(s * 10) / 10;
  }

  BB.league = {
    TEAMS, LEAGUES, DIVS, HIT_KEYS, PIT_KEYS, FIELD_POS, BODIES, STANCES, WINDUPS, CELEBRATES,
    create, makePlayer, makeProspect, buildTeam, refreshOvr, ovrAt, offense, isPitcher, salaryFor, makeContract,
    autoManage, bestLineup, battingOrder, toGameBatter, toGamePitcher, fieldDef, newStat, newSplit, freshStats,
    soft, mult, newRec, springDays, regularDays, newGame, addDays, shuffle, payroll, pickNumber, makeLook,
  };
})(typeof window !== 'undefined' ? window : globalThis);
