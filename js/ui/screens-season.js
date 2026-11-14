// Season screens: postseason bracket, awards, All-Star Game, injury report,
// league history, and the regular-season / postseason phase-end screens.
// Owned by the depth agent. Shared helpers live in BB.depthUI (also used by
// screens-offseason.js).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined') return;
  const UI = () => BB.ui;
  const S = () => BB.season;
  const D = () => BB.depth;
  const PS = () => BB.post;

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------
  const esc = (s) => UI().esc(s);
  const team = (L, id) => L.teams.find((t) => t.id === id) || null;
  const chip = (t, o) => (t ? UI().teamChip(t, o) : '');
  const money = (m) => UI().fmt.money(m);
  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  // A player link when the player still exists (retired players are removed).
  function who(L, ref) {
    if (!ref) return '-';
    const p = L.players[ref.pid];
    return p ? UI().playerLink(p, ref.name || p.name) : esc(ref.name || '');
  }
  function warBadge(x) {
    return x == null ? '' : `<span class="dp-war" title="Wins above replacement (estimate)">${(+x).toFixed(1)} WAR</span>`;
  }
  function delta(x) {
    if (!x) return '<span class="dp-delta">0</span>';
    return `<span class="dp-delta ${x > 0 ? 'up' : 'down'}">${x > 0 ? '+' : ''}${x}</span>`;
  }
  function on(el, handlers) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || !el.contains(b) || b.disabled) return;
      const fn = handlers[b.dataset.a];
      if (fn) {
        e.preventDefault();
        fn(b, e);
      }
    });
  }
  function place(el, sel, node) {
    const slot = el.querySelector(sel);
    if (slot) slot.replaceWith(node);
  }
  function card(html, cls) {
    return `<div class="fr-card${cls ? ' ' + cls : ''}">${html}</div>`;
  }
  // Is this game on today's calendar (playable now)?
  const isToday = (L, gm) => !!(L.days[L.day] && L.days[L.day].games.includes(gm.id));

  // Away @ home for league games and the All-Star Game (whose teams aren't league teams).
  function sideInfo(L, gm, i) {
    const id = i ? gm.home : gm.away;
    const t = team(L, id);
    if (t) return { abbr: t.abbr, name: t.city + ' ' + t.name, color: t.color, id: t.id };
    const m = gm.meta || {};
    return { abbr: id, name: i ? m.homeName : m.awayName, color: i ? m.homeColor : m.awayColor, id: null };
  }

  // Next-game card with Play / Quick / Sim buttons.
  function gameCard(L, gm, opts) {
    const o = opts || {};
    const a = sideInfo(L, gm, 0);
    const h = sideInfo(L, gm, 1);
    const m = gm.meta || {};
    const today = isToday(L, gm);
    const final = gm.status === 'final';
    const side = (x, score) =>
      `<span class="dp-match-team"${x.id ? ` data-team="${esc(x.id)}"` : ''}><i style="background:${esc(x.color)}"></i>${esc(x.abbr)}${score != null ? ` <span class="dp-num">${score}</span>` : ''}<small>${esc(x.name)}</small></span>`;
    let btns = '';
    if (!final && today) {
      btns = `<div class="fr-row-btns"><button class="btn go" data-a="play" data-gid-play="${esc(gm.id)}">Play</button><button class="btn" data-a="quick" data-gid-play="${esc(gm.id)}">Quick play</button><button class="btn" data-a="simday">Sim</button></div>`;
    } else if (!final && o.simTo) {
      btns = `<div class="fr-row-btns"><button class="btn" data-a="${esc(o.simTo)}">Sim to this game</button></div>`;
    } else if (final) {
      btns = `<div class="fr-row-btns"><button class="btn sm" data-gid="${esc(gm.id)}">Box score</button></div>`;
    }
    return card(
      `<div class="dp-head-row"><span class="dp-label">${esc(m.label || 'Next game')}</span><span class="fr-muted">${esc(UI().fmt.dateLong(gm.date))}${today && !final ? ' · today' : ''}</span></div>
      <div class="dp-match" style="margin-top:8px">
        <div class="dp-match-teams">${side(a, final ? gm.score[0] : null)}<span class="dp-match-at">@</span>${side(h, final ? gm.score[1] : null)}</div>
        ${btns}
      </div>
      ${m.seriesText ? `<div class="fr-muted" style="margin-top:6px">${esc(m.seriesText)}${m.clinch ? ' · <b>a win clinches the Diamond Series</b>' : m.clinchFor && m.clinchFor.length ? ' · <b>series point</b>' : ''}</div>` : ''}
      ${o.extra || ''}`,
      'dp-gamecard',
    );
  }

  // Shared handlers for game buttons.
  function gameHandlers(L) {
    return {
      play: (b) => UI().playGame(b.dataset.gidPlay, 'play'),
      quick: (b) => UI().playGame(b.dataset.gidPlay, 'quick'),
      simday: () => UI().runSim({ to: 'day' }, { includeUser: true, label: 'Simulating' }),
      simnext: () => UI().runSim({ to: 'nextUserGame' }, { label: 'Simulating' }),
      simallstar: () => UI().runSim({ to: 'allstar' }, { label: 'Simulating to the break' }),
      simend: () => UI().runSim({ to: 'endPhase' }, { includeUser: true, label: 'Simulating' }),
    };
  }

  // ---------------------------------------------------------------------------
  // Bracket
  // ---------------------------------------------------------------------------
  function seriesCard(L, s, opts) {
    const o = opts || {};
    const u = L.userTeamId;
    const rows = [s.hi, s.lo]
      .map((id) => {
        const t = team(L, id);
        if (!t) return '';
        const seed = id === s.hi ? s.hiSeed : s.loSeed;
        const cls = [s.winner === id ? 'win' : s.winner && s.winner !== id ? 'out' : '', id === u ? 'me' : ''].join(' ');
        return `<div class="dp-srow ${cls}"><span class="seed">${seed || ''}</span><i class="bar" style="background:${esc(t.color)}"></i><span class="nm" data-team="${esc(t.id)}">${esc(t.abbr)}<small>${esc(t.name)}</small></span><span class="w">${s.wins ? s.wins[id] || 0 : ''}</span></div>`;
      })
      .join('');
    let foot = '';
    if (s.winner) foot = `${esc(team(L, s.winner).abbr)} wins ${Math.max(s.wins[s.hi], s.wins[s.lo])}-${Math.min(s.wins[s.hi], s.wins[s.lo])}`;
    else if (PS() && s.games) {
      foot = PS().seriesText(L, s);
      const next = s.games.map((g) => L.games[g]).find((g) => g && g.status !== 'final');
      if (next) foot += isToday(L, next) ? ` · Game ${next.series.gameNum} today` : ` · Game ${next.series.gameNum} ${UI().fmt.date(next.date)}`;
    }
    if (o.best) foot = (foot ? foot + ' · ' : '') + `best of ${s.best}`;
    const live = !s.winner && s.games && s.games.length;
    const mine = (s.hi === u || s.lo === u) && !s.winner;
    return `<div class="dp-series${live ? ' live' : ''}${mine ? ' mine' : ''}">${rows}${foot ? `<div class="dp-sfoot">${foot}</div>` : ''}</div>`;
  }
  function tbdCard(text) {
    return `<div class="dp-series tbd"><div class="dp-srow"><span class="nm fr-muted" style="font-weight:600">${esc(text)}</span></div></div>`;
  }

  // post: L.post, or a history entry ({ seeds, bracket }).
  function bracketHTML(L, post) {
    const list = post.series || post.bracket || [];
    const find = (key, lg) => list.filter((s) => s.key === key && (lg == null || s.lg === lg));
    const fin = find('final')[0];
    let h = `<div class="dp-final"><div class="dp-final-title">DIAMOND SERIES</div>${fin ? seriesCard(L, fin, { best: !fin.winner && !(fin.games && fin.games.length) }) : tbdCard('Coast champion vs Heartland champion · best of 7')}</div>`;
    h += '<div class="fr-grid">';
    for (let lg = 0; lg < 2; lg++) {
      const seeds = post.seeds ? post.seeds[lg] : [];
      const wc = find('wc', lg);
      const ds = find('ds', lg);
      const lcs = find('lcs', lg);
      const byes = seeds
        .slice(0, 2)
        .map((id, i) => {
          const t = team(L, id);
          return t ? `<div class="dp-bye"><b>${i + 1}</b> ${chip(t)} · bye</div>` : '';
        })
        .join('');
      h += card(
        `<div class="dp-lg-head"><h3>${esc(BB.league.LEAGUES[lg])}</h3><span class="fr-muted">${seeds.length ? '6 teams' : ''}</span></div>
        <div class="dp-bracket">
          <div class="dp-round"><div class="dp-round-name">Wild Card · Bo3</div>${byes}${wc.length ? wc.map((s) => seriesCard(L, s)).join('') : tbdCard('3 vs 6') + tbdCard('4 vs 5')}</div>
          <div class="dp-round"><div class="dp-round-name">Division Series · Bo5</div>${ds.length ? ds.map((s) => seriesCard(L, s)).join('') : tbdCard('1 vs 4/5 winner') + tbdCard('2 vs 3/6 winner')}</div>
          <div class="dp-round"><div class="dp-round-name">LCS · Bo7</div>${lcs.length ? lcs.map((s) => seriesCard(L, s)).join('') : tbdCard('Division Series winners')}</div>
        </div>`,
      );
    }
    return h + '</div>';
  }

  // "If the season ended today" seeds.
  function projectedHTML(L) {
    const sd = PS().projected(L);
    let h = '<div class="fr-grid">';
    sd.forEach((ids, lg) => {
      const rows = ids
        .map((id, i) => {
          const t = team(L, id);
          const mark = t.clinch && t.clinch !== 'e' ? ` <span class="dp-pill ${t.clinch === 'x' ? 'green' : 'gold'}" title="${t.clinch === 'x' ? 'Clinched the division' : 'Clinched a postseason berth'}">${t.clinch}</span>` : '';
          return `<tr class="${id === L.userTeamId ? 'user' : ''}"><td class="r">${i + 1}</td><td class="l">${chip(t, { full: true })}${mark}</td><td class="r">${t.rec.w}-${t.rec.l}</td><td class="l fr-muted">${i < 3 ? 'Division' : 'Wild card'}${i < 2 ? ' · bye' : ''}</td></tr>`;
        })
        .join('');
      h += card(`<h3>${esc(BB.league.LEAGUES[lg])}</h3><div class="fr-table-wrap"><table class="fr-table"><thead><tr><th class="r">Seed</th><th class="l">Team</th><th class="r">W-L</th><th class="l"></th></tr></thead><tbody>${rows}</tbody></table></div>`);
    });
    return h + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Awards
  // ---------------------------------------------------------------------------
  const AWARDS = [
    ['mvp', 'Most Valuable Player'],
    ['cy', 'Cy Young Award'],
    ['roy', 'Rookie of the Year'],
    ['rel', 'Reliever of the Year'],
  ];
  function awardBlock(L, a, title, race) {
    if (!a) return `<div class="dp-award"><div class="dp-award-title">${esc(title)}</div><div class="fr-muted">No qualified players.</div></div>`;
    const t = team(L, a.teamId);
    const fin = (a.top || []).slice(1).map((x) => `${who(L, x)} (${esc(team(L, x.teamId) ? team(L, x.teamId).abbr : '')}, ${(+x.war).toFixed(1)})`);
    return `<div class="dp-award"><div class="dp-award-title">${esc(title)}${race ? ' · leader' : ''}</div>
      <div class="dp-award-win">${who(L, a)} ${chip(t)} <span class="fr-muted">${esc(a.pos)}</span> ${warBadge(a.war)}</div>
      <div class="dp-award-line">${esc(a.line)}</div>
      ${fin.length ? `<div class="dp-award-fin">${race ? 'Chasing' : 'Finalists'}: ${fin.join(', ')}</div>` : ''}</div>`;
  }
  function awardsHTML(L, aw, race) {
    let h = '<div class="dp-awards">';
    for (const lgA of aw.leagues) {
      h += card(`<h3>${esc(lgA.name)}</h3>` + AWARDS.map(([k, label]) => awardBlock(L, lgA[k], label, race)).join(''));
    }
    return h + '</div>';
  }
  function specialAwards(L, entry) {
    const bits = [];
    const as = entry.allStarMvp || (entry.allStar && entry.allStar.mvp);
    if (as) bits.push(`<div class="dp-award"><div class="dp-award-title">All-Star Game MVP</div><div class="dp-award-win">${who(L, as)} ${chip(team(L, as.teamId))}</div><div class="dp-award-line">${esc(as.line || '')}</div></div>`);
    const sm = entry.seriesMvp;
    if (sm) bits.push(`<div class="dp-award"><div class="dp-award-title">Diamond Series MVP</div><div class="dp-award-win">${who(L, sm)} ${chip(team(L, sm.teamId))}</div><div class="dp-award-line">${esc(sm.line || '')}</div></div>`);
    return bits.length ? card(`<h3>Special awards</h3><div class="dp-awards">${bits.join('')}</div>`) : '';
  }

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------
  UI().register('postseason', {
    title: 'Postseason',
    render(el) {
      const L = UI().league();
      const post = L.post && L.post.series ? L.post : null;
      let h = '';
      if (post) {
        const st = PS().userStatus(L);
        const next = PS().nextUserGame(L);
        const done = !!post.champion;
        if (done) {
          const ch = team(L, post.champion);
          h += card(`<div class="dp-head-row"><div><div class="dp-kicker">${L.year} champions</div><div class="dp-big">${esc(ch.city + ' ' + ch.name)}</div></div>${L.phase === 'postseason' ? '<button class="btn go" data-go="phaseEnd_postseason">Celebrate &amp; continue</button>' : ''}</div>${post.mvp ? `<p class="fr-muted" style="margin:8px 0 0">Diamond Series MVP: ${who(L, post.mvp)}, ${esc(post.mvp.line)}</p>` : ''}`);
        } else {
          h += card(`<div class="dp-head-row"><div><div class="dp-kicker">Your team</div><div>${esc(st.text)}</div></div><div class="fr-row-btns" style="margin:0">${next && !isToday(L, next) ? '<button class="btn sm" data-a="simnext">Sim to my next game</button>' : ''}${!next || !isToday(L, next) ? '<button class="btn sm" data-a="simday">Sim a day</button>' : ''}<button class="btn sm" data-a="simend">Sim to the end</button></div></div>`);
          if (next) h += gameCard(L, next, { simTo: 'simnext' });
        }
        h += bracketHTML(L, post);
      } else if (L.phase === 'regular' || L.phase === 'spring') {
        h += `<p class="dp-sub">The postseason starts after the regular season: 12 teams, 6 from each league. Seeds 1 and 2 get a bye past the Wild Card Series.</p>`;
        h += `<div class="dp-head-row" style="margin-bottom:8px"><span class="dp-kicker">If the season ended today</span></div>`;
        h += projectedHTML(L);
      } else {
        const last = L.history[L.history.length - 1];
        if (last && last.bracket) {
          h += `<p class="dp-sub">${last.year} postseason</p>` + bracketHTML(L, last);
        } else h += card('<p class="fr-muted">No postseason yet.</p>');
      }
      el.innerHTML = h;
      on(el, gameHandlers(L));
    },
  });

  UI().register('awards', {
    title: (p) => (p && p.year ? `${p.year} Awards` : 'Awards'),
    render(el, params) {
      const L = UI().league();
      const years = L.history.map((h) => h.year);
      if (L.awards && !years.includes(L.awards.year)) years.push(L.awards.year);
      years.sort((a, b) => b - a);
      let year = params.year || (L.awards ? L.awards.year : years[0]);
      let aw = L.awards && L.awards.year === year ? L.awards : null;
      const entry = L.history.find((x) => x.year === year);
      if (!aw && entry) aw = entry.awards;
      let h = '';
      if (years.length > 1) h += `<div class="dp-years">${years.map((y) => `<button class="btn xs${y === year ? ' go' : ''}" data-go="awards" data-params='{"year":${y}}'>${y}</button>`).join('')}</div>`;
      if (aw) {
        h += awardsHTML(L, aw, false);
        h += specialAwards(L, Object.assign({}, entry || {}, { allStarMvp: aw.allStarMvp || (entry && entry.allStar && entry.allStar.mvp), seriesMvp: aw.seriesMvp || (entry && entry.seriesMvp) || (L.post && L.post.year === year ? L.post.mvp : null) }));
      } else if (L.phase === 'regular' && L.days.length && L.day > 10) {
        h += `<p class="dp-sub">Awards are handed out when the regular season ends. Current leaders by value (WAR):</p>`;
        h += awardsHTML(L, D().computeAwards(L, { dry: true }), true);
      } else {
        h += card('<p class="fr-muted" style="margin:0">Awards are handed out at the end of the regular season: MVP, Cy Young, Rookie of the Year and Reliever of the Year in each league.</p>');
      }
      el.innerHTML = h;
    },
  });

  function rosterTable(L, r, homeLg) {
    const statOf = (p) => (p ? D().statLine(p) : '');
    const line = (pid, pos, n) => {
      const p = L.players[pid];
      if (!p) return '';
      const t = team(L, p.teamId);
      return `<tr><td class="r fr-muted">${n || ''}</td><td class="l">${esc(pos)}</td><td class="l">${UI().playerLink(p)}</td><td class="l">${chip(t)}</td><td class="l fr-muted">${esc(statOf(p))}</td></tr>`;
    };
    const group = (label) => `<tr><td class="l dp-group" colspan="5">${label}</td></tr>`;
    let rows = group('Starting lineup') + r.starters.map((e, i) => line(e.pid, e.pos, i + 1)).join('');
    rows += group('Bench') + r.bench.map((id) => line(id, L.players[id] ? L.players[id].pos : '')).join('');
    rows += group('Starting pitchers') + r.sp.map((id) => line(id, 'SP')).join('');
    rows += group('Relievers') + r.rp.map((id) => line(id, id === r.closer ? 'CL' : 'RP')).join('');
    return `<div class="fr-table-wrap"><table class="fr-table dp-num"><tbody>${rows}</tbody></table></div>`;
  }

  UI().register('allstar', {
    title: 'All-Star Game',
    render(el) {
      const L = UI().league();
      const as = L.allStar && L.allStar.year === L.year ? L.allStar : null;
      const ut = S().userTeam(L);
      let h = '';
      let rosters = null;
      if (as) {
        const gm = L.games[as.gameId];
        rosters = as.rosters;
        if (gm) {
          let extra = '';
          if (as.result && as.result.mvp) extra = `<p style="margin:8px 0 0">MVP: ${who(L, as.result.mvp)} ${chip(team(L, as.result.mvp.teamId))} <span class="fr-muted">${esc(as.result.mvp.line)}</span></p>`;
          else if (gm.status !== 'final') extra = `<p class="fr-muted" style="margin:8px 0 0">You manage the ${esc(gm.meta.userSide === 'home' ? gm.meta.homeName : gm.meta.awayName)}. No league stats are kept.</p>`;
          h += gameCard(L, gm, { simTo: 'simallstar', extra });
        }
      } else if (L.phase === 'regular' && D().allStarDayIndex(L) >= 0) {
        const d = L.days[D().allStarDayIndex(L)];
        h += `<p class="dp-sub">The All-Star Game is on ${esc(UI().fmt.dateLong(d.date))}. Rosters are picked by performance at the break. Projected rosters:</p>`;
        rosters = [D().selectAllStars(L, 0), D().selectAllStars(L, 1)];
        h += `<div class="fr-row-btns" style="margin:0 0 12px"><button class="btn" data-a="simallstar">Sim to the All-Star break</button></div>`;
      } else {
        const last = L.history.slice().reverse().find((x) => x.allStar);
        h += card(`<p class="fr-muted" style="margin:0">The All-Star Game is played at midseason, between the Coast League and Heartland League All-Stars.${last ? ` Last game (${last.year}): ${last.allStar.score.join('-')}${last.allStar.mvp ? `, MVP ${who(L, last.allStar.mvp)}` : ''}.` : ''}</p>`);
      }
      if (rosters) {
        const order = ut.league === 0 ? [0, 1] : [1, 0];
        h += '<div class="fr-grid">';
        for (const lg of order) {
          const r = rosters[lg];
          const mine = D().rosterPids(r).filter((id) => L.players[id] && L.players[id].teamId === ut.id).length;
          h += card(`<div class="dp-lg-head"><h3><i class="fr-dot" style="display:inline-block;background:${esc(r.color)};margin-right:6px"></i>${esc(r.name)}</h3>${lg === ut.league ? `<span class="dp-pill gold">${mine} from your team</span>` : ''}</div>${rosterTable(L, r)}`);
        }
        h += '</div>';
      }
      el.innerHTML = h;
      on(el, gameHandlers(L));
    },
  });

  UI().register('injuries', {
    title: 'Injury report',
    render(el, params) {
      const L = UI().league();
      const all = D().injuryList(L);
      const scope = params.scope || 'all';
      const rows = scope === 'mine' ? all.filter((x) => x.team.id === L.userTeamId) : all;
      const mine = all.filter((x) => x.team.id === L.userTeamId);
      const il = all.filter((x) => x.injury.il);
      el.innerHTML = `<div class="dp-stats" style="margin-bottom:12px">
          <div class="dp-stat"><b>${mine.filter((x) => x.injury.il).length}</b><span>Your injured list</span></div>
          <div class="dp-stat"><b>${mine.filter((x) => !x.injury.il).length}</b><span>Your day-to-day</span></div>
          <div class="dp-stat"><b>${il.length}</b><span>League injured list</span></div>
          <div class="dp-stat"><b>${all.filter((x) => x.injury.type === 'season').length}</b><span>Out for the season</span></div>
        </div>
        <div class="dp-tabs"><button data-a="scope" data-v="all" class="${scope === 'all' ? 'sel' : ''}">All teams</button><button data-a="scope" data-v="mine" class="${scope === 'mine' ? 'sel' : ''}">Your team</button></div>
        <div class="fr-card" style="padding:6px 8px"><div data-slot="table"></div></div>`;
      const tbl = UI().table({
        cols: [
          { key: 'team', label: 'Team', align: 'l', html: (r) => chip(r.team), val: (r) => (r.team.id === L.userTeamId ? ' ' : r.team.abbr) },
          { key: 'name', label: 'Player', align: 'l', html: (r) => UI().playerLink(r.player), val: (r) => r.player.last },
          { key: 'pos', label: 'Pos', align: 'l', html: (r) => esc(r.player.pos), val: (r) => r.player.pos },
          { key: 'desc', label: 'Injury', align: 'l', html: (r) => esc(r.injury.desc), val: (r) => r.injury.desc },
          { key: 'type', label: 'Status', align: 'l', html: (r) => `<span class="dp-pill ${r.injury.type === 'season' || r.injury.type === 'il60' ? 'red' : r.injury.il ? 'gold' : ''}">${esc(r.injury.label)}</span>`, val: (r) => r.injury.days },
          { key: 'days', label: 'Days', html: (r) => String(Math.max(0, r.injury.days)), val: (r) => r.injury.days },
          { key: 'ret', label: 'Back', align: 'l', html: (r) => esc(UI().fmt.date(D().returnDate(L, r.player)) || '-'), val: (r) => r.injury.days },
        ],
        rows: rows.map((r) => Object.assign({ _cls: r.team.id === L.userTeamId ? 'user' : '' }, r)),
        empty: scope === 'mine' ? 'Your team is healthy.' : 'Nobody is injured.',
      });
      place(el, '[data-slot="table"]', tbl);
      on(el, { scope: (b) => UI().go('injuries', { scope: b.dataset.v }, { replace: true }) });
    },
  });

  UI().register('history', {
    title: 'League history',
    render(el) {
      const L = UI().league();
      const hist = L.history.slice().reverse();
      if (!hist.length) {
        el.innerHTML = card('<p class="fr-muted" style="margin:0">League history starts after your first season: champions, award winners and your team’s finishes will be listed here.</p>');
        return;
      }
      const u = L.userTeamId;
      const titles = hist.filter((x) => x.champion === u).length;
      const apps = hist.filter((x) => x.seeds && x.seeds.some((s) => s.includes(u))).length;
      const wins = hist.reduce((s, x) => s + (x.user ? x.user.w : 0), 0);
      const losses = hist.reduce((s, x) => s + (x.user ? x.user.l : 0), 0);
      el.innerHTML = `<div class="dp-stats" style="margin-bottom:12px">
          <div class="dp-stat"><b>${hist.length}</b><span>Seasons</span></div>
          <div class="dp-stat"><b>${wins}-${losses}</b><span>Your record</span></div>
          <div class="dp-stat"><b>${apps}</b><span>Postseason trips</span></div>
          <div class="dp-stat"><b>${titles}</b><span>Championships</span></div>
        </div>
        <div class="fr-card" style="padding:6px 8px"><div data-slot="table"></div></div>
        <p class="fr-muted">Tap a season to see its awards.</p>`;
      const aw = (x, lg, k) => (x.awards && x.awards.leagues[lg] && x.awards.leagues[lg][k]) || null;
      const name = (a) => (a ? `${who(L, a)} <span class="fr-muted">${esc(team(L, a.teamId) ? team(L, a.teamId).abbr : '')}</span>` : '-');
      const tbl = UI().table({
        cols: [
          { key: 'year', label: 'Year', align: 'l', html: (x) => `<b>${x.year}</b>` },
          { key: 'champion', label: 'Champion', align: 'l', html: (x) => chip(team(L, x.champion)) + (x.finalResult ? ` <span class="fr-muted">${esc(x.finalResult)}</span>` : ''), val: (x) => x.championName },
          { key: 'runnerUp', label: 'Runner-up', align: 'l', html: (x) => chip(team(L, x.runnerUp)), val: (x) => x.runnerUpName },
          { key: 'smvp', label: 'Series MVP', align: 'l', html: (x) => name(x.seriesMvp), sortable: false },
          { key: 'cmvp', label: 'Coast MVP', align: 'l', html: (x) => name(aw(x, 0, 'mvp')) },
          { key: 'ccy', label: 'Coast Cy Young', align: 'l', html: (x) => name(aw(x, 0, 'cy')) },
          { key: 'hmvp', label: 'Heartland MVP', align: 'l', html: (x) => name(aw(x, 1, 'mvp')) },
          { key: 'hcy', label: 'Heartland Cy Young', align: 'l', html: (x) => name(aw(x, 1, 'cy')) },
          { key: 'you', label: 'Your team', align: 'l', html: (x) => (x.user ? `${x.user.w}-${x.user.l} <span class="fr-muted">${esc(x.user.finish)}</span>` : '') },
        ],
        rows: hist.map((x) => Object.assign({ _cls: x.champion === u ? 'user' : '' }, x)),
        onRow: (x) => UI().go('awards', { year: x.year }),
        sortable: false,
      });
      place(el, '[data-slot="table"]', tbl);
    },
  });

  // ---------------------------------------------------------------------------
  // Phase-end screens (opened by Home when a phase finishes)
  // ---------------------------------------------------------------------------
  UI().register('phaseEnd_regular', {
    title: 'Regular season complete',
    render(el) {
      const L = UI().league();
      const done = L.phase === 'regular' && S().phaseDone(L);
      if (!done) {
        el.innerHTML = card(`<p style="margin:0">${L.phase === 'regular' ? 'The regular season isn’t over yet.' : 'The regular season is over.'}</p><div class="fr-row-btns"><button class="btn" data-go="home">Back to Home</button>${L.phase === 'postseason' ? '<button class="btn go" data-go="postseason">Postseason</button>' : ''}</div>`);
        return;
      }
      if (!(L.awards && L.awards.year === L.year)) D().computeAwards(L);
      const ut = S().userTeam(L);
      const seeds = PS().projected(L);
      const seed = seeds[ut.league].indexOf(ut.id);
      const g = ut.rec.w + ut.rec.l;
      let h = card(`<div class="dp-kicker">${L.year} regular season</div>
        <div class="dp-big">${esc(ut.city + ' ' + ut.name)} finish ${ut.rec.w}-${ut.rec.l}</div>
        <p style="margin:6px 0 0">${seed >= 0 ? `You’re in: the No. ${seed + 1} seed in the ${esc(BB.league.LEAGUES[ut.league])}${seed < 2 ? ', with a bye to the Division Series' : ', starting in the Wild Card Series'}.` : 'You missed the postseason this year.'} <span class="fr-muted">Run differential ${ut.rec.rs - ut.rec.ra > 0 ? '+' : ''}${ut.rec.rs - ut.rec.ra}, ${(ut.rec.w / Math.max(1, g)).toFixed(3).replace(/^0/, '')}.</span></p>
        <div class="fr-row-btns"><button class="btn go" data-a="start">Start the Postseason</button><button class="btn" data-go="standings">Final standings</button></div>`);
      h += `<div class="dp-head-row" style="margin:4px 0 8px"><span class="dp-kicker">The postseason field</span></div>` + projectedHTML(L);
      h += `<div class="dp-head-row" style="margin:4px 0 8px"><span class="dp-kicker">Season awards</span></div>` + awardsHTML(L, L.awards, false);
      el.innerHTML = h;
      on(el, {
        start: () => {
          S().advancePhase(L);
          UI().save();
          UI().go('postseason');
        },
      });
    },
  });

  UI().register('phaseEnd_postseason', {
    title: 'Champions',
    render(el) {
      const L = UI().league();
      const post = L.post;
      if (!post || !post.champion) {
        el.innerHTML = card(`<p style="margin:0">The postseason isn’t over yet.</p><div class="fr-row-btns"><button class="btn" data-go="postseason">Postseason</button></div>`);
        return;
      }
      const ch = team(L, post.champion);
      const ru = team(L, post.runnerUp);
      const fin = post.series.find((s) => s.key === 'final');
      const st = PS().userStatus(L);
      const you = post.champion === L.userTeamId;
      let h = `<div class="dp-champ" style="background:linear-gradient(135deg, ${esc(ch.color)} 0%, ${esc(ch.color2 || '#1d2433')} 140%)">
          <div class="dp-trophy" aria-hidden="true">&#127942;</div>
          <div class="dp-kicker">${L.year} Diamond Series champions</div>
          <h2>${esc(ch.city + ' ' + ch.name)}</h2>
          <p>Beat the ${esc(ru.city + ' ' + ru.name)} ${fin.wins[ch.id]}-${fin.wins[ru.id]}${post.mvp ? ` · Series MVP ${esc(post.mvp.name)}` : ''}</p>
          ${you ? '<p><span class="dp-pill">That’s your team. What a season!</span></p>' : ''}
        </div>`;
      h += card(`<div class="dp-continue"><p>${esc(st.text)}${post.mvp ? ` Diamond Series MVP: ${esc(post.mvp.name)} (${esc(team(L, post.mvp.teamId).abbr)}), ${esc(post.mvp.line)}.` : ''}</p><button class="btn go" data-a="next">On to the Offseason</button></div>`);
      h += bracketHTML(L, post);
      el.innerHTML = h;
      on(el, {
        next: () => {
          if (L.phase === 'postseason') S().advancePhase(L);
          UI().save();
          UI().go('offseason');
        },
      });
    },
  });

  BB.depthUI = { esc, team, chip, money, who, warBadge, delta, on, place, card, isToday, gameCard, gameHandlers, seriesCard, bracketHTML, awardsHTML, specialAwards, isP };
})(typeof window !== 'undefined' ? window : globalThis);
