// Offseason screens: the step hub, re-signing, the draft room, free agency,
// the trade builder, spring cuts and the spring phase-end screen (Opening
// Day roster). Owned by the depth agent. Uses BB.depthUI helpers from
// screens-season.js.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined') return;
  const UI = () => BB.ui;
  const S = () => BB.season;
  const D = () => BB.depth;
  const O = () => BB.offseason;
  const TR = () => BB.trades;
  const H = () => BB.depthUI;

  const esc = (s) => UI().esc(s);
  const team = (L, id) => L.teams.find((t) => t.id === id) || null;
  const chip = (t, o) => (t ? UI().teamChip(t, o) : '');
  const money = (m) => UI().fmt.money(m);
  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  const card = (h, c) => `<div class="fr-card${c ? ' ' + c : ''}">${h}</div>`;
  const rating = (v) => UI().rating(v);
  const POS_ORDER = { SP: 0, RP: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9, DH: 10 };
  const byPos = (a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ovr - a.ovr;
  const POS_GROUPS = {
    all: () => true,
    C: (p) => p.pos === 'C',
    IF: (p) => ['1B', '2B', '3B', 'SS'].includes(p.pos),
    OF: (p) => ['LF', 'CF', 'RF', 'DH'].includes(p.pos),
    SP: (p) => p.pos === 'SP',
    RP: (p) => p.pos === 'RP',
  };
  const GROUP_LABEL = { all: 'All', C: 'C', IF: 'Infield', OF: 'Outfield/DH', SP: 'SP', RP: 'RP' };

  function done(L, msg) {
    UI().save();
    if (msg) UI().toast(msg);
    UI().refresh();
  }

  function statusTag(p) {
    if (p.injury && p.injury.il) return `<span class="dp-pill red">${esc(p.injury.label)}</span>`;
    if (p.injury) return '<span class="dp-pill red">Day-to-day</span>';
    if (p.status === 'prospect') return '<span class="dp-pill">Prospect</span>';
    if (p.status === 'reserve') return '<span class="dp-pill">Reserve</span>';
    return '';
  }

  // ---------------------------------------------------------------------------
  // Offseason hub
  // ---------------------------------------------------------------------------
  function stepper(L) {
    const info = O().stepInfo(L);
    return `<div class="dp-steps">${info.steps
      .map((s, i) => `<div class="dp-step${i < info.index ? ' done' : i === info.index ? ' cur' : ''}"><i>${i < info.index ? '&#10003;' : i + 1}</i>${esc(s.label)}</div>`)
      .join('')}</div>`;
  }

  function recapHTML(L) {
    const last = L.history.find((x) => x.year === L.year) || L.history[L.history.length - 1];
    if (!last) return card('<p class="fr-muted" style="margin:0">No season to recap.</p>');
    const ch = team(L, last.champion);
    let h = '';
    if (ch) {
      h += `<div class="dp-champ" style="background:linear-gradient(135deg, ${esc(ch.color)} 0%, ${esc(ch.color2 || '#1d2433')} 140%);padding:18px 16px">
        <div class="dp-kicker">${last.year} champions</div><h2 style="font-size:34px">${esc(ch.city + ' ' + ch.name)}</h2>
        <p>${last.finalResult ? `Won the Diamond Series ${esc(last.finalResult)} over the ${esc(last.runnerUpName)}` : ''}${last.seriesMvp ? ` · MVP ${esc(last.seriesMvp.name)}` : ''}</p></div>`;
    }
    if (last.user) h += card(`<div class="dp-kicker">Your season</div><div class="dp-big">${last.user.w}-${last.user.l}</div><p class="fr-muted" style="margin:4px 0 0">${esc(last.user.finish)}</p>`);
    if (last.awards) h += H().awardsHTML(L, last.awards, false);
    return h;
  }

  function retireHTML(L) {
    const rows = L.off.retired || [];
    const list = rows.slice(0, 40);
    return card(
      `<div class="dp-head-row"><h3>Retirements</h3><span class="fr-muted">${rows.length} players retire</span></div>
      <div class="fr-table-wrap"><table class="fr-table"><thead><tr><th class="l">Player</th><th class="l">Pos</th><th class="r">Age</th><th class="l">Team</th><th class="r">OVR</th><th class="l">Career</th></tr></thead><tbody>
      ${list.map((r) => `<tr class="${r.teamId === L.userTeamId ? 'user' : ''}"><td class="l"><b>${esc(r.name)}</b></td><td class="l">${esc(r.pos)}</td><td class="r">${r.age}</td><td class="l">${chip(team(L, r.teamId)) || '<span class="fr-muted">FA</span>'}</td><td class="r">${rating(r.ovr)}</td><td class="l fr-muted">${esc(r.line)}</td></tr>`).join('') || '<tr><td class="l empty" colspan="6">Nobody retired.</td></tr>'}
      </tbody></table></div>${rows.length > list.length ? `<p class="fr-muted">…and ${rows.length - list.length} more.</p>` : ''}`,
    );
  }

  function progressHTML(L) {
    const pr = L.off.progress;
    if (!pr) return '';
    const row = (r) => `<tr><td class="l">${L.players[r.pid] ? UI().playerLink(L.players[r.pid]) : esc(r.name)}</td><td class="l">${esc(r.pos)}</td><td class="r">${r.age}</td><td class="r">${r.before} → ${rating(r.after)}</td><td class="r">${H().delta(r.delta)}</td><td class="r">${r.pot}</td></tr>`;
    const head = '<thead><tr><th class="l">Player</th><th class="l">Pos</th><th class="r">Age</th><th class="r">OVR</th><th class="r">+/-</th><th class="r">POT</th></tr></thead>';
    const up = pr.rows.filter((r) => r.delta > 0).slice(0, 8);
    const down = pr.rows.filter((r) => r.delta < 0).reverse().slice(0, 8);
    const lg = pr.league.filter((r) => r.teamId !== L.userTeamId).slice(0, 8);
    return `<div class="fr-grid">
      ${card(`<h3>Your risers</h3><div class="fr-table-wrap"><table class="fr-table">${head}<tbody>${up.map(row).join('') || '<tr><td class="l empty" colspan="6">No one improved.</td></tr>'}</tbody></table></div>`)}
      ${card(`<h3>Your fallers</h3><div class="fr-table-wrap"><table class="fr-table">${head}<tbody>${down.map(row).join('') || '<tr><td class="l empty" colspan="6">No one declined.</td></tr>'}</tbody></table></div>`)}
      </div>
      ${card(`<h3>Around the league: young risers</h3><div class="fr-table-wrap"><table class="fr-table"><thead><tr><th class="l">Player</th><th class="l">Team</th><th class="l">Pos</th><th class="r">Age</th><th class="r">OVR</th><th class="r">+/-</th></tr></thead><tbody>${lg.map((r) => `<tr><td class="l">${L.players[r.pid] ? UI().playerLink(L.players[r.pid]) : esc(r.name)}</td><td class="l">${chip(team(L, r.teamId))}</td><td class="l">${esc(r.pos)}</td><td class="r">${r.age}</td><td class="r">${r.before} → ${rating(r.after)}</td><td class="r">${H().delta(r.delta)}</td></tr>`).join('')}</tbody></table></div><p class="fr-muted" style="margin:6px 0 0">Young players grow toward their potential, veterans decline after about 31, and a season that beat (or missed) what the ratings predicted nudges them.</p>`)}`;
  }

  function resignSummary(L) {
    const r = L.off.resign;
    const t = S().userTeam(L);
    const n = r ? r.list.length : 0;
    const sign = r ? r.list.filter((e) => e.decision === 'sign').length : 0;
    return card(`<div class="dp-head-row"><h3>Expiring contracts</h3><button class="btn go sm" data-go="resign">Review contracts</button></div>
      <p style="margin:6px 0">${n ? `${n} of your players have expiring contracts. Re-signing ${sign}, letting ${n - sign} go.` : 'None of your players have expiring contracts.'}</p>
      <div class="dp-stats"><div class="dp-stat${O().resignPayroll(L) > t.budget ? ' over' : ''}"><b>${money(O().resignPayroll(L))}</b><span>Projected payroll</span></div><div class="dp-stat"><b>${money(t.budget)}</b><span>Budget</span></div></div>
      <p class="fr-muted" style="margin:8px 0 0">Young players (24 and under) are under team control and renew automatically. Anyone you don’t re-sign becomes a free agent.</p>`);
  }

  function draftSummary(L) {
    const d = L.draft;
    const clock = O().onClock(L);
    const mine = d.picks.filter((x) => x.teamId === L.userTeamId);
    return card(`<div class="dp-head-row"><h3>${d.year} Draft</h3><button class="btn go sm" data-go="draft">Go to the draft room</button></div>
      <p style="margin:6px 0">${d.done ? 'The draft is complete.' : `Pick ${d.cur + 1} of ${d.order.length * d.rounds}. On the clock: ${chip(team(L, clock))}${clock === L.userTeamId ? ' <b>(you)</b>' : ''}.`}</p>
      <p class="fr-muted" style="margin:0">Your picks so far: ${mine.length ? mine.map((x) => `${esc(x.name)} (${esc(x.pos)})`).join(', ') : 'none yet'}.</p>`);
  }

  function faSummary(L) {
    const fa = L.off.fa;
    const t = S().userTeam(L);
    const log = fa.log.slice(-12).reverse();
    return card(`<div class="dp-head-row"><h3>Free agency · round ${fa.round} of ${fa.rounds}</h3><button class="btn go sm" data-go="freeAgency">Free agents</button></div>
      <p style="margin:6px 0">${L.freeAgents.length} players available. Make offers any time; each Continue runs a round of bidding by the other teams.</p>
      <div class="dp-stats"><div class="dp-stat"><b>${money(O().orgPayroll(L, t))}</b><span>Your payroll</span></div><div class="dp-stat"><b>${money(t.budget)}</b><span>Budget</span></div><div class="dp-stat"><b>${t.roster.length + t.reserves.length}/40</b><span>Organization</span></div></div>
      ${log.length ? `<h4>Recent signings</h4><div class="fr-table-wrap"><table class="fr-table"><tbody>${log.map((x) => `<tr class="${x.teamId === L.userTeamId ? 'user' : ''}"><td class="l">${chip(team(L, x.teamId))}</td><td class="l">${L.players[x.pid] ? UI().playerLink(L.players[x.pid]) : esc(x.name)}</td><td class="l">${esc(x.pos)}</td><td class="r">${rating(x.ovr)}</td><td class="r">${x.years} yr, ${money(x.salary)}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
  }

  function doneSummary(L) {
    const ut = S().userTeam(L);
    const signed = L.off.fa ? L.off.fa.log.filter((x) => x.teamId === ut.id).length : 0;
    const picks = L.draft ? L.draft.picks.filter((x) => x.teamId === ut.id).length : 0;
    return card(`<h3>Ready for spring training</h3><p style="margin:6px 0">${esc(ut.city + ' ' + ut.name)}: ${ut.roster.length} active, ${ut.reserves.length} in reserve. You drafted ${picks} and signed ${signed} free agent${signed === 1 ? '' : 's'} this winter.</p>
      <p class="fr-muted" style="margin:0">Spring training is about 15 exhibition games. Young players can break out; at the end you set your 26-man Opening Day roster.</p>`);
  }

  UI().register('offseason', {
    title: 'Offseason',
    render(el) {
      const L = UI().league();
      const links = `<div class="fr-row-btns"><button class="btn sm" data-go="trade">Trades</button><button class="btn sm" data-go="freeAgency">Free agents</button><button class="btn sm" data-go="history">League history</button><button class="btn sm" data-go="awards">Awards</button></div>`;
      if (L.phase !== 'offseason') {
        el.innerHTML = card(`<p style="margin:0">The offseason starts after the postseason: retirements, player development, contracts, the draft and free agency.</p>${links}`);
        return;
      }
      const step = L.offStep;
      let body = '';
      if (step === 'recap') body = recapHTML(L);
      else if (step === 'retire') body = retireHTML(L);
      else if (step === 'progress') body = progressHTML(L);
      else if (step === 'resign') body = resignSummary(L);
      else if (step === 'draft') body = draftSummary(L);
      else if (step === 'freeagency') body = faSummary(L);
      else if (step === 'done') body = doneSummary(L);
      const NEXT_TEXT = {
        recap: ['Next: retirements around the league.', 'Continue'],
        retire: ['Next: player development (everyone ages a year).', 'Continue'],
        progress: ['Next: contracts expire and you decide who to keep.', 'Continue to contracts'],
        resign: ['Your decisions are applied; unsigned players become free agents.', 'Confirm contracts'],
        draft: [L.draft && !L.draft.done ? 'Any picks you haven’t made are made for you.' : 'The draft is complete.', 'Finish the draft'],
        freeagency: L.off.fa && L.off.fa.round < L.off.fa.rounds ? [`Other teams bid on free agents (round ${L.off.fa.round + 1} of ${L.off.fa.rounds}).`, `Run round ${L.off.fa.round + 1}`] : ['Free agency wraps up; rosters are filled out.', 'Finish free agency'],
        done: ['The next step is spring training.', 'Start spring training'],
      }[step] || ['', 'Continue'];
      el.innerHTML = `${stepper(L)}
        <div class="fr-card dp-continue"><p>${esc(NEXT_TEXT[0])}</p><button class="btn go" data-a="next">${esc(NEXT_TEXT[1])}</button></div>
        ${body}${links}`;
      H().on(el, {
        next: async () => {
          if (step === 'done') {
            S().advancePhase(L);
            UI().save();
            UI().go('home');
            return;
          }
          if (step === 'draft' && L.draft && !L.draft.done) {
            const left = L.draft.order.length * L.draft.rounds - L.draft.cur;
            const mine = Math.ceil(left / L.draft.order.length);
            if (!(await UI().confirm(`Finish the draft? About ${mine} of your picks are left; they’ll be made for you.`, 'Finish the draft'))) return;
          }
          O().advance(L);
          done(L);
        },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Re-sign
  // ---------------------------------------------------------------------------
  UI().register('resign', {
    title: 'Re-sign players',
    render(el) {
      const L = UI().league();
      if (L.phase !== 'offseason' || L.offStep !== 'resign' || !L.off.resign) {
        el.innerHTML = card(`<p style="margin:0">Contracts are handled in the offseason, after player development.</p><div class="fr-row-btns"><button class="btn" data-go="offseason">Offseason</button></div>`);
        return;
      }
      const t = S().userTeam(L);
      const r = L.off.resign;
      const pay = O().resignPayroll(L);
      el.innerHTML = `<p class="dp-sub">Each player asks for a contract. Re-sign him at that price or let him go to free agency.</p>
        <div class="dp-stats" style="margin-bottom:12px"><div class="dp-stat${pay > t.budget ? ' over' : ''}"><b>${money(pay)}</b><span>Projected payroll</span></div><div class="dp-stat"><b>${money(t.budget)}</b><span>Budget</span></div><div class="dp-stat"><b>${r.list.filter((e) => e.decision === 'sign').length}/${r.list.length}</b><span>Re-signing</span></div></div>
        <div class="fr-card" style="padding:6px 8px"><div data-slot="t"></div></div>
        <div class="fr-row-btns"><button class="btn go" data-go="offseason">Done</button><button class="btn" data-a="all">Re-sign the suggested players</button></div>`;
      const rows = r.list.map((e) => Object.assign({ e, p: L.players[e.pid] })).filter((x) => x.p);
      const tbl = UI().table({
        cols: [
          { key: 'name', label: 'Player', align: 'l', html: (x) => UI().playerLink(x.p), val: (x) => x.p.last },
          {
            key: 'dec', label: 'Decision', align: 'l',
            html: (x) => `<span class="dp-toggle"><button class="${x.e.decision === 'sign' ? 'on sign' : ''}" data-a="sign" data-who="${esc(x.p.id)}">Re-sign</button><button class="${x.e.decision !== 'sign' ? 'on rel' : ''}" data-a="rel" data-who="${esc(x.p.id)}">Let go</button></span>`,
            val: (x) => (x.e.decision === 'sign' ? 1 : 0),
          },
          { key: 'pos', label: 'Pos', align: 'l', html: (x) => esc(x.p.pos), val: (x) => x.p.pos },
          { key: 'age', label: 'Age', html: (x) => String(x.p.age), val: (x) => x.p.age },
          { key: 'ovr', label: 'OVR', html: (x) => rating(x.p.ovr), val: (x) => x.p.ovr },
          { key: 'pot', label: 'POT', html: (x) => String(x.p.pot), val: (x) => x.p.pot },
          { key: 'war', label: 'WAR', title: 'Last season', html: (x) => (L.off.war[x.p.id] != null ? L.off.war[x.p.id].toFixed(1) : '-'), val: (x) => L.off.war[x.p.id] || 0 },
          { key: 'old', label: 'Was', html: (x) => money(x.e.old), val: (x) => x.e.old },
          { key: 'ask', label: 'Asking', html: (x) => `<b>${money(x.e.ask.salary)}</b> × ${x.e.ask.years}`, val: (x) => x.e.ask.salary },
        ],
        rows,
        empty: 'No expiring contracts this winter.',
      });
      H().place(el, '[data-slot="t"]', tbl);
      const set = (pid, d) => {
        const res = O().setResign(L, pid, d);
        if (!res.ok) UI().toast(res.reason);
        done(L);
      };
      H().on(el, {
        sign: (b) => set(b.dataset.who, 'sign'),
        rel: (b) => set(b.dataset.who, 'release'),
        all: () => {
          for (const e of r.list) {
            const p = L.players[e.pid];
            if (p) O().setResign(L, e.pid, O().suggestResign(L, t, p, e.ask));
          }
          done(L, 'Suggestions applied.');
        },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Draft room
  // ---------------------------------------------------------------------------
  const rangeBar = (r, cls) => {
    const a = Math.max(0, (r[0] - 20) / 79);
    const b = Math.min(1, (r[1] - 20) / 79);
    return `<span class="dp-range${cls ? ' ' + cls : ''}"><i style="left:${(a * 100).toFixed(1)}%;width:${((b - a) * 100).toFixed(1)}%"></i></span>${r[0]}–${r[1]}`;
  };
  const draftView = { group: 'all' };

  UI().register('draft', {
    title: (p) => 'Draft',
    render(el) {
      const L = UI().league();
      const d = L.draft;
      if (!d) {
        el.innerHTML = card(`<p style="margin:0">The draft is held in the offseason, after contracts: ${O().DRAFT_ROUNDS} rounds, worst record picks first.</p><div class="fr-row-btns"><button class="btn" data-go="offseason">Offseason</button></div>`);
        return;
      }
      const open = L.phase === 'offseason' && L.offStep === 'draft' && !d.done;
      const clock = O().onClock(L);
      const mine = open && clock === L.userTeamId;
      const n = d.order.length;
      let h = '';
      if (open) {
        h += card(`<div class="dp-clock"><div class="dp-big">Round ${Math.floor(d.cur / n) + 1}, pick ${(d.cur % n) + 1} <span class="fr-muted" style="font-size:16px">(#${d.cur + 1} overall)</span></div>
          <div>On the clock: ${chip(team(L, clock), { full: true })}${mine ? ' <span class="dp-pill gold">You</span>' : ''}</div></div>
          <div class="fr-row-btns">${mine ? '<button class="btn" data-a="auto">Auto-pick for me</button>' : '<button class="btn go" data-a="tome">Sim to my pick</button>'}<button class="btn" data-a="rest">Auto-draft the rest</button></div>
          <p class="fr-muted" style="margin:8px 0 0">Ratings are scouting ranges: the true numbers are somewhere in there. Younger players are harder to read.</p>`, mine ? 'dp-clock me' : '');
      } else {
        h += card(`<p style="margin:0">${d.done ? `The ${d.year} draft is complete.` : 'The draft room opens after contracts are settled.'}</p>${L.phase === 'offseason' ? '<div class="fr-row-btns"><button class="btn" data-go="offseason">Offseason</button></div>' : ''}`);
      }
      const minePicks = d.picks.filter((x) => x.teamId === L.userTeamId);
      const recent = d.picks.slice(-14).reverse();
      const pickRow = (x) => `<div class="dp-pickrow${x.teamId === L.userTeamId ? ' me' : ''}"><b>${x.n}</b>${chip(team(L, x.teamId))}<span>${esc(x.name)}</span><span class="fr-muted">${esc(x.pos)}, ${x.age}</span></div>`;
      h += `<div class="dp-draft-grid"><div>`;
      if (open) {
        h += `<div class="dp-tabs">${Object.keys(POS_GROUPS).map((g) => `<button data-a="grp" data-v="${g}" class="${draftView.group === g ? 'sel' : ''}">${GROUP_LABEL[g]}</button>`).join('')}</div>`;
        h += `<div class="fr-card" style="padding:6px 8px"><div data-slot="board"></div></div>`;
      } else {
        h += `<div class="fr-card" style="padding:6px 8px"><div data-slot="results"></div></div>`;
      }
      h += `</div><div>${card(`<h3>Your picks</h3>${minePicks.length ? minePicks.map(pickRow).join('') : '<p class="fr-muted" style="margin:0">None yet.</p>'}`)}${card(`<h3>Latest picks</h3><div class="dp-picks">${recent.length ? recent.map(pickRow).join('') : '<p class="fr-muted" style="margin:0">The draft hasn’t started.</p>'}</div>`)}</div></div>`;
      el.innerHTML = h;
      if (open) {
        const pool = d.pool
          .map((id) => L.players[id])
          .filter((p) => p && POS_GROUPS[draftView.group](p))
          .map((p) => ({ p, sc: d.scout[p.id] }))
          .sort((a, b) => b.sc.pot[0] + b.sc.pot[1] - (a.sc.pot[0] + a.sc.pot[1]));
        const tbl = UI().table({
          cols: [
            { key: 'name', label: 'Prospect', align: 'l', html: (x) => `<b>${esc(x.p.name)}</b>`, val: (x) => x.p.last },
            { key: 'pos', label: 'Pos', align: 'l', html: (x) => esc(x.p.pos), val: (x) => x.p.pos },
            { key: 'age', label: 'Age', html: (x) => String(x.p.age), val: (x) => x.p.age },
            { key: 'ovr', label: 'OVR now', align: 'l', html: (x) => rangeBar(x.sc.ovr), val: (x) => x.sc.ovr[0] + x.sc.ovr[1] },
            { key: 'pot', label: 'Potential', align: 'l', html: (x) => rangeBar(x.sc.pot, 'pot'), val: (x) => x.sc.pot[0] + x.sc.pot[1] },
            { key: 'act', label: '', html: (x) => (mine ? `<button class="btn go xs" data-a="pick" data-who="${esc(x.p.id)}">Draft</button>` : ''), sortable: false },
          ],
          rows: pool.slice(0, 120),
          empty: 'No prospects in this group.',
        });
        H().place(el, '[data-slot="board"]', tbl);
      } else {
        const tbl = UI().table({
          cols: [
            { key: 'n', label: '#', html: (x) => String(x.n) },
            { key: 'round', label: 'Rd', html: (x) => String(x.round) },
            { key: 'team', label: 'Team', align: 'l', html: (x) => chip(team(L, x.teamId)), val: (x) => x.teamId },
            { key: 'name', label: 'Player', align: 'l', html: (x) => (L.players[x.pid] ? UI().playerLink(L.players[x.pid]) : esc(x.name)), val: (x) => x.name },
            { key: 'pos', label: 'Pos', align: 'l' },
            { key: 'age', label: 'Age' },
          ],
          rows: d.picks.map((x) => Object.assign({ _cls: x.teamId === L.userTeamId ? 'user' : '' }, x)),
          empty: 'No picks yet.',
        });
        H().place(el, '[data-slot="results"]', tbl);
      }
      H().on(el, {
        grp: (b) => {
          draftView.group = b.dataset.v;
          UI().refresh();
        },
        pick: (b) => {
          const p = L.players[b.dataset.who];
          const res = O().draftPick(L, b.dataset.who);
          if (!res.ok) return UI().toast(res.reason);
          O().simDraft(L, { untilUser: true });
          done(L, `You draft ${p.pos} ${p.name}.`);
        },
        auto: () => {
          O().autoPickUser(L);
          O().simDraft(L, { untilUser: true });
          done(L);
        },
        tome: () => {
          O().simDraft(L, { untilUser: true });
          done(L);
        },
        rest: async () => {
          if (!(await UI().confirm('Auto-draft the rest? Your remaining picks will be made for you.', 'Auto-draft'))) return;
          O().simDraft(L, { untilUser: false });
          done(L, 'The draft is complete.');
        },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Free agency
  // ---------------------------------------------------------------------------
  const faView = { group: 'all' };

  function faOpen(L) {
    if (L.phase === 'postseason') return { open: false, why: 'Free agents can’t sign during the postseason.' };
    if (L.phase === 'offseason' && L.offStep !== 'freeagency' && L.offStep !== 'done') return { open: false, why: 'Free agency opens after the draft. Players with expiring contracts join the pool then.' };
    return { open: true };
  }

  function offerModal(L, p) {
    const ask = O().asking(L, p);
    const t = S().userTeam(L);
    const room = Math.max(0, t.budget - O().orgPayroll(L, t));
    const body = document.createElement('div');
    body.innerHTML = `<p style="margin:0 0 6px">${esc(p.pos)} · age ${p.age} · OVR ${p.ovr} · POT ${p.pot}</p>
      <p class="fr-muted" style="margin:0">Asking: <b>${money(ask.salary)}</b> a year for ${ask.years} year${ask.years === 1 ? '' : 's'}. Winning teams and bigger markets get a small discount. You have ${money(room)} of budget room.</p>
      <div class="dp-form"><label>Salary ($M per year)<input type="number" min="0.75" step="0.1" value="${ask.salary}" data-f="salary"></label><label>Years<input type="number" min="1" max="6" step="1" value="${ask.years}" data-f="years"></label></div>
      <div class="dp-note" data-f="hint"></div>
      <div class="fr-row-btns"><button class="btn go" data-f="send">Make offer</button><button class="btn" data-f="cancel">Cancel</button></div>`;
    const m = UI().modal({ title: `Offer to ${p.name}`, body });
    const val = (k) => +body.querySelector(`[data-f="${k}"]`).value;
    const hint = () => {
      const s = val('salary');
      const y = Math.round(val('years'));
      const sc = O().offerScore(L, p, t, s, y);
      const el = body.querySelector('[data-f="hint"]');
      el.className = 'dp-note ' + (sc >= 1 ? 'good' : sc >= 0.9 ? 'warn' : 'bad');
      el.textContent = sc >= 1 ? 'He’d likely sign at this price.' : sc >= 0.9 ? 'Close. He wants a little more.' : 'Well short of what he wants.';
    };
    body.addEventListener('input', hint);
    hint();
    body.querySelector('[data-f="cancel"]').addEventListener('click', () => m.close());
    body.querySelector('[data-f="send"]').addEventListener('click', () => {
      const res = O().offer(L, p.id, { salary: val('salary'), years: val('years') });
      UI().toast(res.reason);
      if (res.accepted) {
        m.close();
        done(L);
      }
    });
  }

  UI().register('freeAgency', {
    title: 'Free agents',
    render(el) {
      const L = UI().league();
      const t = S().userTeam(L);
      const st = faOpen(L);
      const pay = O().orgPayroll(L, t);
      const org = t.roster.length + t.reserves.length;
      const inFA = L.phase === 'offseason' && L.offStep === 'freeagency' && L.off.fa;
      let h = `<div class="dp-stats" style="margin-bottom:12px"><div class="dp-stat"><b>${money(pay)}</b><span>Payroll (with reserves)</span></div><div class="dp-stat"><b>${money(Math.max(0, t.budget - pay))}</b><span>Budget room</span></div><div class="dp-stat${org >= 40 ? ' over' : ''}"><b>${org}/40</b><span>Organization</span></div>${inFA ? `<div class="dp-stat"><b>${L.off.fa.round}/${L.off.fa.rounds}</b><span>Bidding rounds run</span></div>` : ''}</div>`;
      if (!st.open) h += `<div class="dp-note warn">${esc(st.why)}</div>`;
      else if (L.phase === 'regular' || L.phase === 'spring') h += `<p class="dp-sub">Unsigned players are cheaper now. A signing joins your reserves when the active roster is full.</p>`;
      if (inFA) h += `<div class="fr-row-btns" style="margin:0 0 10px">${L.off.fa.round < L.off.fa.rounds ? `<button class="btn" data-a="round">Run bidding round ${L.off.fa.round + 1}</button>` : ''}<button class="btn" data-go="offseason">Offseason hub</button></div>`;
      h += `<div class="dp-tabs">${Object.keys(POS_GROUPS).map((g) => `<button data-a="grp" data-v="${g}" class="${faView.group === g ? 'sel' : ''}">${GROUP_LABEL[g]}</button>`).join('')}</div>`;
      h += `<div class="fr-card" style="padding:6px 8px"><div data-slot="t"></div></div>`;
      el.innerHTML = h;
      const rows = L.freeAgents
        .map((id) => L.players[id])
        .filter((p) => p && POS_GROUPS[faView.group](p))
        .map((p) => ({ p, ask: O().asking(L, p) }));
      const tbl = UI().table({
        cols: [
          { key: 'name', label: 'Player', align: 'l', html: (x) => UI().playerLink(x.p) + (x.p.injury ? ' <span class="dp-pill red">Injured</span>' : ''), val: (x) => x.p.last },
          { key: 'pos', label: 'Pos', align: 'l', html: (x) => esc(x.p.pos), val: (x) => x.p.pos },
          { key: 'age', label: 'Age', html: (x) => String(x.p.age), val: (x) => x.p.age },
          { key: 'ovr', label: 'OVR', html: (x) => rating(x.p.ovr), val: (x) => x.p.ovr },
          { key: 'pot', label: 'POT', html: (x) => String(x.p.pot), val: (x) => x.p.pot },
          { key: 'ask', label: 'Asking', html: (x) => `${money(x.ask.salary)} × ${x.ask.years}`, val: (x) => x.ask.salary },
          { key: 'act', label: '', html: (x) => (st.open ? `<button class="btn go xs" data-a="offer" data-who="${esc(x.p.id)}">Offer</button>` : ''), sortable: false },
        ],
        rows,
        sortKey: 'ovr',
        empty: 'No free agents in this group.',
      });
      H().place(el, '[data-slot="t"]', tbl);
      H().on(el, {
        grp: (b) => {
          faView.group = b.dataset.v;
          UI().refresh();
        },
        offer: (b) => offerModal(L, L.players[b.dataset.who]),
        round: () => {
          O().advance(L);
          done(L);
        },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Trade builder
  // ---------------------------------------------------------------------------
  const trade = { partner: null, give: new Set(), get: new Set(), key: null };

  UI().register('trade', {
    title: 'Trade',
    render(el, params) {
      const L = UI().league();
      const me = S().userTeam(L);
      const others = L.teams.filter((t) => t.id !== me.id).sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name));
      // Fresh state when arriving with new params.
      const key = JSON.stringify(params || {});
      if (trade.key !== key) {
        trade.key = key;
        trade.give = new Set();
        trade.get = new Set();
        const p = params && params.pid ? L.players[params.pid] : null;
        trade.partner = (params && params.teamId) || (p && p.teamId !== me.id ? p.teamId : null) || trade.partner || others[0].id;
        if (p && p.teamId === trade.partner) trade.get.add(p.id);
        if (p && p.teamId === me.id) trade.give.add(p.id);
      }
      const partner = team(L, trade.partner) || others[0];
      const win = TR().windowOpen(L);
      // Drop selections that are no longer valid.
      const owns = (t, id) => t.roster.includes(id) || t.reserves.includes(id) || t.il.includes(id);
      for (const id of Array.from(trade.give)) if (!owns(me, id)) trade.give.delete(id);
      for (const id of Array.from(trade.get)) if (!owns(partner, id)) trade.get.delete(id);
      el.innerHTML = `${win.open ? (win.deadline ? `<p class="dp-sub">Trade deadline: ${esc(UI().fmt.dateLong(win.deadline))}.</p>` : '') : `<div class="dp-note warn">${esc(win.reason)}</div>`}
        <div class="fr-card"><div class="dp-head-row"><label class="fr-muted">Trade with&nbsp;<select class="dp-select" data-f="partner">${others.map((t) => `<option value="${esc(t.id)}"${t.id === partner.id ? ' selected' : ''}>${esc(t.city + ' ' + t.name)} (${t.rec.w}-${t.rec.l})</option>`).join('')}</select></label>
        <span class="fr-muted">${esc(TR().mode(L, partner) === 'contend' ? 'Contending: they want help now' : TR().mode(L, partner) === 'rebuild' ? 'Rebuilding: they want young talent' : 'Middle of the pack')}</span></div></div>
        <div class="dp-trade">
          <div class="fr-card"><h3>You give</h3><div data-slot="mine"></div></div>
          <div class="fr-card"><h3>You get</h3><div data-slot="theirs"></div></div>
        </div>
        <div class="dp-eval" data-slot="eval"></div>`;
      const listHTML = (t, set, side) => {
        const groups = [
          ['Active roster', t.roster],
          ['Reserves', t.reserves],
          ['Injured list', t.il],
        ];
        let h = '<div class="dp-list">';
        for (const [label, ids] of groups) {
          if (!ids.length) continue;
          h += `<div class="dp-group">${label}</div>`;
          for (const p of ids.map((id) => L.players[id]).filter(Boolean).sort(byPos)) {
            const v = TR().value(L, p.id, side === 'give' ? partner.id : me.id);
            h += `<label class="dp-li${set.has(p.id) ? ' on' : ''}" data-nolink><input type="checkbox" data-side="${side}" value="${esc(p.id)}"${set.has(p.id) ? ' checked' : ''}><span class="nm">${esc(p.name)}<small>${esc(p.pos)}, ${p.age}</small></span>${rating(p.ovr)}<span class="meta">${money(p.contract.salary)}×${p.contract.years} · val ${Math.round(v)}</span></label>`;
          }
        }
        return h + '</div>';
      };
      el.querySelector('[data-slot="mine"]').innerHTML = listHTML(me, trade.give, 'give');
      el.querySelector('[data-slot="theirs"]').innerHTML = listHTML(partner, trade.get, 'get');
      const offer = () => ({ fromTeamId: me.id, toTeamId: partner.id, give: Array.from(trade.give), get: Array.from(trade.get) });
      const chips = (set) => Array.from(set).map((id) => L.players[id]).filter(Boolean).map((p) => `<span class="dp-chip">${esc(p.name)} <small class="fr-muted">${esc(p.pos)}</small><button data-a="rm" data-who="${esc(p.id)}" aria-label="Remove">&times;</button></span>`).join('') || '<span class="fr-muted">Nobody yet</span>';
      const renderEval = () => {
        const has = trade.give.size || trade.get.size;
        const ev = has ? TR().evaluate(L, offer()) : null;
        const pos = ev ? Math.max(3, Math.min(97, 50 + (ev.delta / Math.max(20, ev.lose || 20)) * 50)) : 50;
        el.querySelector('[data-slot="eval"]').innerHTML = `
          <div class="dp-head-row"><div><span class="dp-kicker">You give</span><div class="dp-chips">${chips(trade.give)}</div></div><div style="text-align:right"><span class="dp-kicker">You get</span><div class="dp-chips" style="justify-content:flex-end">${chips(trade.get)}</div></div></div>
          ${ev ? `<div class="dp-meter" title="Left: they want more. Right: they'd accept."><i style="left:${pos.toFixed(1)}%"></i></div>` : ''}
          <div class="dp-head-row"><div class="dp-verdict ${ev ? (ev.accept ? 'yes' : 'no') : ''}">${ev ? esc(ev.reason) : 'Pick players to trade.'}</div>
          <div class="fr-row-btns" style="margin:0">${ev && !ev.accept && win.open ? '<button class="btn sm" data-a="fix">What would it take?</button>' : ''}<button class="btn go" data-a="propose"${ev && ev.accept ? '' : ' disabled'}>Propose trade</button></div></div>`;
      };
      renderEval();
      el.querySelector('[data-f="partner"]').addEventListener('change', (e) => {
        trade.partner = e.target.value;
        trade.get = new Set();
        UI().refresh();
      });
      el.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-side]');
        if (!cb) return;
        const set = cb.dataset.side === 'give' ? trade.give : trade.get;
        if (cb.checked) set.add(cb.value);
        else set.delete(cb.value);
        cb.closest('.dp-li').classList.toggle('on', cb.checked);
        renderEval();
      });
      H().on(el, {
        rm: (b) => {
          trade.give.delete(b.dataset.who);
          trade.get.delete(b.dataset.who);
          const cb = el.querySelector(`input[value="${b.dataset.who}"]`);
          if (cb) {
            cb.checked = false;
            cb.closest('.dp-li').classList.remove('on');
          }
          renderEval();
        },
        fix: () => {
          const add = TR().balance(L, offer());
          if (!add) return UI().toast(`${partner.abbr} won’t do it with any one more player.`);
          trade.give.add(add);
          UI().toast(`Adding ${L.players[add].name} would get it done.`);
          UI().refresh();
        },
        propose: () => {
          const res = TR().execute(L, offer());
          if (!res.ok) return UI().toast(res.reason);
          trade.give = new Set();
          trade.get = new Set();
          done(L, 'Trade complete!');
        },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Spring cuts / Opening Day roster
  // ---------------------------------------------------------------------------
  const cuts = { key: null, sel: null };

  function springScreen(el, final) {
    const L = UI().league();
    const t = S().userTeam(L);
    if (L.phase !== 'spring') {
      el.innerHTML = card(`<p style="margin:0">You set your 26-man Opening Day roster at the end of spring training.</p><div class="fr-row-btns"><button class="btn" data-go="home">Home</button></div>`);
      return;
    }
    const key = L.year + ':' + t.id;
    if (cuts.key !== key || !cuts.sel) {
      cuts.key = key;
      cuts.sel = new Set((L.spring && L.spring.pick) || O().suggestRoster(L, t));
    }
    const org = t.roster.concat(t.reserves, t.il).map((id) => L.players[id]).filter(Boolean);
    for (const id of Array.from(cuts.sel)) if (!org.some((p) => p.id === id && !(p.injury && p.injury.il))) cuts.sel.delete(id);
    const springDone = S().phaseDone(L);
    const evs = (L.spring ? L.spring.events : []).filter((e) => e.teamId === t.id);
    const evOf = {};
    for (const e of evs) evOf[e.pid] = e;
    let h = '';
    if (evs.length) {
      h += card(`<h3>Camp report</h3>${evs.map((e) => `<div>${e.kind === 'breakout' ? '<span class="dp-pill green">Breakout</span>' : '<span class="dp-pill red">Slump</span>'} ${L.players[e.pid] ? UI().playerLink(L.players[e.pid]) : esc(e.name)} <span class="fr-muted">${esc(e.pos)}, ${e.age}: ${e.before} → ${e.after}</span></div>`).join('')}`);
    }
    h += `<p class="dp-sub">${final ? 'Spring training is over. ' : ''}Pick the 26 players who open the season: usually 13 pitchers (5 starters) and 13 position players with two catchers. Everyone else starts in the reserves.</p>
      <div class="fr-card"><div class="dp-head-row"><div class="dp-counters" data-slot="count"></div><div class="fr-row-btns" style="margin:0"><button class="btn sm" data-a="suggest">Use suggestion</button></div></div><div data-slot="errs"></div></div>
      <div class="fr-grid"><div class="fr-card"><h3>Pitchers</h3><div data-slot="P"></div></div><div class="fr-card"><h3>Position players</h3><div data-slot="H"></div></div></div>
      <div class="dp-sticky-bar"><div class="fr-row-btns" style="margin:0">${final || springDone ? '<button class="btn go" data-a="start">Set roster &amp; start the season</button>' : ''}<button class="btn${final || springDone ? '' : ' go'}" data-a="save">Save roster</button></div></div>`;
    el.innerHTML = h;
    const listHTML = (ps) => {
      let h2 = '<div class="dp-list" style="max-height:none">';
      for (const p of ps) {
        const il = !!(p.injury && p.injury.il);
        const ev = evOf[p.id];
        h2 += `<label class="dp-li${cuts.sel.has(p.id) ? ' on' : ''}${il ? ' dis' : ''}" data-nolink><input type="checkbox" value="${esc(p.id)}"${cuts.sel.has(p.id) ? ' checked' : ''}${il ? ' disabled' : ''}><span class="nm">${esc(p.name)}<small>${esc(p.pos)}, ${p.age}</small></span>${ev ? (ev.kind === 'breakout' ? '<span class="dp-pill green">&#9650;</span>' : '<span class="dp-pill red">&#9660;</span>') : ''}${statusTag(p)}${rating(p.ovr)}<span class="meta">POT ${p.pot}</span></label>`;
      }
      return h2 + '</div>';
    };
    el.querySelector('[data-slot="P"]').innerHTML = listHTML(org.filter(isP).sort(byPos));
    el.querySelector('[data-slot="H"]').innerHTML = listHTML(org.filter((p) => !isP(p)).sort(byPos));
    const update = () => {
      const ps = Array.from(cuts.sel).map((id) => L.players[id]).filter(Boolean);
      const pit = ps.filter(isP).length;
      const c = ps.filter((p) => p.pos === 'C').length;
      const sp = ps.filter((p) => p.pos === 'SP').length;
      const pill = (ok, txt) => `<span class="dp-pill ${ok ? 'ok' : 'no'}">${txt}</span>`;
      el.querySelector('[data-slot="count"]').innerHTML = pill(ps.length === 26, `${ps.length}/26 players`) + pill(pit >= 11 && pit <= 15, `${pit} pitchers`) + pill(sp >= 5, `${sp} starters`) + pill(ps.length - pit >= 11, `${ps.length - pit} position`) + pill(c >= 2, `${c} catchers`);
      const errs = O().validateRoster(L, t, Array.from(cuts.sel));
      el.querySelector('[data-slot="errs"]').innerHTML = errs.length ? `<div class="dp-note bad">${errs.map(esc).join('<br>')}</div>` : '<div class="dp-note good">Roster is legal.</div>';
      el.querySelectorAll('[data-a="save"],[data-a="start"]').forEach((b) => (b.disabled = errs.length > 0));
    };
    update();
    el.addEventListener('change', (e) => {
      const cb = e.target.closest('input[type="checkbox"]');
      if (!cb) return;
      if (cb.checked) cuts.sel.add(cb.value);
      else cuts.sel.delete(cb.value);
      cb.closest('.dp-li').classList.toggle('on', cb.checked);
      update();
    });
    H().on(el, {
      suggest: () => {
        cuts.sel = new Set(O().suggestRoster(L, t));
        UI().refresh();
      },
      save: () => {
        const res = O().setOpeningDay(L, Array.from(cuts.sel));
        if (!res.ok) return UI().toast(res.errors[0]);
        UI().save();
        UI().toast('Opening Day roster saved.');
      },
      start: () => {
        const res = O().setOpeningDay(L, Array.from(cuts.sel));
        if (!res.ok) return UI().toast(res.errors[0]);
        if (!S().phaseDone(L)) return UI().toast('Spring training isn’t over yet.');
        S().advancePhase(L);
        cuts.key = null;
        UI().save();
        UI().go('home');
      },
    });
  }

  UI().register('springCuts', { title: 'Opening Day roster', render: (el) => springScreen(el, false) });
  UI().register('phaseEnd_spring', { title: 'Spring training complete', render: (el) => springScreen(el, true) });
})(typeof window !== 'undefined' ? window : globalThis);
