// Player profile modal (UI agent): bio, portrait, ratings, season stats,
// career, game log, splits and roster actions. BB.ui.openPlayer(pid).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined' || !BB.ui) return;
  const ui = BB.ui;
  const esc = ui.esc;
  const fmt = ui.fmt;
  const S = () => BB.season;
  const C = () => ui.core;
  const RLABEL = { con: 'Contact', pow: 'Power', eye: 'Eye', spd: 'Speed', fld: 'Fielding', arm: 'Arm', vel: 'Velocity', ctl: 'Control', sta: 'Stamina', stf: 'Stuff' };
  const STATUS = { active: 'Active roster', reserve: 'Reserves', il: 'Injured list', fa: 'Free agent', prospect: 'Prospect' };

  // ---------------------------------------------------------------------------
  // Portrait: a silhouette drawn with the game's rig. The rig is being reworked,
  // so anything unexpected falls back to a plain monogram.
  // ---------------------------------------------------------------------------
  function drawPortrait(canvas, p, color) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = 120;
    const h = 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Backdrop
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#cbeaf7');
    g.addColorStop(0.62, '#9fd8f2');
    g.addColorStop(0.62, '#4caa52');
    g.addColorStop(1, '#3f9446');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.5, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    try {
      const R = BB.rig;
      if (!R) throw new Error('no rig');
      const pitcher = C().isPitcher(p);
      if (pitcher && R.makePitcher && R.drawPitcher) {
        const r = R.makePitcher();
        if (r.update) r.update(0);
        R.drawPitcher(ctx, r, w / 2 + 4, h - 10, 17, color, p.throws);
      } else {
        const r = R.makeBatter();
        if (r.update) r.update(0);
        R.drawBatter(ctx, r, w / 2 + (p.bats === 'L' ? 10 : -10), h - 10, 17, color, p.bats === 'L' ? 'L' : 'R', p.num);
      }
      return true;
    } catch (e) {
      // Fallback: monogram
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '800 34px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.num || (p.first || '?')[0]), w / 2, h / 2 + 2);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Stat lines
  // ---------------------------------------------------------------------------
  const BAT_HEAD = ['G', 'PA', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'SB', 'CS', 'AVG', 'OBP', 'SLG', 'OPS'];
  const PIT_HEAD = ['G', 'GS', 'W', 'L', 'SV', 'IP', 'H', 'R', 'ER', 'BB', 'SO', 'HR', 'ERA', 'WHIP', 'K/9'];
  function batCells(st) {
    const b = st.bat;
    const c = S().calc(st);
    return [b.g, b.pa, b.ab, b.r, b.h, b.d, b.t, b.hr, b.rbi, b.bb, b.k, b.sb, b.cs, b.ab ? fmt.avg(c.avg) : '-', b.pa ? fmt.avg(c.obp) : '-', b.ab ? fmt.avg(c.slg) : '-', b.pa ? fmt.avg(c.ops) : '-'];
  }
  function pitCells(st) {
    const p = st.pit;
    const c = S().calc(st);
    return [p.g, p.gs, p.w, p.l, p.sv, fmt.ip(p.outs), p.h, p.r, p.er, p.bb, p.k, p.hr, p.outs ? fmt.era(c.era) : '-', p.outs ? c.whip.toFixed(2) : '-', p.outs ? c.k9.toFixed(1) : '-'];
  }
  function sumStats(list) {
    const t = BB.league.newStat();
    for (const s of list) {
      if (!s) continue;
      for (const k in t.bat) t.bat[k] += s.bat[k] || 0;
      for (const k in t.pit) t.pit[k] += s.pit[k] || 0;
    }
    return t;
  }
  const row = (cells, first, cls) => `<tr${cls ? ` class="${cls}"` : ''}>${first.map((x) => `<td class="l">${x}</td>`).join('')}${cells.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`;
  const head = (first, cols) => `<thead><tr>${first.map((x) => `<th class="l">${esc(x)}</th>`).join('')}${cols.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead>`;

  function careerTable(L, p, kind) {
    const pitcher = C().isPitcher(p);
    const cells = pitcher ? pitCells : batCells;
    const rows = [];
    const all = [];
    const has = (s) => s && (s.bat.pa > 0 || s.pit.outs > 0 || s.pit.g > 0);
    for (const c of p.career || []) {
      const s = c[kind];
      if (!has(s)) continue;
      all.push(s);
      const t = c.teamId && S().team(L, c.teamId);
      rows.push(row(cells(s), [esc(c.year), t ? esc(t.abbr) : '-']));
    }
    const cur = p.stats[kind];
    if (has(cur)) {
      all.push(cur);
      const t = p.teamId && S().team(L, p.teamId);
      rows.push(row(cells(cur), [`${esc(L.year)}*`, t ? esc(t.abbr) : '-'], 'cur'));
    }
    if (!rows.length) return `<p class="fr-muted">No ${kind === 'post' ? 'postseason' : 'big-league'} stats yet.</p>`;
    if (rows.length > 1) rows.push(row(cells(sumStats(all)), ['Total', `${rows.length} yrs`], 'tot'));
    return `<div class="fr-table-wrap"><table class="fr-table fr-statline">${head(['Year', 'Team'], pitcher ? PIT_HEAD : BAT_HEAD)}<tbody>${rows.join('')}</tbody></table></div>${has(cur) ? '<p class="fr-muted fr-small">* This season, so far.</p>' : ''}`;
  }

  function splitsTable(p, bucket) {
    const st = p.stats[bucket];
    const pitcher = C().isPitcher(p);
    const items = pitcher ? [['vs LHB', st.vsL], ['vs RHB', st.vsR]] : [['vs LHP', st.vsL], ['vs RHP', st.vsR], ['Home', st.home], ['Away', st.away]];
    const rows = items
      .map(([label, s]) => {
        const c = S().calcSplit(s);
        return `<tr><td class="l">${label}</td><td>${s.pa}</td><td>${s.ab}</td><td>${s.h}</td><td>${s.d}</td><td>${s.t}</td><td>${s.hr}</td><td>${s.bb}</td><td>${s.k}</td><td>${s.ab ? fmt.avg(c.avg) : '-'}</td><td>${s.pa ? fmt.avg(c.obp) : '-'}</td><td>${s.ab ? fmt.avg(c.slg) : '-'}</td><td>${s.pa ? fmt.avg(c.obp + c.slg) : '-'}</td></tr>`;
      })
      .join('');
    return `<div class="fr-table-wrap"><table class="fr-table">${head(['Split'], ['PA', 'AB', 'H', '2B', '3B', 'HR', 'BB', 'SO', 'AVG', 'OBP', 'SLG', 'OPS'])}<tbody>${rows}</tbody></table></div>${pitcher ? '<p class="fr-muted fr-small">What batters did against him.</p>' : ''}`;
  }

  function gameLog(L, p, all) {
    const pitcher = C().isPitcher(p);
    const list = (p.log || []).slice().reverse();
    if (!list.length) return '<p class="fr-muted">No games this season.</p>';
    const shown = all ? list : list.slice(0, 15);
    const tag = { spring: 'ST', post: 'POST', allstar: 'ASG' };
    const rows = shown
      .map((e) => {
        const res = `<a href="#" class="fr-res ${esc((e.res || '')[0])}" data-gid="${esc(e.gid)}">${esc(e.res)}</a>`;
        const first = [`${esc(fmt.date(e.date))}${tag[e.type] ? ` <span class="fr-tag">${tag[e.type]}</span>` : ''}`, `${e.home ? 'vs' : '@'} ${esc(e.opp)}`, res];
        if (pitcher) {
          const x = e.pit || [0, 0, 0, 0, 0, ''];
          return `<tr>${first.map((f) => `<td class="l">${f}</td>`).join('')}<td>${fmt.ip(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${esc(x[5] || '')}</td></tr>`;
        }
        const x = e.bat || [0, 0, 0, 0, 0, 0];
        return `<tr>${first.map((f) => `<td class="l">${f}</td>`).join('')}<td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${x[5]}</td></tr>`;
      })
      .join('');
    const cols = pitcher ? ['IP', 'H', 'ER', 'BB', 'SO', 'DEC'] : ['AB', 'H', 'HR', 'RBI', 'BB', 'SO'];
    return `<div class="fr-table-wrap"><table class="fr-table">${head(['Date', 'Opp', 'Result'], cols)}<tbody>${rows}</tbody></table></div>${!all && list.length > shown.length ? `<div class="fr-row-btns"><button class="btn sm" data-alllog>Show all ${list.length} games</button></div>` : ''}`;
  }

  function ratingBars(p) {
    const keys = C().isPitcher(p) ? ['vel', 'ctl', 'sta', 'stf'] : ['con', 'pow', 'eye', 'spd', 'fld', 'arm'];
    const tier = (v) => (v >= 75 ? 'elite' : v >= 65 ? 'good' : v >= 52 ? 'avg' : 'low');
    let h = '<div class="fr-bars">';
    for (const k of keys) {
      const v = p.r[k];
      h += `<div class="fr-bar"><span>${RLABEL[k]}</span><div class="fr-bar-track"><i class="t-${tier(v)}" style="width:${Math.round((v / 99) * 100)}%"></i></div><b>${v}</b></div>`;
    }
    h += '</div>';
    if (p.arsenal && p.arsenal.length) {
      h += `<div class="fr-arsenal">${p.arsenal
        .map((a) => {
          const P = BB.PITCHES[a.key];
          const g = Math.round(50 + (a.q - 1) * 250);
          return `<span title="Pitch quality">${esc(P ? P.name : a.key)} <b>${Math.max(20, Math.min(80, Math.round(g / 5) * 5))}</b></span>`;
        })
        .join('')}</div><p class="fr-muted fr-small">Pitch grades on the 20-80 scouting scale.</p>`;
    }
    return h;
  }

  // ---------------------------------------------------------------------------
  // The modal
  // ---------------------------------------------------------------------------
  function openPlayer(pid) {
    const L = ui.league();
    const p = L && L.players[pid];
    if (!p) {
      ui.toast('That player is no longer in the league.');
      return null;
    }
    const m = C().wireModal(ui.modal({ title: 'Player profile', wide: true, body: '<div class="fr-prof"></div>' }));
    m.root.querySelector('.fr-modal').classList.add('fr-prof-modal');
    const st = { bucket: C().bucketFor(L), tab: 'stats', career: 'reg', allLog: false };
    if (!hasAny(p.stats[st.bucket])) st.bucket = ['reg', 'post', 'spring'].find((b) => hasAny(p.stats[b])) || st.bucket;
    const el = m.el.querySelector('.fr-prof');

    const draw = () => {
      const t = p.teamId && S().team(L, p.teamId);
      const color = t ? t.color : '#4a5468';
      const user = t && t.id === L.userTeamId;
      const pitcher = C().isPitcher(p);
      const sg = C().scoutGrade(p.pot);
      const handed = `${p.bats === 'S' ? 'Switch' : p.bats === 'L' ? 'Left' : 'Right'} / ${p.throws === 'L' ? 'Left' : 'Right'}`;
      const draft = p.draft ? `${p.draft.year} round ${p.draft.round}, pick ${p.draft.pick}${p.draft.teamId ? ' (' + esc(p.draft.teamId) + ')' : ''}` : '';
      const inj = p.injury ? `<span class="fr-inj-big">Injured: ${esc(p.injury.desc || 'injury')} · ${esc(p.injury.days)} day${p.injury.days === 1 ? '' : 's'}</span>` : '<span class="fr-ok">Healthy</span>';
      // Actions
      const acts = [];
      if (t && !user && ui.screens.trade && (p.status === 'active' || p.status === 'reserve' || p.status === 'prospect' || p.status === 'il')) {
        acts.push(`<a href="#" class="btn" data-go="trade" data-params='${esc(JSON.stringify({ pid: p.id }))}'>Propose trade</a>`);
      }
      if (user && t.reserves.includes(p.id)) {
        const why = C().callUpBlock(L, p.id);
        acts.push(`<button class="btn go" data-act="up" ${why ? `disabled title="${esc(why)}"` : ''}>Call up</button>${why ? `<span class="fr-muted fr-small">${esc(why)}</span>` : ''}`);
      }
      if (user && t.roster.includes(p.id)) {
        const why = C().sendDownBlock(L, p.id);
        acts.push(`<button class="btn" data-act="down" ${why ? `disabled title="${esc(why)}"` : ''}>Send down</button>${why ? `<span class="fr-muted fr-small">${esc(why)}</span>` : ''}`);
      }
      if (user && p.teamId === t.id) {
        const why = C().releaseBlock(L, p.id);
        acts.push(`<button class="btn" data-act="release" ${why ? `disabled title="${esc(why)}"` : ''}>Release</button>${why ? `<span class="fr-muted fr-small">${esc(why)}</span>` : ''}`);
      }

      const s = p.stats[st.bucket];
      let tabBody = '';
      if (st.tab === 'stats') {
        tabBody = `${C().seg('bucket', C().BUCKETS, st.bucket)}
          <div class="fr-table-wrap"><table class="fr-table fr-statline">${head([], pitcher ? PIT_HEAD : BAT_HEAD)}<tbody><tr>${(pitcher ? pitCells(s) : batCells(s)).map((x) => `<td>${esc(x)}</td>`).join('')}</tr></tbody></table></div>
          <h4>Splits</h4>${splitsTable(p, st.bucket)}`;
      } else if (st.tab === 'career') {
        tabBody = `${C().seg('career', [['reg', 'Regular season'], ['post', 'Postseason']], st.career)}${careerTable(L, p, st.career)}`;
      } else {
        tabBody = gameLog(L, p, st.allLog);
      }

      el.innerHTML = `<div class="fr-prof-top" style="--tc:${esc(color)}">
          <canvas class="fr-portrait" width="120" height="150" aria-label="Portrait of ${esc(p.name)}"></canvas>
          <div class="fr-prof-name"><span class="fr-prof-num">#${esc(p.num || '-')}</span><div><b>${esc(p.first)} ${esc(p.last)}${ui.formIcon(p)}</b><span>${esc(p.pos)} · ${t ? `${ui.teamChip(t)} ${esc(t.city)} ${esc(t.name)}` : esc(STATUS[p.status] || 'Unsigned')}</span><span class="fr-prof-ovr">${ui.rating(p.ovr)} overall · potential <b class="fr-grade">${sg.grade}</b></span></div></div>
          <div class="fr-prof-info">
            <dl class="fr-facts">
              <div><dt>B/T</dt><dd>${handed}</dd></div>
              <div><dt>Age</dt><dd>${esc(p.age)}${p.rookie ? ' · Rookie' : ''}</dd></div>
              <div><dt>Status</dt><dd>${esc(C().roleOf(L, p) || STATUS[p.status] || '-')}</dd></div>
              <div><dt>Contract</dt><dd>${esc(C().contractText(p))}</dd></div>
              <div><dt>Scouting grade</dt><dd><b class="fr-grade">${sg.grade}</b> ${esc(sg.word)}</dd></div>
              ${draft ? `<div><dt>Drafted</dt><dd>${draft}</dd></div>` : ''}
              <div><dt>Health</dt><dd>${inj}</dd></div>
              ${formFact(L, p)}
            </dl>
            ${acts.length ? `<div class="fr-row-btns fr-prof-acts">${acts.join('')}</div>` : ''}
          </div>
          <div class="fr-prof-ratings"><h4>Ratings</h4>${ratingBars(p)}${notesBlock(L, p)}</div>
        </div>
        ${C().seg('tab', [['stats', 'Season'], ['career', 'Career'], ['log', 'Game log']], st.tab, 'fr-subtabs')}
        <div class="fr-prof-tab">${tabBody}</div>`;
      drawPortrait(el.querySelector('.fr-portrait'), p, color);
    };

    C().onSeg(el, (n, v) => {
      if (n === 'tab') st.tab = v;
      if (n === 'bucket') st.bucket = v;
      if (n === 'career') st.career = v;
      draw();
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-alllog]')) {
        st.allLog = true;
        draw();
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      if (a.dataset.act === 'release') {
        ui.confirm(`Release ${p.name}? He becomes a free agent and any team can sign him. ${owedText(L, p)}`, 'Release').then((ok) => {
          if (!ok) return;
          const r = C().release(L, p.id);
          ui.toast(r.msg);
          if (r.ok) {
            m.close();
            ui.refresh();
          }
        });
        return;
      }
      const r = a.dataset.act === 'up' ? C().callUp(L, p.id) : C().sendDown(L, p.id);
      ui.toast(r.msg);
      if (r.ok) {
        draw();
        ui.refresh();
      }
    });
    draw();
    return m;
  }
  // What releasing costs, in plain words. Contract years count down at the
  // offseason re-signing step, so early in the offseason they still include
  // the season that just ended.
  function owedText(L, p) {
    const yrs = p.contract ? p.contract.years : 0;
    const beforeTick = L.phase === 'offseason' && ['recap', 'retire', 'progress'].includes(L.offStep);
    const future = beforeTick ? yrs - 1 : yrs;
    const pay = fmt.money(p.contract ? p.contract.salary : 0);
    if (yrs <= 0 || (beforeTick && future <= 0)) return 'His contract is up, so you owe him nothing more.';
    if (L.phase === 'offseason') return `You keep paying his salary (${pay} a year) for ${future} more season${future === 1 ? '' : 's'}, until his contract ends.`;
    return yrs === 1
      ? `You keep paying his salary (${pay}) through the end of this season, when his contract ends.`
      : `You keep paying his salary (${pay} a year) through this season and ${yrs - 1} more, until his contract ends.`;
  }

  // In-season form (form.js): "Hot streak" or "Cold streak" while it shows.
  function formFact(L, p) {
    const st = BB.form ? BB.form.status(L, p) : null;
    if (!st) return '';
    const [icon, word] = ui.FORM_ICON[st];
    return `<div><dt>Form</dt><dd class="fr-form-word ${st}">${icon} ${word}</dd></div>`;
  }
  // Lasting mid-season changes, newest first: "Breakout: +3 contact (Jun 12)".
  function notesBlock(L, p) {
    const notes = (p.notes || []).slice().reverse();
    if (!notes.length) return '';
    const when = (n) => (n.date ? (n.year === L.year ? fmt.date(n.date) : fmt.dateLong(n.date)) : String(n.year));
    return `<h4 class="fr-notes-h">Notes</h4><ul class="fr-notes">${notes
      .map((n) => `<li class="${n.kind === 'breakout' || n.kind === 'up' ? 'up' : 'down'}">${esc(n.text)} <span class="fr-muted">(${esc(when(n))})</span></li>`)
      .join('')}</ul>`;
  }

  function hasAny(s) {
    return s && (s.bat.pa > 0 || s.pit.g > 0);
  }

  ui.openPlayer = openPlayer;
  ui.drawPortrait = drawPortrait;
})(typeof window !== 'undefined' ? window : globalThis);
