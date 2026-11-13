// Box score modal (UI agent): line score, batting and pitching lines for both
// teams, decisions and play-by-play. BB.ui.openBox(gid).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined' || !BB.ui) return;
  const ui = BB.ui;
  const esc = ui.esc;
  const fmt = ui.fmt;
  const S = () => BB.season;
  const C = () => ui.core;

  function teamInfo(L, id) {
    const t = S().team(L, id);
    return t ? { abbr: t.abbr, name: t.city + ' ' + t.name, color: t.color, t } : { abbr: id, name: id, color: '#8d99ae', t: null };
  }

  function nameCell(L, line, extra) {
    const p = line.pid && L.players[line.pid];
    return (p ? ui.playerLink(p, line.name || p.name) : esc(line.name || '?')) + (extra || '');
  }

  function batTable(L, side, lines) {
    const tot = { ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, sb: 0 };
    const rows = lines
      .map((b, i) => {
        for (const k in tot) tot[k] += b[k] || 0;
        return `<tr><td class="l"><span class="fr-bo">${i + 1}</span>${nameCell(L, b)} <span class="fr-muted">${esc(b.pos || '')}</span></td><td>${b.ab}</td><td>${b.r}</td><td>${b.h}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.k}</td><td>${b.hr}</td></tr>`;
      })
      .join('');
    const notes = [];
    const list = (key, label) => {
      const who = lines.filter((b) => b[key] > 0).map((b) => esc(b.name) + (b[key] > 1 ? ' ' + b[key] : ''));
      if (who.length) notes.push(`<b>${label}:</b> ${who.join(', ')}`);
    };
    list('d', '2B');
    list('t', '3B');
    list('hr', 'HR');
    list('sb', 'SB');
    list('cs', 'CS');
    return `<div class="fr-box-side"><h4><span class="fr-box-chip" style="background:${esc(side.color)}"></span>${esc(side.name)}</h4>
      <div class="fr-table-wrap"><table class="fr-table fr-boxt"><thead><tr><th class="l">Batting</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>HR</th></tr></thead>
      <tbody>${rows}<tr class="tot"><td class="l">Totals</td><td>${tot.ab}</td><td>${tot.r}</td><td>${tot.h}</td><td>${tot.rbi}</td><td>${tot.bb}</td><td>${tot.k}</td><td>${tot.hr}</td></tr></tbody></table></div>
      ${notes.length ? `<p class="fr-box-notes">${notes.join(' · ')}</p>` : ''}</div>`;
  }

  function pitTable(L, side, lines) {
    const rows = lines
      .map((p) => `<tr><td class="l">${nameCell(L, p, p.dec ? ` <span class="fr-dec-tag d-${esc(p.dec)}">${esc(p.dec)}</span>` : '')}</td><td>${fmt.ip(p.outs)}</td><td>${p.h}</td><td>${p.r}</td><td>${p.er}</td><td>${p.bb}</td><td>${p.k}</td><td>${p.hr}</td><td>${p.pitches}</td></tr>`)
      .join('');
    return `<div class="fr-box-side"><div class="fr-table-wrap"><table class="fr-table fr-boxt"><thead><tr><th class="l">${esc(side.abbr)} pitching</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>HR</th><th>P</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function decisionLine(L, gm, box) {
    const bucket = gm.type === 'post' ? 'post' : gm.type === 'spring' ? 'spring' : 'reg';
    const out = [];
    const one = (pid, label, fn) => {
      const p = pid && L.players[pid];
      if (p) out.push(`<span><b>${label}</b> ${ui.playerLink(p)} <span class="fr-muted">(${fn(p.stats[bucket].pit)})</span></span>`);
    };
    one(box.wp || gm.wp, 'W', (s) => `${s.w}-${s.l}`);
    one(box.lp || gm.lp, 'L', (s) => `${s.w}-${s.l}`);
    one(box.sv || gm.sv, 'S', (s) => `${s.sv}`);
    return out.length ? `<div class="fr-box-dec">${out.join('')}</div>` : '';
  }

  function playByPlay(log) {
    if (!log || !log.length) return '';
    const groups = [];
    let cur = null;
    for (const line of log) {
      const m = /^([TB])(\d+): (.*)$/.exec(line);
      const key = m ? m[1] + m[2] : '';
      if (!cur || cur.key !== key) {
        cur = { key, title: m ? `${m[1] === 'T' ? 'Top' : 'Bottom'} ${BB.U.ordinal(+m[2])}` : '', lines: [] };
        groups.push(cur);
      }
      cur.lines.push(m ? m[3] : line);
    }
    return `<details class="fr-pbp"><summary>Play-by-play</summary>${groups
      .map((g) => `<div class="fr-pbp-half">${g.title ? `<h5>${esc(g.title)}</h5>` : ''}<ul>${g.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`)
      .join('')}</details>`;
  }

  function openBox(gid) {
    const L = ui.league();
    const gm = L && L.games[gid];
    if (!gm) {
      ui.toast('That game is no longer on record.');
      return null;
    }
    const a = teamInfo(L, gm.away);
    const h = teamInfo(L, gm.home);
    const final = gm.status === 'final' && gm.score;
    const title = final ? `${a.abbr} ${gm.score[0]}, ${h.abbr} ${gm.score[1]}` : `${a.abbr} @ ${h.abbr}`;
    const box = gm.box;
    const lab = C().gameLabel(gm) || C().TYPE_NAMES[gm.type] || '';
    let body = `<div class="fr-box-meta"><span>${esc(fmt.dateLong(gm.date))}</span>${lab ? `<span>${esc(lab)}</span>` : ''}${h.t ? `<span>at ${esc(h.t.city)}</span>` : ''}<span>${final ? `Final${gm.innings > 9 ? ' / ' + gm.innings : ''}` : 'Scheduled'}</span></div>`;
    if (final && box) {
      const n = Math.max(9, box.line[0].length, box.line[1].length);
      let ls = '<div class="fr-table-wrap"><table class="fr-table fr-line"><thead><tr><th class="l"></th>';
      for (let i = 1; i <= n; i++) ls += `<th>${i}</th>`;
      ls += '<th class="tot">R</th><th class="tot">H</th></tr></thead><tbody>';
      [a, h].forEach((s, i) => {
        const win = box.score[i] > box.score[1 - i];
        ls += `<tr class="${win ? 'win' : ''}"><td class="l">${s.t ? ui.teamChip(s.t) : esc(s.abbr)}</td>`;
        for (let k = 0; k < n; k++) {
          const v = box.line[i][k];
          ls += `<td>${v === undefined ? '' : esc(v)}</td>`;
        }
        ls += `<td class="tot">${box.score[i]}</td><td class="tot">${box.hits[i]}</td></tr>`;
      });
      ls += '</tbody></table></div>';
      body += ls + decisionLine(L, gm, box);
      body += `<div class="fr-box-grid">${batTable(L, a, box.bat[0])}${batTable(L, h, box.bat[1])}</div>`;
      body += `<div class="fr-box-grid">${pitTable(L, a, box.pit[0])}${pitTable(L, h, box.pit[1])}</div>`;
      body += playByPlay(box.log);
    } else if (final) {
      body += `<div class="fr-box-score"><div>${a.t ? ui.teamChip(a.t, { full: true }) : esc(a.name)}<b>${gm.score[0]}</b></div><div>${h.t ? ui.teamChip(h.t, { full: true }) : esc(h.name)}<b>${gm.score[1]}</b></div></div>
        ${decisionLine(L, gm, {})}<p class="fr-muted">The full box score is no longer stored. Box scores are kept for your games and the last few days around the league.</p>`;
    } else {
      body += `<p class="fr-muted">This game hasn't been played yet.</p>`;
    }
    const m = C().wireModal(ui.modal({ title, wide: true, body: `<div class="fr-box">${body}</div>` }));
    m.root.querySelector('.fr-modal').classList.add('fr-box-modal');
    return m;
  }

  ui.openBox = openBox;
})(typeof window !== 'undefined' ? window : globalThis);
