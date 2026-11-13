// Saved settings (your team, last options, mute) and records, in localStorage.
// Every read and write is wrapped so the game still works when storage is blocked.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const KEY = 'diamond-dash-v1';

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* storage unavailable */
    }
    return {};
  }
  function save(data) {
    try {
      root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable */
    }
  }

  let data = load();

  function settings() {
    if (!data.settings) {
      data.settings = {
        teamName: 'Home Run Heroes',
        color: '#d64541',
        rosterSeed: Math.floor(Math.random() * 1e9),
        opponent: 'random',
        innings: 3,
        difficulty: 'medium',
        playerHome: false,
        muted: false,
        replays: true, // replays of big moments (js/fx.js)
      };
    }
    return data.settings;
  }

  function setSettings(patch) {
    Object.assign(settings(), patch);
    save(data);
  }

  function records() {
    if (!data.records) {
      data.records = {
        byDiff: { easy: { w: 0, l: 0, t: 0 }, medium: { w: 0, l: 0, t: 0 }, hard: { w: 0, l: 0, t: 0 } },
        best: {},
        recent: [],
      };
    }
    return data.records;
  }

  // summary: {diff, innings, you, opp, oppName, hr, k, hits, result: 'W'|'L'|'T'}
  // Returns the list of personal bests this game set.
  function recordGame(summary) {
    const r = records();
    const d = r.byDiff[summary.diff];
    if (summary.result === 'W') d.w++;
    else if (summary.result === 'L') d.l++;
    else d.t++;
    r.recent.unshift({
      date: new Date().toISOString().slice(0, 10),
      diff: summary.diff,
      innings: summary.innings,
      you: summary.you,
      opp: summary.opp,
      oppName: summary.oppName,
      result: summary.result,
    });
    r.recent = r.recent.slice(0, 10);
    const newBests = [];
    const check = (key, value, label) => {
      if (value <= 0) return;
      const cur = r.best[key];
      if (!cur || value > cur.value) {
        r.best[key] = { value, diff: summary.diff, date: new Date().toISOString().slice(0, 10) };
        newBests.push(label);
      }
    };
    check('runs', summary.you, 'Most runs');
    check('hr', summary.hr, 'Most home runs');
    check('hits', summary.hits, 'Most hits');
    check('k', summary.k, 'Most strikeouts (pitching)');
    if (summary.result === 'W') check('margin', summary.you - summary.opp, 'Biggest win');
    save(data);
    return newBests;
  }

  BB.store = { settings, setSettings, records, recordGame };
})(typeof window !== 'undefined' ? window : globalThis);
