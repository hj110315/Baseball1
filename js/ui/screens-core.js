// Core franchise screens (UI agent): new franchise, home, schedule and
// scoreboard, standings, leaders, your team (roster, lineup, rotation and
// bullpen, roster moves, stats, payroll), any team's page, the League hub and
// news. Shared helpers for profile.js and boxscore.js live in BB.ui.core.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined' || !BB.ui) return;
  const ui = BB.ui;
  const esc = ui.esc;
  const fmt = ui.fmt;
  const S = () => BB.season;
  const LG = () => BB.league;

  // ---------------------------------------------------------------------------
  // Shared helpers (also used by profile.js and boxscore.js)
  // ---------------------------------------------------------------------------
  const PHASE_NAMES = { spring: 'Spring training', regular: 'Regular season', postseason: 'Postseason', offseason: 'Offseason' };
  const BUCKETS = [['reg', 'Regular'], ['post', 'Postseason'], ['spring', 'Spring']];
  const TYPE_NAMES = { spring: 'Spring training', regular: 'Regular season', allstar: 'All-Star Game', post: 'Postseason', exhibition: 'Exhibition' };
  const HIT_R = [['con', 'CON', 'Contact'], ['pow', 'POW', 'Power'], ['eye', 'EYE', 'Eye'], ['spd', 'SPD', 'Speed'], ['fld', 'FLD', 'Fielding'], ['arm', 'ARM', 'Arm']];
  const PIT_R = [['vel', 'VEL', 'Velocity'], ['ctl', 'CTL', 'Control'], ['sta', 'STA', 'Stamina'], ['stf', 'STF', 'Stuff']];
  const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const MAX_ACTIVE = 26;
  const MAX_RESERVES = 14;

  const isPitcher = (p) => !!p && (p.pos === 'SP' || p.pos === 'RP');
  const recOf = (L, t) => (L.phase === 'spring' ? t.springRec : t.rec);
  const recStr = (L, t) => {
    const r = recOf(L, t);
    return r ? r.w + '-' + r.l : '';
  };
  const ordinal = (n) => (BB.U && BB.U.ordinal ? BB.U.ordinal(n) : n + '');
  const pl = (L, pid) => (pid && L.players[pid]) || null;
  const has = (id) => !!ui.screens[id];

  // Team chip that also works for teams outside the league (All-Star squads).
  function chip(L, id, opts) {
    const t = S().team(L, id);
    if (t) return ui.teamChip(t, opts);
    return `<span class="fr-team"><i style="background:#8d99ae"></i>${esc(id || '?')}</span>`;
  }

  // Default stat bucket for the current phase.
  function bucketFor(L) {
    if (L.phase === 'spring') return 'spring';
    if (L.phase === 'postseason') return 'post';
    return 'reg';
  }

  function seg(name, options, cur, cls) {
    return `<div class="fr-seg${cls ? ' ' + cls : ''}" data-seg="${esc(name)}" role="tablist">${options
      .map(([v, label]) => `<button data-v="${esc(v)}" class="${String(v) === String(cur) ? 'sel' : ''}" role="tab" aria-selected="${String(v) === String(cur)}">${esc(label)}</button>`)
      .join('')}</div>`;
  }
  // Calls fn(name, value) when a segmented control button is clicked inside el.
  function onSeg(el, fn) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] button[data-v]');
      if (!b || !el.contains(b)) return;
      e.preventDefault();
      fn(b.parentNode.dataset.seg, b.dataset.v);
    });
  }

  function injBadge(p) {
    if (!p || !p.injury) return '';
    return ` <span class="fr-inj" title="${esc(p.injury.desc || 'Injured')}">INJ ${esc(p.injury.days)}d</span>`;
  }

  function resultFor(gm, teamId) {
    if (!gm || gm.status !== 'final' || !gm.score) return null;
    const i = gm.away === teamId ? 0 : 1;
    const my = gm.score[i];
    const op = gm.score[1 - i];
    const r = my > op ? 'W' : my < op ? 'L' : 'T';
    return { r, text: `${r} ${my}-${op}`, extra: gm.innings > 9 ? ` (${gm.innings})` : '' };
  }

  function gameLabel(gm) {
    const m = gm.meta || {};
    if (m.seriesText) return m.seriesText;
    if (m.label) return m.label;
    if (gm.series && gm.series.gameNum) return `Game ${gm.series.gameNum}`;
    return gm.type === 'regular' || gm.type === 'spring' ? '' : TYPE_NAMES[gm.type] || '';
  }

  // Value formatting for leader categories.
  function fmtStat(stat, v) {
    if (v == null || isNaN(v)) return '-';
    if (stat === 'avg' || stat === 'obp' || stat === 'slg' || stat === 'ops') return fmt.avg(v);
    if (stat === 'era' || stat === 'whip') return fmt.era(v);
    if (stat === 'k9') return v.toFixed(1);
    if (stat === 'ip') return fmt.ip(v);
    return String(Math.round(v));
  }

  // Potential (20-99) as a 20-80 scouting grade.
  function scoutGrade(pot) {
    const g = Math.max(20, Math.min(80, Math.round((20 + ((pot - 20) * 60) / 79) / 5) * 5));
    const word = g >= 75 ? 'Elite' : g >= 70 ? 'All-Star' : g >= 60 ? 'Above-average regular' : g >= 55 ? 'Solid regular' : g >= 50 ? 'Average regular' : g >= 45 ? 'Platoon / utility' : g >= 40 ? 'Fringe big-leaguer' : 'Organization depth';
    return { grade: g, word };
  }

  function contractText(p) {
    if (!p.contract) return '-';
    const y = p.contract.years;
    return `${fmt.money(p.contract.salary)}${y ? ` × ${y} yr${y === 1 ? '' : 's'}` : ' (expiring)'}`;
  }

  // Where a player stands on his team's depth chart.
  function roleOf(L, p) {
    const t = p.teamId && S().team(L, p.teamId);
    if (!t) return p.status === 'fa' ? 'Free agent' : p.status === 'prospect' ? 'Prospect' : '';
    if ((t.il || []).includes(p.id)) return 'Injured list';
    if (t.reserves.includes(p.id)) return p.status === 'prospect' ? 'Prospect (reserves)' : 'Reserves';
    if (isPitcher(p)) {
      const ri = t.rotation.indexOf(p.id);
      if (ri >= 0) return `Rotation #${ri + 1}`;
      if (t.closer === p.id) return 'Closer';
      return 'Bullpen';
    }
    const li = t.lineup.findIndex((e) => e.pid === p.id);
    return li >= 0 ? `Batting ${ordinal(li + 1)} · ${t.lineup[li].pos}` : 'Bench';
  }

  // ---------------------------------------------------------------------------
  // Roster moves for the user's team
  // ---------------------------------------------------------------------------
  function healthyCounts(L, t, without) {
    let hit = 0;
    let pit = 0;
    for (const id of t.roster) {
      if (id === without) continue;
      const p = pl(L, id);
      if (!p || p.injury) continue;
      if (isPitcher(p)) pit++;
      else hit++;
    }
    return { hit, pit };
  }
  // Returns a reason string when the move isn't allowed, or '' when it is.
  function sendDownBlock(L, pid) {
    const t = S().userTeam(L);
    const p = pl(L, pid);
    if (!p || !t.roster.includes(pid)) return 'Not on your active roster.';
    if (t.reserves.length >= MAX_RESERVES) return `Your reserves are full (${MAX_RESERVES}).`;
    if (!p.injury) {
      const c = healthyCounts(L, t, pid);
      if (isPitcher(p) && c.pit < 11) return 'Keep at least 11 healthy pitchers on the active roster.';
      if (!isPitcher(p) && c.hit < 10) return 'Keep at least 10 healthy position players on the active roster.';
    }
    return '';
  }
  function callUpBlock(L, pid) {
    const t = S().userTeam(L);
    const p = pl(L, pid);
    if (!p || !t.reserves.includes(pid)) return 'Not in your reserves.';
    if (p.injury) return `${p.name} is injured.`;
    if (t.roster.length >= MAX_ACTIVE) return `The active roster is full (${MAX_ACTIVE}). Send someone down first.`;
    return '';
  }
  // Rebuild (auto) or repair (manual) the depth chart after a roster change.
  function afterRosterMove(L, t, pid) {
    t.lineup = t.lineup.filter((e) => t.roster.includes(e.pid));
    t.rotation = t.rotation.filter((id) => t.roster.includes(id));
    t.bullpen = t.bullpen.filter((id) => t.roster.includes(id));
    if (t.closer === pid && !t.roster.includes(pid)) t.closer = null;
    LG().autoManage(L, t, !t.manual);
    if (t.rotIdx >= t.rotation.length) t.rotIdx = 0;
  }
  function sendDown(L, pid) {
    const why = sendDownBlock(L, pid);
    if (why) return { ok: false, msg: why };
    const t = S().userTeam(L);
    const p = pl(L, pid);
    t.roster = t.roster.filter((id) => id !== pid);
    t.reserves.push(pid);
    p.status = 'reserve';
    afterRosterMove(L, t, pid);
    ui.save();
    return { ok: true, msg: `${p.name} was sent down to the reserves.` };
  }
  function callUp(L, pid) {
    const why = callUpBlock(L, pid);
    if (why) return { ok: false, msg: why };
    const t = S().userTeam(L);
    const p = pl(L, pid);
    t.reserves = t.reserves.filter((id) => id !== pid);
    t.roster.push(pid);
    p.status = 'active';
    afterRosterMove(L, t, pid);
    ui.save();
    return { ok: true, msg: `${p.name} was called up to the active roster.` };
  }

  // Release: the player leaves your organization and becomes a free agent.
  // You keep paying his salary until his contract ends (owner's choice).
  function releaseBlock(L, pid) {
    const t = S().userTeam(L);
    const p = pl(L, pid);
    if (!p || p.teamId !== t.id) return 'Not in your organization.';
    if (L.phase === 'offseason' && L.offStep === 'draft') return 'Wait until the draft is over.';
    if (t.roster.includes(pid) && !p.injury) {
      const c = healthyCounts(L, t, pid);
      if (isPitcher(p) && c.pit < 11) return 'Keep at least 11 healthy pitchers on the active roster.';
      if (!isPitcher(p) && c.hit < 10) return 'Keep at least 10 healthy position players on the active roster.';
    }
    return '';
  }
  function release(L, pid) {
    const why = releaseBlock(L, pid);
    if (why) return { ok: false, msg: why };
    const t = S().userTeam(L);
    const p = pl(L, pid);
    BB.depth.release(L, t, p);
    afterRosterMove(L, t, pid);
    S().addNews(L, `${t.abbr} release ${p.name} (${p.pos}).`, 'roster', t.id);
    ui.save();
    return { ok: true, msg: `${p.name} was released and is now a free agent.` };
  }

  // Modals live outside #franchise, so their team and data-go links are wired here.
  function wireModal(m) {
    m.root.addEventListener('click', (e) => {
      if (e.target.closest('[data-nolink]')) return;
      const go = e.target.closest('[data-go]');
      const tl = !go && !e.target.closest('[data-pid],[data-gid]') && e.target.closest('[data-team]');
      if (!go && !tl) return;
      e.preventDefault();
      document.querySelectorAll('.fr-modal-back').forEach((b) => b.remove());
      if (go) {
        let params = null;
        try {
          params = go.dataset.params ? JSON.parse(go.dataset.params) : null;
        } catch (err) {
          params = null;
        }
        ui.go(go.dataset.go, params);
      } else if (ui.screens.teamPage) ui.go('teamPage', { teamId: tl.dataset.team });
    });
    return m;
  }

  // ---------------------------------------------------------------------------
  // Roster tables
  // ---------------------------------------------------------------------------
  function restText(p) {
    if (!p.arm) return '';
    const r = p.arm.rest;
    if (p.pos === 'SP') return r >= 4 ? 'Ready' : `${r}d rest`;
    if (r === 0) return 'Pitched today';
    // Bullpen workload rules (engine.js): out today after a long outing or two days in a row.
    if (BB.engine.relieverReady && !BB.engine.relieverReady(p)) return 'Resting today';
    return r === 1 ? 'Used yesterday' : 'Rested';
  }

  function hitterTable(L, list, opts) {
    const o = opts || {};
    const b = o.bucket || bucketFor(L);
    const cols = [
      { key: 'num', label: '#', val: (p) => p.num, html: (p) => `<span class="fr-num">${p.num || ''}</span>` },
      { key: 'name', label: 'Player', align: 'l', val: (p) => p.last, html: (p) => ui.playerLink(p) + injBadge(p) + (p.rookie ? ' <span class="fr-tag">R</span>' : '') },
      { key: 'pos', label: 'Pos', align: 'l', val: (p) => POSITIONS.indexOf(p.pos), html: (p) => esc(p.pos) },
      { key: 'role', label: 'Role', align: 'l', val: (p) => roleOf(L, p), html: (p) => `<span class="fr-muted">${esc(roleOf(L, p))}</span>` },
      { key: 'bt', label: 'B/T', align: 'l', val: (p) => p.bats, html: (p) => `${p.bats}/${p.throws}` },
      { key: 'age', label: 'Age', val: (p) => p.age, html: (p) => String(p.age) },
      { key: 'ovr', label: 'OVR', val: (p) => p.ovr, html: (p) => ui.rating(p.ovr) },
      { key: 'pot', label: 'POT', val: (p) => p.pot, html: (p) => ui.rating(p.pot) },
    ];
    for (const [k, label, title] of HIT_R) cols.push({ key: k, label, title, val: (p) => p.r[k], html: (p) => ui.rating(p.r[k]) });
    cols.push(
      { key: 'avg', label: 'AVG', val: (p) => S().calc(p.stats[b]).avg, html: (p) => (p.stats[b].bat.ab ? fmt.avg(S().calc(p.stats[b]).avg) : '-') },
      { key: 'hr', label: 'HR', val: (p) => p.stats[b].bat.hr, html: (p) => String(p.stats[b].bat.hr) },
      { key: 'rbi', label: 'RBI', val: (p) => p.stats[b].bat.rbi, html: (p) => String(p.stats[b].bat.rbi) },
    );
    if (o.actions) cols.push({ key: '', label: '', html: o.actions });
    return ui.table({ cols, rows: list, sortKey: o.sortKey, sortDir: o.sortDir, empty: o.empty || 'No players.' });
  }

  function pitcherTable(L, list, opts) {
    const o = opts || {};
    const b = o.bucket || bucketFor(L);
    const cols = [
      { key: 'num', label: '#', val: (p) => p.num, html: (p) => `<span class="fr-num">${p.num || ''}</span>` },
      { key: 'name', label: 'Pitcher', align: 'l', val: (p) => p.last, html: (p) => ui.playerLink(p) + injBadge(p) + (p.rookie ? ' <span class="fr-tag">R</span>' : '') },
      { key: 'pos', label: 'Pos', align: 'l', val: (p) => p.pos, html: (p) => esc(p.pos) },
      { key: 'role', label: 'Role', align: 'l', val: (p) => roleOf(L, p), html: (p) => `<span class="fr-muted">${esc(roleOf(L, p))}</span>` },
      { key: 't', label: 'T', align: 'l', val: (p) => p.throws, html: (p) => p.throws },
      { key: 'age', label: 'Age', val: (p) => p.age, html: (p) => String(p.age) },
      { key: 'ovr', label: 'OVR', val: (p) => p.ovr, html: (p) => ui.rating(p.ovr) },
      { key: 'pot', label: 'POT', val: (p) => p.pot, html: (p) => ui.rating(p.pot) },
    ];
    for (const [k, label, title] of PIT_R) cols.push({ key: k, label, title, val: (p) => p.r[k], html: (p) => ui.rating(p.r[k]) });
    cols.push(
      { key: 'era', label: 'ERA', val: (p) => -S().calc(p.stats[b]).era, html: (p) => (p.stats[b].pit.outs ? fmt.era(S().calc(p.stats[b]).era) : '-') },
      { key: 'wl', label: 'W-L', val: (p) => p.stats[b].pit.w, html: (p) => `${p.stats[b].pit.w}-${p.stats[b].pit.l}` },
      { key: 'sv', label: 'SV', val: (p) => p.stats[b].pit.sv, html: (p) => String(p.stats[b].pit.sv) },
      { key: 'ip', label: 'IP', val: (p) => p.stats[b].pit.outs, html: (p) => fmt.ip(p.stats[b].pit.outs) },
      { key: 'rest', label: 'Arm', align: 'l', val: (p) => (p.arm ? p.arm.rest : 0), html: (p) => `<span class="fr-muted">${esc(restText(p))}</span>` },
    );
    if (o.actions) cols.push({ key: '', label: '', html: o.actions });
    return ui.table({ cols, rows: list, sortKey: o.sortKey, sortDir: o.sortDir, empty: o.empty || 'No pitchers.' });
  }

  // Players of a team in depth-chart order: lineup, bench / rotation, closer, bullpen.
  function orderedHitters(L, t, ids) {
    const lin = t.lineup.map((e) => e.pid);
    const pos = (p) => {
      const i = lin.indexOf(p.id);
      return i >= 0 ? i : 20 + POSITIONS.indexOf(p.pos);
    };
    return ids.map((id) => pl(L, id)).filter((p) => p && !isPitcher(p)).sort((a, b) => pos(a) - pos(b) || b.ovr - a.ovr);
  }
  function orderedPitchers(L, t, ids) {
    const rank = (p) => {
      const i = t.rotation.indexOf(p.id);
      if (i >= 0) return i;
      if (p.id === t.closer) return 10;
      return 20 + (100 - p.ovr) / 100;
    };
    return ids.map((id) => pl(L, id)).filter((p) => p && isPitcher(p)).sort((a, b) => rank(a) - rank(b));
  }

  // Sum of the stats of a team's players for one bucket.
  function teamTotals(L, t, bucket) {
    const tot = LG().newStat();
    const ids = t.roster.concat(t.reserves, t.il || []);
    for (const id of ids) {
      const p = pl(L, id);
      if (!p) continue;
      const s = p.stats[bucket];
      for (const k in tot.bat) tot.bat[k] += s.bat[k] || 0;
      for (const k in tot.pit) tot.pit[k] += s.pit[k] || 0;
    }
    return tot;
  }

  // ---------------------------------------------------------------------------
  // Game tiles and schedule lists
  // ---------------------------------------------------------------------------
  function gameTile(L, gm) {
    const final = gm.status === 'final' && gm.score;
    const win = final ? (gm.score[0] > gm.score[1] ? 0 : gm.score[1] > gm.score[0] ? 1 : -1) : -1;
    const side = (i) => {
      const id = i ? gm.home : gm.away;
      const t = S().team(L, id);
      const user = id === L.userTeamId;
      return `<div class="fr-gt-row${win === i ? ' win' : ''}${user ? ' user' : ''}">${t ? `<i style="background:${esc(t.color)}"></i><b>${esc(t.abbr)}</b>` : `<i></i><b>${esc(id)}</b>`}<span class="fr-gt-rec">${t && gm.type !== 'allstar' ? esc(gm.type === 'spring' ? t.springRec.w + '-' + t.springRec.l : t.rec.w + '-' + t.rec.l) : ''}</span><span class="fr-gt-r">${final ? gm.score[i] : ''}</span></div>`;
    };
    let foot = '';
    if (final) {
      const w = pl(L, gm.wp);
      const l = pl(L, gm.lp);
      foot = `<div class="fr-gt-foot"><span>Final${gm.innings > 9 ? '/' + gm.innings : ''}</span>${w ? `<span>W ${esc(w.last)}</span>` : ''}${l ? `<span>L ${esc(l.last)}</span>` : ''}</div>`;
    } else {
      foot = `<div class="fr-gt-foot"><span>${esc(gameLabel(gm) || 'Scheduled')}</span></div>`;
    }
    const lab = gameLabel(gm);
    return `<div class="fr-gtile${final ? ' final' : ''}"${final ? ` data-gid="${esc(gm.id)}" role="button" tabindex="0" title="Box score"` : ''}>${lab && final ? `<div class="fr-gt-lab">${esc(lab)}</div>` : ''}${side(0)}${side(1)}${foot}</div>`;
  }

  // Every game involving a team this season (all phases), by date.
  function teamGames(L, teamId) {
    const out = [];
    for (const id in L.games) {
      const gm = L.games[id];
      if (gm.home === teamId || gm.away === teamId || (teamId === L.userTeamId && gm.meta && gm.meta.userPlays)) out.push(gm);
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (+a.id.slice(1) || 0) - (+b.id.slice(1) || 0)));
    return out;
  }

  // A team's schedule and results, one month at a time.
  function scheduleList(L, teamId, month, onMonth) {
    const games = teamGames(L, teamId);
    const wrap = document.createElement('div');
    if (!games.length) {
      wrap.innerHTML = '<p class="fr-muted">No games on the schedule yet.</p>';
      return wrap;
    }
    const months = [];
    for (const gm of games) {
      const m = gm.date.slice(0, 7);
      if (!months.includes(m)) months.push(m);
    }
    const today = S().today(L).date;
    let cur = month && months.includes(month) ? month : null;
    if (!cur) cur = months.find((m) => today && m === today.slice(0, 7)) || months.filter((m) => !today || m <= today.slice(0, 7)).pop() || months[0];
    const mName = (m) => fmt.date(m + '-01').split(' ')[0];
    let rec = { w: 0, l: 0 };
    const rows = [];
    for (const gm of games) {
      const r = resultFor(gm, teamId);
      if (r && gm.type === 'regular') r.r === 'W' ? rec.w++ : r.r === 'L' && rec.l++;
      if (gm.date.slice(0, 7) !== cur) continue;
      const home = gm.home === teamId;
      const opp = home ? gm.away : gm.home;
      const w = pl(L, gm.wp);
      const l = pl(L, gm.lp);
      const s = pl(L, gm.sv);
      rows.push(`<tr class="${gm.date === today ? 'today' : ''}">
        <td class="l">${esc(fmt.date(gm.date))}</td>
        <td class="l">${home ? 'vs' : '@'} ${chip(L, opp)}${gm.type !== 'regular' ? ` <span class="fr-tag">${esc(gm.type === 'spring' ? 'ST' : gm.type === 'post' ? 'POST' : gm.type === 'allstar' ? 'ASG' : gm.type)}</span>` : ''}</td>
        <td class="l">${r ? `<a href="#" class="fr-res ${r.r}" data-gid="${esc(gm.id)}">${esc(r.text)}${esc(r.extra)}</a>` : `<span class="fr-muted">${gm.date === today ? 'Today' : esc(gameLabel(gm) || '')}</span>`}</td>
        <td class="r">${r && gm.type === 'regular' ? rec.w + '-' + rec.l : ''}</td>
        <td class="l fr-dec">${r ? [w && 'W: ' + ui.playerLink(w, w.last), l && 'L: ' + ui.playerLink(l, l.last), s && 'S: ' + ui.playerLink(s, s.last)].filter(Boolean).join(' · ') : ''}</td>
      </tr>`);
    }
    wrap.innerHTML = `${seg('month', months.map((m) => [m, mName(m)]), cur, 'fr-seg-scroll')}
      <div class="fr-table-wrap"><table class="fr-table fr-sched"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th class="l">Result</th><th class="r">Record</th><th class="l">Decisions</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    onSeg(wrap, (name, v) => onMonth && onMonth(v));
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // New franchise
  // ---------------------------------------------------------------------------
  ui.register('newFranchise', {
    title: 'New franchise',
    render(el) {
      const head = document.getElementById('fr-head-team');
      if (head) head.innerHTML = '<b>New franchise</b>';
      const hd = document.getElementById('fr-head-date');
      if (hd) hd.innerHTML = '';
      const st = { team: null, city: '', name: '', abbr: '', color: null, diff: 'medium' };
      const T = LG().TEAMS;
      let html = `<p class="fr-lead">Take over any of the 30 clubs. You run one team: play or sim its games, set the lineup and rotation, and chase a title.</p>`;
      LG().LEAGUES.forEach((lgName, lg) => {
        html += `<section class="fr-nf-league"><h3>${esc(lgName)}</h3><div class="fr-nf-divs">`;
        LG().DIVS.forEach((dName, dv) => {
          html += `<div class="fr-nf-div"><h4>${esc(dName)}</h4>`;
          for (const t of T.filter((x) => x.league === lg && x.div === dv)) {
            html += `<button class="fr-nf-team" data-pick="${esc(t.id)}" style="--tc:${esc(t.color)};--tc2:${esc(t.color2)}"><span class="fr-nf-sw"></span><span class="fr-nf-nm"><small>${esc(t.city)}</small><b>${esc(t.name)}</b></span><span class="fr-nf-mk" title="Market size">${'$'.repeat(t.market)}</span></button>`;
          }
          html += '</div>';
        });
        html += '</div></section>';
      });
      html += `<div class="fr-card fr-nf-setup" id="nf-setup"><p class="fr-muted">Pick a team above to continue.</p></div>`;
      el.innerHTML = html;
      const setup = el.querySelector('#nf-setup');

      const drawSetup = () => {
        const t = st.team;
        if (!t) return;
        const colors = [t.color, t.color2].concat(BB.COLORS.map((c) => c.hex)).filter((c, i, a) => /^#[0-9a-f]{6}$/i.test(c) && a.indexOf(c) === i);
        const budget = { 1: 115, 2: 150, 3: 195 }[t.market];
        setup.innerHTML = `
          <div class="fr-nf-preview" style="--tc:${esc(st.color)}"><span class="fr-nf-badge">${esc(st.abbr || t.abbr)}</span>
            <div><small>${esc(LG().LEAGUES[t.league])} · ${esc(LG().DIVS[t.div])}</small><h3>${esc(st.city || t.city)} ${esc(st.name || t.name)}</h3>
            <span class="fr-muted">${['', 'Small', 'Mid-size', 'Large'][t.market]} market · payroll budget ${fmt.money(budget)}</span></div></div>
          <div class="fr-nf-fields">
            <label>City<input id="nf-city" maxlength="18" value="${esc(st.city)}" autocomplete="off" spellcheck="false"></label>
            <label>Team name<input id="nf-name" maxlength="16" value="${esc(st.name)}" autocomplete="off" spellcheck="false"></label>
            <label class="fr-nf-abbr">Abbr.<input id="nf-abbr" maxlength="3" value="${esc(st.abbr)}" autocomplete="off" spellcheck="false"></label>
          </div>
          <div class="fr-field-label">Color</div>
          <div class="swatches fr-nf-colors">${colors.map((c) => `<button class="swatch${c === st.color ? ' sel' : ''}" data-color="${esc(c)}" style="background:${esc(c)}" aria-label="Color ${esc(c)}"></button>`).join('')}</div>
          <div class="fr-field-label">Difficulty <span class="fr-muted">(only for games you play)</span></div>
          ${seg('diff', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], st.diff, 'fr-seg-wide')}
          <p class="fr-err" id="nf-err"></p>
          <div class="fr-row-btns"><button class="btn go big" id="nf-start">START FRANCHISE</button></div>`;
        const upd = () => {
          st.city = setup.querySelector('#nf-city').value.trim();
          st.name = setup.querySelector('#nf-name').value.trim();
          st.abbr = setup.querySelector('#nf-abbr').value.trim().toUpperCase();
          setup.querySelector('.fr-nf-preview h3').textContent = `${st.city || t.city} ${st.name || t.name}`;
          setup.querySelector('.fr-nf-badge').textContent = st.abbr || t.abbr;
        };
        setup.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
        setup.querySelectorAll('[data-color]').forEach((b) =>
          b.addEventListener('click', () => {
            st.color = b.dataset.color;
            setup.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('sel', x === b));
            setup.querySelector('.fr-nf-preview').style.setProperty('--tc', st.color);
          }),
        );
        onSeg(setup, (n, v) => {
          st.diff = v;
          setup.querySelectorAll('[data-seg="diff"] button').forEach((x) => x.classList.toggle('sel', x.dataset.v === v));
        });
        setup.querySelector('#nf-start').addEventListener('click', () => start());
      };

      const start = async () => {
        const t = st.team;
        const err = setup.querySelector('#nf-err');
        const city = st.city || t.city;
        const name = st.name || t.name;
        const abbr = (st.abbr || t.abbr).replace(/[^A-Z0-9]/g, '');
        if (abbr.length < 2) return (err.textContent = 'The abbreviation needs 2 or 3 letters.');
        if (T.some((x) => x.id !== t.id && x.abbr === abbr)) return (err.textContent = `${abbr} is already used by another team.`);
        const btn = setup.querySelector('#nf-start');
        btn.disabled = true;
        btn.textContent = 'BUILDING THE LEAGUE…';
        await new Promise((r) => setTimeout(r, 30));
        const L = S().newFranchise({ userTeamId: t.id, difficulty: st.diff, teamName: city + ' ' + name, color: st.color });
        const ut = S().userTeam(L);
        // league.create splits "City Name" at the last word; keep the exact fields.
        const made = ut.city + ' ' + ut.name;
        ut.city = city;
        ut.name = name;
        ut.abbr = abbr;
        for (const n of L.news) n.text = n.text.split(made).join(city + ' ' + name);
        ui.setLeague(L);
        await ui.saveNow();
        ui.show(L, 'home');
      };

      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        const t = T.find((x) => x.id === b.dataset.pick);
        st.team = t;
        st.city = t.city;
        st.name = t.name;
        st.abbr = t.abbr;
        st.color = t.color;
        el.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('sel', x === b));
        drawSetup();
        setup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      // The framework's back button would go to Home, which needs a league.
      const back = el.parentNode && el.parentNode.querySelector('.fr-back');
      if (back) {
        const nb = back.cloneNode(true);
        nb.addEventListener('click', () => ui.exit());
        back.replaceWith(nb);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Home
  // ---------------------------------------------------------------------------
  function probable(L, teamId) {
    const t = S().team(L, teamId);
    if (!t || !BB.engine.pickStarter) return null;
    try {
      const s = BB.engine.pickStarter(L, t);
      return s && s.p ? s.p : null;
    } catch (e) {
      return null;
    }
  }
  function starterLine(L, p, b) {
    if (!p) return '<span class="fr-muted">TBD</span>';
    const s = p.stats[b].pit;
    return `${ui.playerLink(p)} <span class="fr-muted">${p.throws}HP · ${s.w}-${s.l}, ${s.outs ? fmt.era(S().calc(p.stats[b]).era) : '-.--'} ERA</span>`;
  }

  async function simGameNow(L, gid) {
    await ui.runSim({ to: 'day' }, { includeUser: true, label: 'Simulating today' });
    const gm = L.games[gid];
    if (gm && gm.status === 'final') ui.openBox(gid);
  }

  async function continuePhase(L) {
    const id = 'phaseEnd_' + L.phase;
    if (ui.screens[id]) {
      ui.go(id);
      return;
    }
    ui.progress.show('Moving on…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      S().advancePhase(L);
    } finally {
      ui.progress.hide();
    }
    await ui.saveNow();
    ui.refresh();
  }

  ui.register('home', {
    tab: 'Home',
    render(el) {
      const L = ui.league();
      const td = S().today(L);
      const ut = S().userTeam(L);
      const done = S().phaseDone(L);
      const b = bucketFor(L);
      const ug = td.userGame && td.userGame.status !== 'final' ? td.userGame : null;
      // Postseason with the user's team still playing: multi-day sims stop at
      // their next game instead of playing it for them.
      const holdUser = !!(BB.post && BB.post.userAlive && BB.post.userAlive(L));
      const cards = [];

      // Phase complete / special days
      if (done) {
        const nextName = PHASE_NAMES[S().NEXT[L.phase]] || 'the next phase';
        cards.push(`<div class="fr-card fr-cta"><h3>${esc(PHASE_NAMES[L.phase])} complete</h3>
          <p>${L.phase === 'offseason' ? 'The offseason is wrapped up.' : 'Every game in this phase has been played.'} Continue to ${esc(nextName.toLowerCase())}.</p>
          <div class="fr-row-btns"><button class="btn go" data-a="continue">CONTINUE</button></div></div>`);
      }
      if (L.phase === 'offseason' && (has('offseason') || !done)) {
        cards.push(`<div class="fr-card fr-cta alt"><h3>Offseason</h3><p>Retirements, contracts, free agency and the draft.</p>
          <div class="fr-row-btns">${has('offseason') ? '<button class="btn go" data-go="offseason">GO TO THE OFFSEASON</button>' : '<span class="fr-muted">The offseason runs automatically.</span>'}</div></div>`);
      }
      if (td.event === 'allstar') {
        cards.push(`<div class="fr-card fr-cta alt"><h3>All-Star break</h3><p>The best of both leagues meet in the All-Star Game.</p>
          ${has('allstar') ? '<div class="fr-row-btns"><button class="btn go" data-go="allstar">ALL-STAR GAME</button></div>' : ''}</div>`);
      }

      // Today's card
      let today = `<div class="fr-card fr-today"><div class="fr-today-head"><div><small>${esc(PHASE_NAMES[td.phase || L.phase] || '')}</small><h3>${td.date ? esc(fmt.dateLong(td.date)) : esc(L.year)}</h3></div>`;
      if (ug) {
        const lab = gameLabel(ug);
        today += `${lab ? `<span class="fr-pill">${esc(lab)}</span>` : ''}</div>`;
        const side = (id, i) => {
          const t = S().team(L, id);
          const p = probable(L, id);
          return `<div class="fr-mu-side${id === L.userTeamId ? ' user' : ''}">
            <div class="fr-mu-team" style="--tc:${esc(t ? t.color : '#8d99ae')}"><span class="fr-mu-badge">${esc(t ? t.abbr : id)}</span><div><b>${esc(t ? t.city + ' ' + t.name : id)}</b><span>${t && ug.type !== 'allstar' ? esc(recStr(L, t)) : ''}${i ? ' · Home' : ' · Away'}</span></div></div>
            <div class="fr-mu-sp"><small>Probable</small>${starterLine(L, p, ug.type === 'spring' ? 'spring' : ug.type === 'post' ? 'post' : 'reg')}</div></div>`;
        };
        today += `<div class="fr-mu">${side(ug.away, 0)}<div class="fr-mu-at">@</div>${side(ug.home, 1)}</div>
          <div class="fr-play-btns">
            <button class="btn go big" data-a="play"><span>PLAY</span><small>from the first pitch</small></button>
            <button class="btn big" data-a="quick"><span>QUICK PLAY</span><small>key moments only</small></button>
            <button class="btn big" data-a="simgame"><span>SIM GAME</span><small>see the box score</small></button>
          </div>`;
      } else {
        today += '</div>';
        const last = td.userGame && td.userGame.status === 'final' ? td.userGame : null;
        let msg;
        if (done) msg = 'No more games in this phase.';
        else if (!td.date) msg = L.phase === 'offseason' ? 'No games until spring training.' : 'No games scheduled.';
        else if (last) msg = `Today's game is final: ${esc(resultFor(last, L.userTeamId).text)}.`;
        else if (td.event === 'allstar') msg = 'All-Star break. No league games today.';
        else if (td.event === 'off' || !td.games.length) msg = 'Off day. No games scheduled.';
        else msg = `You don't play today. ${td.games.length} game${td.games.length === 1 ? '' : 's'} around the league.`;
        // Postseason, still in it but idle (a bye or between games): say so,
        // and offer the sim that stops at the user's next game.
        if (holdUser && !done && td.date && !last) msg += ` ${esc(BB.post.userStatus(L).text)}`;
        today += `<p>${msg}</p>`;
        if (!done && td.date) today += `<div class="fr-row-btns">${holdUser ? '<button class="btn go" data-a="simnext">SIM TO MY NEXT GAME</button><button class="btn" data-a="simday">SIM DAY</button>' : '<button class="btn go" data-a="simday">SIM DAY</button>'}</div>`;
      }
      // Next games
      const upcoming = teamGames(L, L.userTeamId).filter((gm) => gm.status !== 'final' && (!ug || gm.id !== ug.id) && (!td.date || gm.date >= td.date)).slice(0, 4);
      if (upcoming.length) {
        today += `<div class="fr-upcoming"><small>Next</small>${upcoming.map((gm) => `<span>${esc(fmt.date(gm.date))} ${gm.home === L.userTeamId ? 'vs' : '@'} ${chip(L, gm.home === L.userTeamId ? gm.away : gm.home)}</span>`).join('')}</div>`;
      }
      today += '</div>';
      // Once the phase is over, the Continue card says it all.
      if (!(done && !ug)) cards.push(today);

      // Sim menu
      if (!done && td.date) {
        const remaining = L.days.slice(L.day);
        const lastDate = L.days.length ? L.days[L.days.length - 1].date : td.date;
        const asg = L.phase === 'regular' && td.event !== 'allstar' && remaining.some((d) => d.event === 'allstar');
        const endLabel = { spring: 'End of spring', regular: 'End of season', postseason: 'End of postseason' }[L.phase] || 'End of phase';
        cards.push(`<div class="fr-card fr-sim"><h3>Simulate</h3>
          <div class="fr-sim-btns">
            <button class="btn" data-sim="day">Day</button>
            <button class="btn" data-sim="week">Week</button>
            <button class="btn" data-sim="month">Month</button>
            ${asg ? '<button class="btn" data-sim="allstar">To All-Star break</button>' : ''}
            <button class="btn" data-sim="${L.phase === 'regular' ? 'endRegular' : 'endPhase'}">${esc(endLabel)}</button>
          </div>
          <div class="fr-sim-date"><label>To date <input type="date" id="sim-date" min="${esc(td.date)}" max="${esc(lastDate)}" value="${esc(L.days[Math.min(L.days.length - 1, L.day + 7)] ? L.days[Math.min(L.days.length - 1, L.day + 7)].date : td.date)}"></label><button class="btn" data-sim="date">Sim to date</button></div>
          <p class="fr-muted">${holdUser ? 'In the postseason these stop at your next game, so you can play it. “End of postseason” asks first.' : 'Simulating includes your games.'} You can stop a long sim at any time.</p></div>`);
      }

      // Scoreboard
      let board = '';
      if (td.games.length) board += `<h4>Today</h4><div class="fr-gtiles">${td.games.map((gm) => gameTile(L, gm)).join('')}</div>`;
      const prev = L.days[L.day - 1];
      if (prev && prev.games.length) board += `<h4>${esc(fmt.date(prev.date))} results</h4><div class="fr-gtiles">${prev.games.map((id) => L.games[id]).filter(Boolean).map((gm) => gameTile(L, gm)).join('')}</div>`;

      // Division snapshot
      let div = '';
      if (ut) {
        if (L.phase === 'spring') {
          const rows = L.teams.filter((t) => t.league === ut.league && t.div === ut.div).sort((a, c) => c.springRec.w - c.springRec.l - (a.springRec.w - a.springRec.l) || c.springRec.w - a.springRec.w);
          div = `<table class="fr-table fr-mini"><thead><tr><th class="l">Spring</th><th>W</th><th>L</th></tr></thead><tbody>${rows.map((t) => `<tr class="${t.id === ut.id ? 'user' : ''}"><td class="l">${ui.teamChip(t)}</td><td>${t.springRec.w}</td><td>${t.springRec.l}</td></tr>`).join('')}</tbody></table>`;
        } else {
          const lg = S().standings(L)[ut.league];
          const d = lg && lg.divisions[ut.div];
          if (d) div = `<table class="fr-table fr-mini"><thead><tr><th class="l">${esc(d.name)}</th><th>W</th><th>L</th><th>GB</th><th>L10</th><th>STRK</th></tr></thead><tbody>${d.rows.map((r) => `<tr class="${r.team.id === ut.id ? 'user' : ''}"><td class="l">${r.clinch ? `<span class="fr-clinch">${esc(r.clinch)}-</span>` : ''}${ui.teamChip(r.team)}</td><td>${r.w}</td><td>${r.l}</td><td>${fmt.gb(r.gb)}</td><td>${esc(r.last10)}</td><td>${esc(r.streak)}</td></tr>`).join('')}</tbody></table>`;
        }
      }

      // News and injuries
      const news = L.news.slice(0, 6);
      const injured = ut ? ut.roster.concat(ut.il || [], ut.reserves).map((id) => pl(L, id)).filter((p) => p && p.injury) : [];

      el.innerHTML = `<div class="fr-home">
        <div class="fr-home-main">${cards.join('')}
          ${board ? `<div class="fr-card fr-board"><div class="fr-card-head"><h3>Scoreboard</h3><a href="#" data-go="schedule" data-params='{"view":"board"}' class="fr-more">By date ›</a></div>${board}</div>` : ''}
        </div>
        <div class="fr-home-side">
          ${div ? `<div class="fr-card"><div class="fr-card-head"><h3>Your division</h3><a href="#" data-go="standings" class="fr-more">Standings ›</a></div><div class="fr-table-wrap">${div}</div></div>` : ''}
          <div class="fr-card"><div class="fr-card-head"><h3>Injuries</h3><a href="#" data-go="team" data-params='{"sub":"moves"}' class="fr-more">Roster ›</a></div>
            ${injured.length ? `<ul class="fr-list">${injured.map((p) => `<li>${ui.playerLink(p)} <span class="fr-muted">${esc(p.pos)}</span><span class="fr-inj-line">${esc(p.injury.desc || 'Injured')} · ${esc(p.injury.days)} day${p.injury.days === 1 ? '' : 's'}</span></li>`).join('')}</ul>` : '<p class="fr-muted">Everyone is healthy.</p>'}</div>
          <div class="fr-card"><div class="fr-card-head"><h3>News</h3><a href="#" data-go="news" class="fr-more">All news ›</a></div>
            <ul class="fr-news fr-news-mini">${news.map((n) => newsItem(L, n)).join('') || '<li class="fr-muted">No news yet.</li>'}</ul></div>
        </div></div>`;

      el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]');
        const sim = e.target.closest('[data-sim]');
        if (a) {
          const act = a.dataset.a;
          if (act === 'play' && ug) ui.playGame(ug.id, 'play');
          else if (act === 'quick' && ug) ui.playGame(ug.id, 'quick');
          else if (act === 'simgame' && ug) simGameNow(L, ug.id);
          else if (act === 'simday') ui.runSim({ to: 'day' }, { includeUser: true, label: 'Simulating' });
          else if (act === 'simnext') ui.runSim({ to: 'nextUserGame' }, { label: 'Simulating' });
          else if (act === 'continue') continuePhase(L);
          return;
        }
        if (sim) {
          const to = sim.dataset.sim;
          const labels = { day: 'Simulating a day', week: 'Simulating a week', month: 'Simulating a month', allstar: 'Simulating to the All-Star break', endRegular: 'Simulating the season', endPhase: 'Simulating', date: 'Simulating' };
          const target = { to };
          if (to === 'date') {
            const v = el.querySelector('#sim-date').value;
            if (!v || v <= td.date) return ui.toast('Pick a date after today.');
            target.date = v;
          }
          if (holdUser) {
            // The user's postseason games are theirs to play: stop there.
            if (to === 'endPhase') {
              if (!(await ui.confirm('Your team is still playing. Sim the rest of the postseason, including your own games?', 'Sim everything'))) return;
              ui.runSim(target, { includeUser: true, label: labels[to] });
              return;
            }
            if (ug) return ui.toast('Your game is today: choose Play, Quick play or Sim game.');
            const res = await ui.runSim(target, { includeUser: false, label: labels[to] });
            if (res && res.stoppedBy === 'userGame') ui.toast('Stopped at your next game.');
            return;
          }
          ui.runSim(target, { includeUser: true, label: labels[to] });
        }
      });
      const kbd = (e) => {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('.fr-gtile[data-gid]')) ui.openBox(e.target.dataset.gid);
      };
      el.addEventListener('keydown', kbd);
    },
  });

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------
  const KIND_LABEL = { franchise: 'Franchise', season: 'Season', injury: 'Injury', trade: 'Trade', award: 'Award', transaction: 'Roster', info: 'News', milestone: 'Milestone', postseason: 'Postseason', draft: 'Draft', fa: 'Free agency', contract: 'Contract', retire: 'Retirement' };
  function newsItem(L, n) {
    const t = n.teamId && S().team(L, n.teamId);
    return `<li class="fr-news-item k-${esc(n.kind || 'info')}"><div class="fr-news-meta"><span>${esc(fmt.date(n.date))}</span><span class="fr-kind">${esc(KIND_LABEL[n.kind] || n.kind || 'News')}</span>${t ? ui.teamChip(t) : ''}</div><div class="fr-news-text">${esc(n.text)}</div></li>`;
  }

  ui.register('news', {
    title: 'News',
    render(el, params) {
      const L = ui.league();
      const draw = () => {
        const f = params.filter || 'all';
        const kinds = Array.from(new Set(L.news.map((n) => n.kind || 'info')));
        const list = L.news.filter((n) => f === 'all' || (f === 'mine' ? n.teamId === L.userTeamId : (n.kind || 'info') === f));
        el.innerHTML = `<div class="fr-card">${seg('filter', [['all', 'All'], ['mine', 'My team']].concat(kinds.map((k) => [k, KIND_LABEL[k] || k])), f, 'fr-seg-scroll')}
          <ul class="fr-news">${list.map((n) => newsItem(L, n)).join('') || '<li class="fr-muted">Nothing here yet.</li>'}</ul></div>`;
      };
      onSeg(el, (n, v) => {
        params.filter = v;
        draw();
      });
      draw();
    },
  });

  // ---------------------------------------------------------------------------
  // Schedule and scoreboard
  // ---------------------------------------------------------------------------
  function allDates(L) {
    const by = {};
    for (const id in L.games) {
      const gm = L.games[id];
      (by[gm.date] = by[gm.date] || []).push(gm);
    }
    const dates = Object.keys(by).sort();
    return { dates, by };
  }

  ui.register('schedule', {
    tab: 'Schedule',
    render(el, params) {
      const L = ui.league();
      const draw = () => {
        const view = params.view || 'mine';
        el.innerHTML = `<div class="fr-toolbar">${seg('view', [['mine', 'My schedule'], ['board', 'Scoreboard']], view)}</div><div id="sch-body"></div>`;
        const body = el.querySelector('#sch-body');
        if (view === 'mine') {
          const card = document.createElement('div');
          card.className = 'fr-card';
          const ut = S().userTeam(L);
          card.innerHTML = `<h3>${esc(ut.city + ' ' + ut.name)} · ${L.year}</h3>`;
          card.appendChild(
            scheduleList(L, L.userTeamId, params.month, (m) => {
              params.month = m;
              draw();
            }),
          );
          body.appendChild(card);
        } else {
          const { dates, by } = allDates(L);
          const td = S().today(L).date;
          let date = params.date;
          if (!date || !by[date]) {
            const played = dates.filter((d) => by[d].some((gm) => gm.status === 'final'));
            date = (td && by[td] && by[td].some((gm) => gm.status === 'final') ? td : played.pop()) || td || dates[0];
            if (!by[date]) date = dates.find((d) => !td || d >= td) || dates[dates.length - 1];
          }
          const i = dates.indexOf(date);
          const games = (by[date] || []).slice().sort((a, b) => (+a.id.slice(1) || 0) - (+b.id.slice(1) || 0));
          body.innerHTML = `<div class="fr-card"><div class="fr-daynav">
              <button class="btn" data-day="${i - 1}" ${i <= 0 ? 'disabled' : ''} aria-label="Previous day">‹</button>
              <div><b>${date ? esc(fmt.dateLong(date)) : 'No games'}</b><span class="fr-muted">${games.length} game${games.length === 1 ? '' : 's'}${games[0] ? ' · ' + esc(TYPE_NAMES[games[0].type] || '') : ''}</span></div>
              <button class="btn" data-day="${i + 1}" ${i < 0 || i >= dates.length - 1 ? 'disabled' : ''} aria-label="Next day">›</button>
            </div>
            ${td && date !== td && by[td] ? '<div class="fr-row-btns fr-center"><button class="btn" data-today>Today</button></div>' : ''}
            <div class="fr-gtiles">${games.map((gm) => gameTile(L, gm)).join('') || '<p class="fr-muted">No games.</p>'}</div>
            <p class="fr-muted fr-small">Tap a final score for the box score. Full box scores are kept for your games and the last few days.</p></div>`;
          body.querySelectorAll('[data-day]').forEach((b) =>
            b.addEventListener('click', () => {
              params.date = dates[+b.dataset.day];
              draw();
            }),
          );
          const tb = body.querySelector('[data-today]');
          if (tb)
            tb.addEventListener('click', () => {
              params.date = td;
              draw();
            });
        }
      };
      onSeg(el, (n, v) => {
        if (n === 'view') {
          params.view = v;
          draw();
        }
      });
      draw();
    },
  });

  // ---------------------------------------------------------------------------
  // Standings
  // ---------------------------------------------------------------------------
  const CLINCH = { x: 'clinched a playoff spot', y: 'clinched the division', z: 'clinched a bye', w: 'clinched a wild card', e: 'eliminated', '*': 'best record' };
  function standRow(L, r, wc, i) {
    return `<tr class="${r.team.id === L.userTeamId ? 'user' : ''}${wc && i === 2 ? ' fr-cut' : ''}">
      <td class="l">${r.clinch ? `<span class="fr-clinch" title="${esc(CLINCH[r.clinch] || 'clinched')}">${esc(r.clinch)}-</span>` : ''}${ui.teamChip(r.team)} <span class="fr-tname">${esc(r.team.name)}</span></td>
      <td>${r.w}</td><td>${r.l}</td><td>${fmt.pct(r.pct)}</td><td>${wc && r.wcgb < 0 ? '+' + fmt.gb(-r.wcgb) : fmt.gb(wc ? r.wcgb : r.gb)}</td>
      <td>${esc(r.last10)}</td><td>${esc(r.streak)}</td><td>${esc(r.home)}</td><td>${esc(r.away)}</td><td>${r.rs}</td><td>${r.ra}</td><td class="${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${fmt.signed(r.diff)}</td></tr>`;
  }
  function standTable(L, title, rows, wc) {
    return `<div class="fr-table-wrap"><table class="fr-table fr-stand"><thead><tr><th class="l">${esc(title)}</th><th>W</th><th>L</th><th>PCT</th><th>${wc ? 'WCGB' : 'GB'}</th><th>L10</th><th>STRK</th><th>HOME</th><th>AWAY</th><th>RS</th><th>RA</th><th>DIFF</th></tr></thead><tbody>${rows.map((r, i) => standRow(L, r, wc, i)).join('')}</tbody></table></div>`;
  }

  ui.register('standings', {
    tab: 'Standings',
    render(el, params) {
      const L = ui.league();
      const draw = () => {
        const springView = L.phase === 'spring' && params.view !== 'reg';
        const lgSel = params.lg == null ? 'all' : params.lg;
        let html = `<div class="fr-toolbar">${seg('lg', [['all', 'Both leagues'], ['0', LG().LEAGUES[0]], ['1', LG().LEAGUES[1]]], lgSel)}${L.phase === 'spring' ? seg('view', [['spring', 'Spring'], ['reg', 'Regular season']], springView ? 'spring' : 'reg') : ''}</div>`;
        const lgs = lgSel === 'all' ? [0, 1] : [+lgSel];
        if (springView) {
          for (const lg of lgs) {
            const rows = L.teams.filter((t) => t.league === lg).sort((a, b) => {
              const pa = a.springRec.w / Math.max(1, a.springRec.w + a.springRec.l);
              const pb = b.springRec.w / Math.max(1, b.springRec.w + b.springRec.l);
              return pb - pa || b.springRec.w - a.springRec.w;
            });
            html += `<div class="fr-card"><h3>${esc(LG().LEAGUES[lg])} · Spring training</h3><div class="fr-table-wrap"><table class="fr-table"><thead><tr><th class="l">Team</th><th>W</th><th>L</th><th>PCT</th></tr></thead><tbody>${rows
              .map((t) => `<tr class="${t.id === L.userTeamId ? 'user' : ''}"><td class="l">${ui.teamChip(t)} <span class="fr-tname">${esc(t.name)}</span></td><td>${t.springRec.w}</td><td>${t.springRec.l}</td><td>${fmt.pct(t.springRec.w / Math.max(1, t.springRec.w + t.springRec.l))}</td></tr>`)
              .join('')}</tbody></table></div><p class="fr-muted fr-small">Spring records don't count. Regular-season standings start on Opening Day.</p></div>`;
          }
        } else {
          const st = S().standings(L);
          const used = new Set();
          for (const lg of lgs) {
            const s = st[lg];
            html += `<div class="fr-card"><h3>${esc(s.name)}</h3>`;
            for (const d of s.divisions) {
              html += standTable(L, d.name, d.rows, false);
              d.rows.forEach((r) => r.clinch && used.add(r.clinch));
            }
            html += `<h4>Wild card</h4>${standTable(L, 'Wild card', s.wildcard, true)}<p class="fr-muted fr-small">Division winners and the top 3 wild cards make the postseason. The top 2 seeds get a bye.</p></div>`;
          }
          if (used.size) html += `<p class="fr-muted fr-small">${Array.from(used).map((c) => `<b>${esc(c)}</b> ${esc(CLINCH[c] || 'clinched')}`).join(' · ')}</p>`;
        }
        el.innerHTML = html;
      };
      onSeg(el, (n, v) => {
        params[n] = v;
        draw();
      });
      draw();
    },
  });

  // ---------------------------------------------------------------------------
  // Leaders
  // ---------------------------------------------------------------------------
  const BAT_CATS = ['avg', 'hr', 'rbi', 'ops', 'r', 'h', 'sb', 'obp', 'slg', 'd', 'bb'];
  const PIT_CATS = ['era', 'w', 'k', 'sv', 'whip', 'ip', 'k9'];
  ui.register('leaders', {
    tab: 'Leaders',
    render(el, params) {
      const L = ui.league();
      const draw = () => {
        const phase = params.phase || (L.phase === 'spring' ? 'spring' : L.phase === 'postseason' ? 'post' : 'reg');
        const lg = params.lg == null ? 'all' : params.lg;
        const kind = params.kind || 'bat';
        const lgv = lg === 'all' ? null : +lg;
        const defs = S().LEADER_STATS;
        let html = `<div class="fr-toolbar">${seg('kind', [['bat', 'Batting'], ['pit', 'Pitching']], kind)}${seg('lg', [['all', 'All'], ['0', LG().LEAGUES[0].split(' ')[0]], ['1', LG().LEAGUES[1].split(' ')[0]]], lg)}${seg('phase', BUCKETS, phase)}</div>`;
        if (params.stat && defs[params.stat]) {
          const stat = params.stat;
          const rows = S().leaders(L, { stat, phase, lg: lgv, limit: 50 });
          html += `<div class="fr-card"><div class="fr-card-head"><h3>${esc(defs[stat].label)} leaders</h3><a href="#" class="fr-more" data-allcats>All categories ›</a></div><div class="fr-table-wrap"><table class="fr-table"><thead><tr><th>#</th><th class="l">Player</th><th class="l">Team</th><th>${esc(defs[stat].label)}</th></tr></thead><tbody>${rows
            .map((r, i) => `<tr class="${r.team.id === L.userTeamId ? 'user' : ''}"><td>${i + 1}</td><td class="l">${ui.playerLink(r.player)} <span class="fr-muted">${esc(r.player.pos)}</span></td><td class="l">${ui.teamChip(r.team)}</td><td><b>${esc(fmtStat(stat, r.value))}</b></td></tr>`)
            .join('') || `<tr><td colspan="4" class="l empty">No qualified players yet.</td></tr>`}</tbody></table></div></div>`;
        } else {
          const cats = kind === 'bat' ? BAT_CATS : PIT_CATS;
          html += '<div class="fr-lgrid">';
          for (const stat of cats) {
            if (!defs[stat]) continue;
            const rows = S().leaders(L, { stat, phase, lg: lgv, limit: 5 });
            html += `<div class="fr-card fr-lcard"><div class="fr-card-head"><h3>${esc(defs[stat].label)}</h3><a href="#" class="fr-more" data-stat="${stat}">Top 50 ›</a></div><ol>${rows
              .map((r) => `<li class="${r.team.id === L.userTeamId ? 'user' : ''}"><span class="fr-l-name">${ui.playerLink(r.player)} <span class="fr-muted">${esc(r.team.abbr)}</span></span><b>${esc(fmtStat(stat, r.value))}</b></li>`)
              .join('') || '<li class="fr-muted">No qualified players yet.</li>'}</ol></div>`;
          }
          html += '</div>';
        }
        html += `<p class="fr-muted fr-small">Rate stats need ${phase === 'reg' ? '3.1 plate appearances or 1 inning per team game' : '10 plate appearances or 3 innings'}.</p>`;
        el.innerHTML = html;
      };
      onSeg(el, (n, v) => {
        params[n] = v;
        if (n === 'kind') params.stat = null;
        draw();
      });
      el.addEventListener('click', (e) => {
        const s = e.target.closest('[data-stat]');
        if (s) {
          e.preventDefault();
          params.stat = s.dataset.stat;
          draw();
          el.closest('.fr-main') && (el.closest('.fr-main').scrollTop = 0);
        } else if (e.target.closest('[data-allcats]')) {
          e.preventDefault();
          params.stat = null;
          draw();
        }
      });
      draw();
    },
  });

  // ---------------------------------------------------------------------------
  // Team (yours)
  // ---------------------------------------------------------------------------
  const TEAM_SUBS = [['roster', 'Roster'], ['lineup', 'Lineup'], ['pitching', 'Pitching'], ['moves', 'Moves'], ['stats', 'Stats'], ['payroll', 'Payroll']];
  let teamSub = 'roster';

  function teamHeader(L, t, user) {
    const lg = S().standings(L)[t.league];
    const d = lg && lg.divisions[t.div];
    const rank = d ? d.rows.findIndex((r) => r.team.id === t.id) + 1 : 0;
    const pay = LG().payroll(L, t);
    const r = t.rec;
    return `<div class="fr-team-head" style="--tc:${esc(t.color)};--tc2:${esc(t.color2 || '#ffffff')}">
      <span class="fr-th-badge">${esc(t.abbr)}</span>
      <div class="fr-th-main"><small>${esc(LG().LEAGUES[t.league])} · ${esc(LG().DIVS[t.div])}</small><h2>${esc(t.city)} ${esc(t.name)}</h2>
        <div class="fr-th-facts"><span><b>${r.w}-${r.l}</b> ${rank && L.phase !== 'spring' ? `${ordinal(rank)} in ${esc(LG().DIVS[t.div])}` : ''}</span>${L.phase === 'spring' ? `<span>Spring <b>${t.springRec.w}-${t.springRec.l}</b></span>` : ''}<span>Payroll <b>${fmt.money(pay)}</b> / ${fmt.money(t.budget)}</span></div></div>
      ${user ? '' : has('trade') ? `<a href="#" class="btn fr-th-btn" data-go="trade" data-params='${esc(JSON.stringify({ teamId: t.id }))}'>Propose trade</a>` : ''}</div>`;
  }

  ui.register('team', {
    tab: 'Team',
    render(el, params) {
      const L = ui.league();
      const t = S().userTeam(L);
      if (params.sub) {
        teamSub = params.sub;
        params.sub = null;
      }
      const draw = () => {
        el.innerHTML = `${teamHeader(L, t, true)}
          <div class="fr-card fr-auto"><label class="fr-switch"><input type="checkbox" id="auto-manage" ${t.manual ? '' : 'checked'}><span></span></label>
            <div><b>Auto-manage</b><span class="fr-muted">${t.manual ? 'Off: your lineup and depth chart stay as you set them. Injured players are still replaced on game day.' : 'On: your coaching staff sets the lineup, rotation and bullpen every day. Editing them turns this off.'}</span></div></div>
          ${seg('sub', TEAM_SUBS, teamSub, 'fr-seg-scroll fr-subtabs')}<div id="team-body"></div>`;
        const body = el.querySelector('#team-body');
        ({ roster: drawRoster, lineup: drawLineup, pitching: drawPitching, moves: drawMoves, stats: drawStats, payroll: drawPayroll }[teamSub] || drawRoster)(L, t, body, draw);
        el.querySelector('#auto-manage').addEventListener('change', (e) => {
          t.manual = !e.target.checked;
          if (L.settings) L.settings.autoManage = !t.manual;
          if (!t.manual) LG().autoManage(L, t, true);
          ui.save();
          ui.toast(t.manual ? 'Auto-manage is off.' : 'Auto-manage is on. Your staff reset the depth chart.');
          draw();
        });
      };
      onSeg(el, (n, v) => {
        if (n === 'sub') {
          teamSub = v;
          draw();
        }
      });
      draw();
    },
  });

  function drawRoster(L, t, body) {
    body.innerHTML = `<div class="fr-card"><h3>Position players</h3><div data-h></div></div><div class="fr-card"><h3>Pitchers</h3><div data-p></div></div>
      ${(t.il || []).length ? '<div class="fr-card"><h3>Injured list</h3><div data-il></div></div>' : ''}
      <div class="fr-card"><h3>Reserves</h3><div data-r></div></div>`;
    body.querySelector('[data-h]').appendChild(hitterTable(L, orderedHitters(L, t, t.roster)));
    body.querySelector('[data-p]').appendChild(pitcherTable(L, orderedPitchers(L, t, t.roster)));
    if (body.querySelector('[data-il]')) {
      const il = t.il.map((id) => pl(L, id)).filter(Boolean);
      const wrap = body.querySelector('[data-il]');
      wrap.appendChild(hitterTable(L, il.filter((p) => !isPitcher(p)), { empty: 'No position players.' }));
      wrap.appendChild(pitcherTable(L, il.filter(isPitcher), { empty: 'No pitchers.' }));
    }
    const res = t.reserves.map((id) => pl(L, id)).filter(Boolean);
    const rw = body.querySelector('[data-r]');
    rw.appendChild(hitterTable(L, res.filter((p) => !isPitcher(p)), { sortKey: 'ovr' }));
    rw.appendChild(pitcherTable(L, res.filter(isPitcher), { sortKey: 'ovr' }));
  }

  // --- Lineup editor -----------------------------------------------------------
  function validateLineup(L, t, lineup) {
    const errors = [];
    const warns = [];
    if (lineup.length !== 9) errors.push('The lineup needs 9 batters.');
    const pids = new Set();
    const poss = new Set();
    for (const e of lineup) {
      const p = pl(L, e.pid);
      if (!p) {
        errors.push('An empty spot in the lineup.');
        continue;
      }
      if (pids.has(e.pid)) errors.push(`${p.name} is in the lineup twice.`);
      pids.add(e.pid);
      if (poss.has(e.pos)) errors.push(`Two players at ${e.pos}.`);
      poss.add(e.pos);
      if (!t.roster.includes(e.pid)) errors.push(`${p.name} isn't on the active roster.`);
      if (isPitcher(p)) errors.push(`${p.name} is a pitcher.`);
      if (p.injury) errors.push(`${p.name} is injured (${p.injury.days} days).`);
      else if (e.pos !== 'DH' && p.pos !== e.pos) {
        const drop = LG().ovrAt(p, p.pos) - LG().ovrAt(p, e.pos);
        if (e.pos === 'C' && p.pos !== 'C') warns.push(`${p.name} isn't a catcher: expect a big drop on defense.`);
        else if (drop >= 10) warns.push(`${p.name} is out of position at ${e.pos} (−${drop} OVR).`);
      }
    }
    for (const pos of POSITIONS) if (!poss.has(pos) && lineup.length === 9) errors.push(`Nobody is playing ${pos}.`);
    return { errors: Array.from(new Set(errors)), warns };
  }

  function drawLineup(L, t, body) {
    let draft = t.lineup.map((e) => ({ pid: e.pid, pos: e.pos }));
    const hitters = orderedHitters(L, t, t.roster);
    const render = () => {
      const v = validateLineup(L, t, draft);
      const dirty = JSON.stringify(draft) !== JSON.stringify(t.lineup.map((e) => ({ pid: e.pid, pos: e.pos })));
      const inLineup = new Set(draft.map((e) => e.pid));
      const rows = draft
        .map((e, i) => {
          const p = pl(L, e.pid);
          const fit = p ? LG().ovrAt(p, e.pos) : 0;
          const s = p ? p.stats[bucketFor(L)] : null;
          return `<div class="fr-lu-row${p && p.injury ? ' bad' : ''}" data-i="${i}">
            <span class="fr-lu-n">${i + 1}</span>
            <select class="fr-lu-p" data-i="${i}" aria-label="Batter ${i + 1}">${hitters.map((h) => `<option value="${esc(h.id)}" ${h.id === e.pid ? 'selected' : ''}>${esc(h.name)}${ui.formText(h)} (${esc(h.pos)})${h.injury ? ' INJ' : ''}${!inLineup.has(h.id) ? ' · bench' : ''}</option>`).join('')}</select>
            <select class="fr-lu-pos" data-i="${i}" aria-label="Position for batter ${i + 1}">${POSITIONS.map((pos) => `<option ${pos === e.pos ? 'selected' : ''}>${pos}</option>`).join('')}</select>
            <span class="fr-lu-fit" title="Overall at this position">${p ? ui.rating(Math.max(20, fit)) : ''}</span>
            <span class="fr-lu-st">${s ? `${s.bat.ab ? fmt.avg(S().calc(s).avg) : '-'} <small>${s.bat.hr} HR</small>` : ''}</span>
            <span class="fr-lu-mv"><button class="fr-ib" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="fr-ib" data-down="${i}" ${i === 8 ? 'disabled' : ''} aria-label="Move down">▼</button></span>
          </div>`;
        })
        .join('');
      const bench = hitters.filter((h) => !inLineup.has(h.id));
      body.innerHTML = `<div class="fr-card"><div class="fr-card-head"><h3>Batting order</h3><span class="fr-muted">${dirty ? 'Unsaved changes' : 'Current lineup'}</span></div>
        <p class="fr-muted fr-small">Pick a player or position for each spot. Picking someone already in the lineup swaps the two batting spots; picking a position that is taken swaps the positions. The number shows how good he is at that position.</p>
        <div class="fr-lu">${rows}</div>
        ${v.errors.length ? `<ul class="fr-errs">${v.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${v.warns.length ? `<ul class="fr-warns">${v.warns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="fr-row-btns"><button class="btn go" data-save ${v.errors.length || !dirty ? 'disabled' : ''}>SAVE LINEUP</button><button class="btn" data-best>Best lineup</button><button class="btn" data-reset ${dirty ? '' : 'disabled'}>Undo changes</button></div></div>
        <div class="fr-card"><h3>Bench</h3><div data-bench></div></div>`;
      body.querySelector('[data-bench]').appendChild(hitterTable(L, bench, { empty: 'Nobody on the bench.' }));
    };
    body.addEventListener('change', (e) => {
      const i = +e.target.dataset.i;
      if (e.target.matches('.fr-lu-p')) {
        const pid = e.target.value;
        const j = draft.findIndex((x) => x.pid === pid);
        // Someone already in the lineup: the two batting spots swap (each keeps
        // his position). A bench player takes over this spot's position.
        if (j >= 0 && j !== i) [draft[i], draft[j]] = [draft[j], draft[i]];
        else draft[i].pid = pid;
      } else if (e.target.matches('.fr-lu-pos')) {
        const pos = e.target.value;
        const j = draft.findIndex((x) => x.pos === pos);
        if (j >= 0 && j !== i) draft[j].pos = draft[i].pos;
        draft[i].pos = pos;
      }
      render();
    });
    body.addEventListener('click', (e) => {
      const up = e.target.closest('[data-up]');
      const down = e.target.closest('[data-down]');
      if (up || down) {
        const i = +(up ? up.dataset.up : down.dataset.down);
        const j = up ? i - 1 : i + 1;
        if (j < 0 || j > 8) return;
        [draft[i], draft[j]] = [draft[j], draft[i]];
        render();
      } else if (e.target.closest('[data-best]')) {
        draft = LG().bestLineup(L, t).map((x) => ({ pid: x.pid, pos: x.pos }));
        render();
      } else if (e.target.closest('[data-reset]')) {
        draft = t.lineup.map((x) => ({ pid: x.pid, pos: x.pos }));
        render();
      } else if (e.target.closest('[data-save]')) {
        if (validateLineup(L, t, draft).errors.length) return;
        t.lineup = draft.map((x) => ({ pid: x.pid, pos: x.pos }));
        t.manual = true;
        if (L.settings) L.settings.autoManage = false;
        ui.save();
        ui.toast('Lineup saved. Auto-manage is off.');
        ui.refresh();
      }
    });
    render();
  }

  // --- Rotation, bullpen and closer --------------------------------------------
  function drawPitching(L, t, body) {
    const pitchers = orderedPitchers(L, t, t.roster);
    let rot = t.rotation.filter((id) => t.roster.includes(id)).slice(0, 5);
    let next = t.rotation[t.rotIdx] || rot[0];
    let closer = t.closer;
    const orig = () => JSON.stringify({ r: t.rotation, n: t.rotation[t.rotIdx], c: t.closer });
    const render = () => {
      const pen = pitchers.filter((p) => !rot.includes(p.id));
      if (!pen.some((p) => p.id === closer)) closer = pen.length ? pen.slice().sort((a, b) => b.ovr - a.ovr)[0].id : null;
      if (!rot.includes(next)) next = rot[0];
      const dirty = JSON.stringify({ r: rot, n: next, c: closer }) !== orig();
      const errors = [];
      if (rot.length < 5) errors.push('The rotation needs 5 starters.');
      if (new Set(rot).size !== rot.length) errors.push('A pitcher is in the rotation twice.');
      const warns = [];
      for (const id of rot) {
        const p = pl(L, id);
        if (p && p.injury) warns.push(`${p.name} is injured; he'll be skipped until he's back.`);
        if (p && p.pos === 'RP') warns.push(`${p.name} is a reliever: short outings as a starter.`);
      }
      if (!closer) errors.push('Pick a closer.');
      const rows = rot
        .map((id, i) => {
          const p = pl(L, id);
          const s = p.stats[bucketFor(L)].pit;
          return `<div class="fr-lu-row${p.injury ? ' bad' : ''}">
            <span class="fr-lu-n">${i + 1}</span>
            <select class="fr-rot-p" data-i="${i}" aria-label="Starter ${i + 1}">${pitchers.map((h) => `<option value="${esc(h.id)}" ${h.id === id ? 'selected' : ''}>${esc(h.name)}${ui.formText(h)} (${esc(h.pos)})${h.injury ? ' INJ' : ''}</option>`).join('')}</select>
            <span class="fr-lu-fit">${ui.rating(p.ovr)}</span>
            <span class="fr-lu-st">${s.w}-${s.l}, ${s.outs ? fmt.era(S().calc(p.stats[bucketFor(L)]).era) : '-'} <small>${esc(restText(p))}</small></span>
            <label class="fr-next" title="Starts next"><input type="radio" name="rot-next" value="${esc(id)}" ${id === next ? 'checked' : ''}>Next</label>
            <span class="fr-lu-mv"><button class="fr-ib" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="fr-ib" data-down="${i}" ${i === rot.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span></div>`;
        })
        .join('');
      const penRows = pen
        .sort((a, b) => (b.id === closer) - (a.id === closer) || b.ovr - a.ovr)
        .map((p) => {
          const st = p.stats[bucketFor(L)];
          return `<div class="fr-pen-row${p.injury ? ' bad' : ''}"><label class="fr-cl"><input type="radio" name="closer" value="${esc(p.id)}" ${p.id === closer ? 'checked' : ''}>${p.id === closer ? '<b>Closer</b>' : 'Closer'}</label>
            <span class="fr-pen-name">${ui.playerLink(p)}${injBadge(p)} <span class="fr-muted">${esc(p.pos)} · ${p.throws}HP</span></span>
            <span>${ui.rating(p.ovr)}</span><span class="fr-muted fr-pen-st">${st.pit.sv} SV · ${st.pit.outs ? fmt.era(S().calc(st).era) : '-'} ERA · ${esc(restText(p))}</span></div>`;
        })
        .join('');
      body.innerHTML = `<div class="fr-card"><div class="fr-card-head"><h3>Rotation</h3><span class="fr-muted">${dirty ? 'Unsaved changes' : 'Current rotation'}</span></div>
          <p class="fr-muted fr-small">Starters need 4 days of rest. Pick a pitcher from the bullpen to swap him into the rotation. "Next" starts the next game when he's rested.</p>
          <div class="fr-lu">${rows}</div>
          ${errors.length ? `<ul class="fr-errs">${errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${warns.length ? `<ul class="fr-warns">${warns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="fr-row-btns"><button class="btn go" data-save ${errors.length || !dirty ? 'disabled' : ''}>SAVE PITCHING</button><button class="btn" data-reset ${dirty ? '' : 'disabled'}>Undo changes</button></div></div>
        <div class="fr-card"><h3>Bullpen</h3><p class="fr-muted fr-small">Everyone not in the rotation pitches in relief. The closer gets the save chances.</p><div class="fr-pen">${penRows || '<p class="fr-muted">No relievers.</p>'}</div></div>`;
    };
    body.addEventListener('change', (e) => {
      if (e.target.matches('.fr-rot-p')) {
        const i = +e.target.dataset.i;
        const pid = e.target.value;
        const j = rot.indexOf(pid);
        if (j >= 0 && j !== i) rot[j] = rot[i];
        else if (next === rot[i]) next = pid;
        rot[i] = pid;
      } else if (e.target.name === 'rot-next') next = e.target.value;
      else if (e.target.name === 'closer') closer = e.target.value;
      render();
    });
    body.addEventListener('click', (e) => {
      const up = e.target.closest('[data-up]');
      const down = e.target.closest('[data-down]');
      if (up || down) {
        const i = +(up ? up.dataset.up : down.dataset.down);
        const j = up ? i - 1 : i + 1;
        if (j < 0 || j >= rot.length) return;
        [rot[i], rot[j]] = [rot[j], rot[i]];
        render();
      } else if (e.target.closest('[data-reset]')) {
        rot = t.rotation.filter((id) => t.roster.includes(id)).slice(0, 5);
        next = t.rotation[t.rotIdx] || rot[0];
        closer = t.closer;
        render();
      } else if (e.target.closest('[data-save]')) {
        t.rotation = rot.slice();
        t.rotIdx = Math.max(0, rot.indexOf(next));
        t.bullpen = pitchers.filter((p) => !rot.includes(p.id)).map((p) => p.id);
        t.closer = closer;
        t.manual = true;
        if (L.settings) L.settings.autoManage = false;
        ui.save();
        ui.toast('Pitching staff saved. Auto-manage is off.');
        ui.refresh();
      }
    });
    render();
  }

  // --- Roster moves ------------------------------------------------------------
  function drawMoves(L, t, body, redraw) {
    const act = t.roster.map((id) => pl(L, id)).filter(Boolean);
    const res = t.reserves.map((id) => pl(L, id)).filter(Boolean);
    const c = healthyCounts(L, t);
    const btn = (kind) => (p) => {
      const why = kind === 'up' ? callUpBlock(L, p.id) : sendDownBlock(L, p.id);
      return `<button class="btn sm${kind === 'up' ? ' go' : ''}" data-move="${kind}" data-mpid="${esc(p.id)}" data-nolink ${why ? `aria-disabled="true" title="${esc(why)}"` : ''}>${kind === 'up' ? 'Call up' : 'Send down'}</button>`;
    };
    body.innerHTML = `<div class="fr-card fr-counts">
        <div><b>${t.roster.length}</b>/${MAX_ACTIVE}<span>Active</span></div>
        <div><b>${c.hit}</b><span>Healthy hitters</span></div><div><b>${c.pit}</b><span>Healthy pitchers</span></div>
        <div><b>${t.reserves.length}</b>/${MAX_RESERVES}<span>Reserves</span></div>
        <p class="fr-muted fr-small">Keep at least 10 healthy position players and 11 healthy pitchers active. Roster moves keep your Auto-manage setting.</p></div>
      <div class="fr-card"><h3>Reserves</h3><div data-res></div></div>
      <div class="fr-card"><h3>Active roster</h3><div data-act></div></div>`;
    const rw = body.querySelector('[data-res]');
    rw.appendChild(hitterTable(L, res.filter((p) => !isPitcher(p)), { sortKey: 'ovr', actions: btn('up'), empty: 'No position players in reserve.' }));
    rw.appendChild(pitcherTable(L, res.filter(isPitcher), { sortKey: 'ovr', actions: btn('up'), empty: 'No pitchers in reserve.' }));
    const aw = body.querySelector('[data-act]');
    aw.appendChild(hitterTable(L, orderedHitters(L, t, t.roster), { actions: btn('down') }));
    aw.appendChild(pitcherTable(L, orderedPitchers(L, t, t.roster), { actions: btn('down') }));
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-move]');
      if (!b) return;
      e.preventDefault();
      const r = b.dataset.move === 'up' ? callUp(L, b.dataset.mpid) : sendDown(L, b.dataset.mpid);
      ui.toast(r.msg);
      if (r.ok) redraw();
    });
  }

  // --- Team stats ----------------------------------------------------------------
  function statsTables(L, t, body, bucket) {
    const ids = t.roster.concat(t.il || [], t.reserves);
    const players = ids.map((id) => pl(L, id)).filter(Boolean);
    const bats = players.filter((p) => p.stats[bucket].bat.pa > 0);
    const pits = players.filter((p) => p.stats[bucket].pit.outs > 0 || p.stats[bucket].pit.g > 0);
    const tot = teamTotals(L, t, bucket);
    const tc = S().calc(tot);
    const c = (p) => S().calc(p.stats[bucket]);
    const bt = (p) => p.stats[bucket].bat;
    const pt = (p) => p.stats[bucket].pit;
    const batCols = [
      { key: 'name', label: 'Player', align: 'l', val: (p) => p.last, html: (p) => ui.playerLink(p) + ` <span class="fr-muted">${esc(p.pos)}</span>` },
      { key: 'g', label: 'G', val: (p) => bt(p).g, html: (p) => String(bt(p).g) },
      { key: 'pa', label: 'PA', val: (p) => bt(p).pa, html: (p) => String(bt(p).pa) },
      { key: 'ab', label: 'AB', val: (p) => bt(p).ab, html: (p) => String(bt(p).ab) },
      { key: 'r', label: 'R', val: (p) => bt(p).r, html: (p) => String(bt(p).r) },
      { key: 'h', label: 'H', val: (p) => bt(p).h, html: (p) => String(bt(p).h) },
      { key: 'd', label: '2B', val: (p) => bt(p).d, html: (p) => String(bt(p).d) },
      { key: 't', label: '3B', val: (p) => bt(p).t, html: (p) => String(bt(p).t) },
      { key: 'hr', label: 'HR', val: (p) => bt(p).hr, html: (p) => String(bt(p).hr) },
      { key: 'rbi', label: 'RBI', val: (p) => bt(p).rbi, html: (p) => String(bt(p).rbi) },
      { key: 'bb', label: 'BB', val: (p) => bt(p).bb, html: (p) => String(bt(p).bb) },
      { key: 'k', label: 'SO', val: (p) => bt(p).k, html: (p) => String(bt(p).k) },
      { key: 'sb', label: 'SB', val: (p) => bt(p).sb, html: (p) => String(bt(p).sb) },
      { key: 'avg', label: 'AVG', val: (p) => c(p).avg, html: (p) => fmt.avg(c(p).avg) },
      { key: 'obp', label: 'OBP', val: (p) => c(p).obp, html: (p) => fmt.avg(c(p).obp) },
      { key: 'slg', label: 'SLG', val: (p) => c(p).slg, html: (p) => fmt.avg(c(p).slg) },
      { key: 'ops', label: 'OPS', val: (p) => c(p).ops, html: (p) => fmt.avg(c(p).ops) },
    ];
    const pitCols = [
      { key: 'name', label: 'Pitcher', align: 'l', val: (p) => p.last, html: (p) => ui.playerLink(p) + ` <span class="fr-muted">${esc(p.pos)}</span>` },
      { key: 'g', label: 'G', val: (p) => pt(p).g, html: (p) => String(pt(p).g) },
      { key: 'gs', label: 'GS', val: (p) => pt(p).gs, html: (p) => String(pt(p).gs) },
      { key: 'w', label: 'W', val: (p) => pt(p).w, html: (p) => String(pt(p).w) },
      { key: 'l', label: 'L', val: (p) => pt(p).l, html: (p) => String(pt(p).l) },
      { key: 'sv', label: 'SV', val: (p) => pt(p).sv, html: (p) => String(pt(p).sv) },
      { key: 'ip', label: 'IP', val: (p) => pt(p).outs, html: (p) => fmt.ip(pt(p).outs) },
      { key: 'h', label: 'H', val: (p) => pt(p).h, html: (p) => String(pt(p).h) },
      { key: 'er', label: 'ER', val: (p) => pt(p).er, html: (p) => String(pt(p).er) },
      { key: 'bb', label: 'BB', val: (p) => pt(p).bb, html: (p) => String(pt(p).bb) },
      { key: 'k', label: 'SO', val: (p) => pt(p).k, html: (p) => String(pt(p).k) },
      { key: 'hr', label: 'HR', val: (p) => pt(p).hr, html: (p) => String(pt(p).hr) },
      { key: 'era', label: 'ERA', val: (p) => -c(p).era, html: (p) => fmt.era(c(p).era) },
      { key: 'whip', label: 'WHIP', val: (p) => -c(p).whip, html: (p) => c(p).whip.toFixed(2) },
      { key: 'k9', label: 'K/9', val: (p) => c(p).k9, html: (p) => c(p).k9.toFixed(1) },
    ];
    body.innerHTML = `<div class="fr-card fr-tot">
        <div><b>${tot.bat.ab ? fmt.avg(tc.avg) : '-'}</b><span>AVG</span></div><div><b>${tot.bat.pa ? fmt.avg(tc.ops) : '-'}</b><span>OPS</span></div>
        <div><b>${tot.bat.r}</b><span>Runs</span></div><div><b>${tot.bat.hr}</b><span>HR</span></div><div><b>${tot.bat.sb}</b><span>SB</span></div>
        <div><b>${tot.pit.outs ? fmt.era(tc.era) : '-'}</b><span>ERA</span></div><div><b>${tot.pit.outs ? tc.whip.toFixed(2) : '-'}</b><span>WHIP</span></div><div><b>${tot.pit.k}</b><span>Strikeouts</span></div><div><b>${tot.pit.sv}</b><span>Saves</span></div></div>
      <div class="fr-card"><h3>Batting</h3><div data-b></div></div><div class="fr-card"><h3>Pitching</h3><div data-p></div></div>`;
    body.querySelector('[data-b]').appendChild(ui.table({ cols: batCols, rows: bats, sortKey: 'pa', empty: 'No games yet.' }));
    body.querySelector('[data-p]').appendChild(ui.table({ cols: pitCols, rows: pits, sortKey: 'ip', empty: 'No games yet.' }));
  }
  let statsBucket = null;
  function drawStats(L, t, body) {
    const b = statsBucket || bucketFor(L);
    body.innerHTML = `<div class="fr-toolbar">${seg('bucket', BUCKETS, b)}</div><div data-st></div>`;
    statsTables(L, t, body.querySelector('[data-st]'), b);
    body.querySelector('[data-seg="bucket"]').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-v]');
      if (!btn) return;
      e.stopPropagation();
      statsBucket = btn.dataset.v;
      drawStats(L, t, body);
    });
  }

  function drawPayroll(L, t, body) {
    const pay = LG().payroll(L, t);
    const frac = Math.min(1.25, pay / t.budget);
    const ids = t.roster.concat(t.il || []);
    const list = ids.map((id) => pl(L, id)).filter((p) => p && p.contract).sort((a, b) => b.contract.salary - a.contract.salary);
    const res = t.reserves.map((id) => pl(L, id)).filter((p) => p && p.contract);
    const cols = [
      { key: 'name', label: 'Player', align: 'l', val: (p) => p.last, html: (p) => ui.playerLink(p) + ` <span class="fr-muted">${esc(p.pos)}</span>` },
      { key: 'age', label: 'Age', val: (p) => p.age, html: (p) => String(p.age) },
      { key: 'ovr', label: 'OVR', val: (p) => p.ovr, html: (p) => ui.rating(p.ovr) },
      { key: 'sal', label: 'Salary', val: (p) => p.contract.salary, html: (p) => fmt.money(p.contract.salary) },
      { key: 'yrs', label: 'Years', val: (p) => p.contract.years, html: (p) => String(p.contract.years) },
      { key: 'tot', label: 'Total', val: (p) => p.contract.salary * Math.max(1, p.contract.years), html: (p) => fmt.money(p.contract.salary * Math.max(1, p.contract.years)) },
    ];
    body.innerHTML = `<div class="fr-card"><h3>Payroll</h3>
        <div class="fr-pay"><div class="fr-pay-bar${pay > t.budget ? ' over' : ''}"><i style="width:${Math.round((frac / 1.25) * 100)}%"></i><em style="left:${Math.round((1 / 1.25) * 100)}%" title="Budget"></em></div>
        <div class="fr-pay-nums"><span><b>${fmt.money(pay)}</b> payroll</span><span>Budget <b>${fmt.money(t.budget)}</b></span><span>${pay <= t.budget ? `<b>${fmt.money(t.budget - pay)}</b> room` : `<b class="neg">${fmt.money(pay - t.budget)}</b> over`}</span></div></div>
        <p class="fr-muted fr-small">${['', 'Small', 'Mid-size', 'Large'][t.market] || ''} market. Payroll counts your whole organization: active roster, injured list, reserves and prospects, plus released players you're still paying.</p></div>
      <div class="fr-card"><h3>Contracts</h3><div data-c></div></div>
      ${(t.deadMoney || []).length ? `<div class="fr-card"><h3>Released players still being paid</h3><div data-d></div><p class="fr-muted fr-small">Counted in your payroll until each contract ends.</p></div>` : ''}
      <div class="fr-card"><h3>Reserves</h3><div data-r></div></div>`;
    body.querySelector('[data-c]').appendChild(ui.table({ cols, rows: list, sortKey: 'sal' }));
    body.querySelector('[data-r]').appendChild(ui.table({ cols, rows: res, sortKey: 'sal' }));
    const dead = body.querySelector('[data-d]');
    if (dead) {
      dead.appendChild(
        ui.table({
          cols: [
            { key: 'name', label: 'Player', align: 'l', val: (d) => d.name, html: (d) => esc(d.name) },
            { key: 'salary', label: 'Salary', val: (d) => d.salary, html: (d) => fmt.money(d.salary) },
            { key: 'years', label: 'Years left', val: (d) => d.years, html: (d) => String(d.years) },
          ],
          rows: t.deadMoney,
          sortKey: 'salary',
        }),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Any team's page
  // ---------------------------------------------------------------------------
  ui.register('teamPage', {
    title: (p) => {
      const L = ui.league();
      const t = L && p && S().team(L, p.teamId);
      return t ? `${t.city} ${t.name}` : 'Team';
    },
    render(el, params) {
      const L = ui.league();
      const t = S().team(L, params.teamId);
      if (!t) {
        el.innerHTML = '<div class="fr-card">Team not found.</div>';
        return;
      }
      const user = t.id === L.userTeamId;
      const draw = () => {
        const sub = params.sub || 'roster';
        el.innerHTML = `${teamHeader(L, t, user)}${user ? '<div class="fr-row-btns fr-mb"><a href="#" class="btn" data-go="team">Manage your team ›</a></div>' : ''}
          ${seg('sub', [['roster', 'Roster'], ['stats', 'Stats'], ['schedule', 'Schedule']], sub, 'fr-subtabs')}<div id="tp-body"></div>`;
        const body = el.querySelector('#tp-body');
        if (sub === 'roster') {
          body.innerHTML = `<div class="fr-card"><h3>Lineup &amp; bench</h3><div data-h></div></div><div class="fr-card"><h3>Pitchers</h3><div data-p></div></div><div class="fr-card"><h3>Reserves &amp; prospects</h3><div data-r></div></div>`;
          body.querySelector('[data-h]').appendChild(hitterTable(L, orderedHitters(L, t, t.roster.concat(t.il || []))));
          body.querySelector('[data-p]').appendChild(pitcherTable(L, orderedPitchers(L, t, t.roster.concat(t.il || []))));
          const res = t.reserves.map((id) => pl(L, id)).filter(Boolean);
          body.querySelector('[data-r]').appendChild(hitterTable(L, res.filter((p) => !isPitcher(p)), { sortKey: 'pot' }));
          body.querySelector('[data-r]').appendChild(pitcherTable(L, res.filter(isPitcher), { sortKey: 'pot' }));
        } else if (sub === 'stats') {
          const b = params.bucket || bucketFor(L);
          body.innerHTML = `<div class="fr-toolbar">${seg('bucket', BUCKETS, b)}</div><div data-st></div>`;
          statsTables(L, t, body.querySelector('[data-st]'), b);
        } else {
          const card = document.createElement('div');
          card.className = 'fr-card';
          card.appendChild(
            scheduleList(L, t.id, params.month, (m) => {
              params.month = m;
              draw();
            }),
          );
          body.appendChild(card);
        }
      };
      onSeg(el, (n, v) => {
        if (n === 'month') return;
        params[n] = v;
        draw();
      });
      draw();
    },
  });

  // ---------------------------------------------------------------------------
  // League hub
  // ---------------------------------------------------------------------------
  const HUB = [
    ['news', 'News', 'Every headline from around the league.'],
    ['postseason', 'Postseason', 'The bracket, series and the Diamond Series.'],
    ['allstar', 'All-Star Game', 'Rosters and the midsummer classic.'],
    ['awards', 'Awards', 'MVP, Cy Young, Rookie of the Year and more.'],
    ['injuries', 'Injuries', 'Who is hurt across the league.'],
    ['trade', 'Trades', 'Build a deal with another club.'],
    ['freeAgency', 'Free agency', 'Unsigned players and offers.'],
    ['offseason', 'Offseason', 'Retirements, contracts, the draft and spring.'],
    ['history', 'History', 'Champions and past seasons.'],
  ];
  ui.register('league', {
    tab: 'League',
    render(el) {
      const L = ui.league();
      const tiles = HUB.filter(([id]) => has(id))
        .map(([id, name, desc]) => `<a href="#" class="fr-hub-tile" data-go="${id}"><b>${esc(name)}</b><span>${esc(desc)}</span></a>`)
        .join('');
      let teams = '';
      LG().LEAGUES.forEach((lgName, lg) => {
        teams += `<div class="fr-card"><h3>${esc(lgName)}</h3><div class="fr-hub-divs">`;
        LG().DIVS.forEach((dName, dv) => {
          teams += `<div><h4>${esc(dName)}</h4><ul class="fr-hub-teams">${L.teams
            .filter((t) => t.league === lg && t.div === dv)
            .map((t) => `<li class="${t.id === L.userTeamId ? 'user' : ''}"><a href="#" data-team="${esc(t.id)}"><i style="background:${esc(t.color)}"></i>${esc(t.city)} ${esc(t.name)}</a><span class="fr-muted">${esc(recStr(L, t))}</span></li>`)
            .join('')}</ul></div>`;
        });
        teams += '</div></div>';
      });
      const champ = L.history.length ? L.history[L.history.length - 1] : null;
      const ct = champ && champ.champion && S().team(L, champ.champion);
      el.innerHTML = `<div class="fr-hub">${tiles}</div>
        ${ct ? `<div class="fr-card fr-champ"><small>${esc(champ.year)} champion</small> ${ui.teamChip(ct, { full: true })}</div>` : ''}
        ${teams}`;
    },
  });

  // ---------------------------------------------------------------------------
  // Exports for profile.js, boxscore.js and main.js
  // ---------------------------------------------------------------------------
  ui.core = {
    PHASE_NAMES, TYPE_NAMES, BUCKETS, HIT_R, PIT_R, POSITIONS,
    isPitcher, chip, seg, onSeg, injBadge, resultFor, gameLabel, fmtStat, scoutGrade, contractText, roleOf, bucketFor,
    callUp, sendDown, callUpBlock, sendDownBlock, release, releaseBlock, wireModal, restText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
