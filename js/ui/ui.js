// Franchise UI framework: the #franchise page (header, tabs, content), a
// screen router, modals, toasts, a progress overlay for long sims, tables
// and formatting helpers. Screens live in the other js/ui/ files and register
// themselves with BB.ui.register (see ARCHITECTURE.md).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  if (typeof document === 'undefined') return; // Node: logic files only
  const S = () => BB.season;

  const screens = {};
  const TABS = ['Home', 'Schedule', 'Standings', 'Leaders', 'Team', 'League'];
  const state = { league: null, current: null, params: null, history: [], saveTimer: null, saving: false };
  let rootEl = null;
  let mainEl = null;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = {
    avg: (x) => (x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '')),
    pct: (x) => (x >= 1 ? '1.000' : x.toFixed(3).replace(/^0/, '')),
    era: (x) => (x >= 99 ? '-' : x.toFixed(2)),
    ip: (outs) => Math.floor(outs / 3) + '.' + (outs % 3),
    money: (m) => '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M',
    date: (iso) => {
      if (!iso) return '';
      const [, mo, d] = iso.split('-').map(Number);
      return MONTHS[mo - 1] + ' ' + d;
    },
    dateLong: (iso) => {
      if (!iso) return '';
      const [y, mo, d] = iso.split('-').map(Number);
      return MONTHS[mo - 1] + ' ' + d + ', ' + y;
    },
    gb: (x) => (x === 0 ? '-' : x % 1 ? x.toFixed(1) : String(x)),
    signed: (x) => (x > 0 ? '+' + x : String(x)),
  };

  function teamChip(team, opts) {
    if (!team) return '';
    const o = opts || {};
    const label = o.full ? esc(team.city + ' ' + team.name) : esc(team.abbr);
    return `<span class="fr-team" data-team="${esc(team.id)}"><i style="background:${esc(team.color)}"></i>${label}</span>`;
  }

  // In-season form (form.js): a hot or cold icon after the name, only for
  // players clearly hot or cold right now.
  const FORM_ICON = { hot: ['\u{1F525}', 'Hot streak'], cold: ['\u2744\uFE0F', 'Cold streak'] };
  function formStatus(p) {
    return BB.form && p ? BB.form.status(state.league, p) : null;
  }
  function formIcon(p) {
    const st = formStatus(p);
    if (!st) return '';
    return `<span class="fr-form ${st}" role="img" aria-label="${FORM_ICON[st][1]}" title="${FORM_ICON[st][1]}">${FORM_ICON[st][0]}</span>`;
  }
  // Plain-text version, for <option> labels.
  function formText(p) {
    const st = formStatus(p);
    return st ? ' ' + FORM_ICON[st][0] : '';
  }
  function playerLink(p, label) {
    if (!p) return '';
    return `<a class="fr-plink" data-pid="${esc(p.id)}" href="#">${esc(label || p.name)}</a>${formIcon(p)}`;
  }

  // Rating 20..99 as a colored number.
  function rating(v) {
    const cls = v >= 75 ? 'r-elite' : v >= 65 ? 'r-good' : v >= 52 ? 'r-avg' : 'r-low';
    return `<span class="fr-rating ${cls}">${v}</span>`;
  }

  // Sortable table. cols: [{ key, label, align: 'l'|'r', html(row), val(row), title }].
  // Returns an element.
  function table(opts) {
    const cols = opts.cols;
    let rows = opts.rows.slice();
    const wrap = document.createElement('div');
    wrap.className = 'fr-table-wrap' + (opts.className ? ' ' + opts.className : '');
    let sortKey = opts.sortKey || null;
    let sortDir = opts.sortDir || -1;
    const render = () => {
      if (sortKey) {
        const col = cols.find((c) => c.key === sortKey);
        const v = col && (col.val || ((r) => r[col.key]));
        rows.sort((a, b) => {
          const x = v(a);
          const y = v(b);
          if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sortDir;
          return ((x || 0) - (y || 0)) * sortDir;
        });
      }
      let h = '<table class="fr-table"><thead><tr>';
      for (const c of cols) {
        const sorted = c.key === sortKey ? (sortDir < 0 ? ' sorted-desc' : ' sorted-asc') : '';
        h += `<th class="${c.align === 'l' ? 'l' : 'r'}${opts.sortable !== false && c.key ? ' sortable' : ''}${sorted}" data-key="${esc(c.key || '')}"${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}</th>`;
      }
      h += '</tr></thead><tbody>';
      rows.forEach((r, i) => {
        h += `<tr data-i="${i}"${r._cls ? ` class="${esc(r._cls)}"` : ''}>`;
        for (const c of cols) h += `<td class="${c.align === 'l' ? 'l' : 'r'}">${c.html ? c.html(r, i) : esc(r[c.key])}</td>`;
        h += '</tr>';
      });
      if (!rows.length) h += `<tr><td class="l empty" colspan="${cols.length}">${esc(opts.empty || 'Nothing here yet.')}</td></tr>`;
      h += '</tbody></table>';
      wrap.innerHTML = h;
    };
    wrap.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th) {
        const k = th.dataset.key;
        sortDir = sortKey === k ? -sortDir : -1;
        sortKey = k;
        render();
        return;
      }
      const tr = e.target.closest('tbody tr[data-i]');
      if (tr && opts.onRow && !e.target.closest('a,button,[data-pid],[data-team],[data-gid]')) opts.onRow(rows[+tr.dataset.i]);
    });
    render();
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Root, header and tabs
  // ---------------------------------------------------------------------------
  function ensureRoot() {
    if (rootEl) return;
    rootEl = document.getElementById('franchise');
    rootEl.innerHTML = `
      <header class="fr-head">
        <button class="fr-menu" data-act="menu" aria-label="Main menu">&#9776;</button>
        <div class="fr-head-team" id="fr-head-team"></div>
        <div class="fr-head-date" id="fr-head-date"></div>
      </header>
      <nav class="fr-tabs" id="fr-tabs">${TABS.map((t) => `<button data-tab="${t}">${t}</button>`).join('')}</nav>
      <main class="fr-main" id="fr-main"></main>
      <div class="fr-toasts" id="fr-toasts"></div>`;
    mainEl = rootEl.querySelector('#fr-main');
    rootEl.addEventListener('click', onClick);
  }

  function onClick(e) {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) {
      const id = Object.keys(screens).find((k) => screens[k].tab === tab.dataset.tab);
      if (id) go(id);
      return;
    }
    const act = t.closest('[data-act]');
    if (act && act.dataset.act === 'menu') {
      exit();
      return;
    }
    const pl = t.closest('[data-pid]');
    if (pl && !t.closest('[data-nolink]')) {
      e.preventDefault();
      BB.ui.openPlayer(pl.dataset.pid);
      return;
    }
    const gl = t.closest('[data-gid]');
    if (gl && !t.closest('[data-nolink]')) {
      e.preventDefault();
      BB.ui.openBox(gl.dataset.gid);
      return;
    }
    const tl = t.closest('[data-team]');
    if (tl && !t.closest('[data-nolink]') && screens.teamPage) {
      e.preventDefault();
      go('teamPage', { teamId: tl.dataset.team });
      return;
    }
    const g = t.closest('[data-go]');
    if (g) {
      e.preventDefault();
      let params = null;
      try {
        params = g.dataset.params ? JSON.parse(g.dataset.params) : null;
      } catch (err) {
        params = null;
      }
      go(g.dataset.go, params);
    }
  }

  function renderHeader() {
    const L = state.league;
    if (!L || !rootEl) return;
    const t = S().userTeam(L);
    const rec = L.phase === 'spring' ? t.springRec : t.rec;
    const recText = L.phase === 'spring' ? `Spring ${rec.w}-${rec.l}` : `${rec.w}-${rec.l}`;
    rootEl.querySelector('#fr-head-team').innerHTML = `<i class="fr-dot" style="background:${esc(t.color)}"></i><b>${esc(t.city)} ${esc(t.name)}</b><span>${recText}</span>`;
    const d = S().today(L);
    const phaseName = { spring: 'Spring training', regular: 'Regular season', postseason: 'Postseason', offseason: 'Offseason' }[L.phase];
    rootEl.querySelector('#fr-head-date').innerHTML = `<b>${d.date ? fmt.date(d.date) : L.year}</b><span>${phaseName} ${L.year}</span>`;
    const scr = screens[state.current];
    rootEl.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('sel', !!scr && scr.tab === b.dataset.tab));
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  function register(id, def) {
    screens[id] = def;
  }

  function go(id, params, opts) {
    if (!screens[id]) {
      toast(`Screen "${id}" isn't built yet.`);
      return;
    }
    if (state.current && !(opts && opts.replace)) state.history.push({ id: state.current, params: state.params });
    if (state.history.length > 30) state.history.shift();
    state.current = id;
    state.params = params || null;
    render();
    mainEl.scrollTop = 0;
    root.scrollTo && root.scrollTo(0, 0);
  }

  function back() {
    const prev = state.history.pop();
    if (prev) {
      state.current = prev.id;
      state.params = prev.params;
      render();
    } else go('home', null, { replace: true });
  }

  function render() {
    ensureRoot();
    renderHeader();
    const scr = screens[state.current];
    mainEl.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'fr-screen fr-screen-' + state.current;
    if (scr.title && !scr.tab) {
      const h = document.createElement('div');
      h.className = 'fr-screen-head';
      h.innerHTML = `<button class="fr-back" aria-label="Back">&#8249;</button><h2>${esc(typeof scr.title === 'function' ? scr.title(state.params) : scr.title)}</h2>`;
      h.querySelector('.fr-back').addEventListener('click', back);
      el.appendChild(h);
    }
    const body = document.createElement('div');
    body.className = 'fr-screen-body';
    el.appendChild(body);
    mainEl.appendChild(el);
    try {
      scr.render(body, state.params || {});
    } catch (err) {
      body.innerHTML = `<div class="fr-card"><b>Something went wrong showing this page.</b><pre>${esc(err && err.stack ? err.stack : err)}</pre></div>`;
      if (root.console) console.error(err);
    }
  }

  function refresh() {
    if (state.current) render();
  }

  // ---------------------------------------------------------------------------
  // Show / hide the franchise pages
  // ---------------------------------------------------------------------------
  function show(league, screen, params) {
    ensureRoot();
    if (league !== undefined) state.league = league;
    rootEl.hidden = false;
    document.body.classList.add('fr-open');
    state.history = [];
    state.current = null;
    go(screen || 'home', params);
  }
  function hide() {
    if (rootEl) rootEl.hidden = true;
    document.body.classList.remove('fr-open');
  }
  function isOpen() {
    return !!rootEl && !rootEl.hidden;
  }
  // Back to the main menu (main.js sets BB.ui.onExit).
  function exit() {
    saveNow();
    hide();
    if (BB.ui.onExit) BB.ui.onExit();
  }

  // ---------------------------------------------------------------------------
  // Saving (debounced)
  // ---------------------------------------------------------------------------
  function save() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, 400);
  }
  function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.league || !BB.db) return Promise.resolve(false);
    return BB.db.save(state.league).catch(() => {
      toast('Saving failed. Your browser may be blocking storage.');
      return false;
    });
  }

  // ---------------------------------------------------------------------------
  // Modal, toast, confirm, progress
  // ---------------------------------------------------------------------------
  function modal(opts) {
    const o = opts || {};
    const back = document.createElement('div');
    back.className = 'fr-modal-back';
    back.innerHTML = `<div class="fr-modal${o.wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="fr-modal-head"><h3>${esc(o.title || '')}</h3><button class="fr-x" aria-label="Close">&times;</button></div>
      <div class="fr-modal-body"></div></div>`;
    const body = back.querySelector('.fr-modal-body');
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    const close = () => {
      if (!back.parentNode) return;
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (o.onClose) o.onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('.fr-x')) close();
    });
    // Links inside modals use the same delegation as pages.
    back.addEventListener('click', (e) => {
      if (e.target.closest('.fr-x')) return;
      const pl = e.target.closest('[data-pid]');
      if (pl && !e.target.closest('[data-nolink]')) {
        e.preventDefault();
        BB.ui.openPlayer(pl.dataset.pid);
        return;
      }
      const gl = e.target.closest('[data-gid]');
      if (gl && !e.target.closest('[data-nolink]')) {
        e.preventDefault();
        BB.ui.openBox(gl.dataset.gid);
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    return { el: body, root: back, close };
  }

  function toast(text) {
    ensureRoot();
    const box = rootEl.querySelector('#fr-toasts');
    const t = document.createElement('div');
    t.className = 'fr-toast';
    t.textContent = text;
    (rootEl.hidden ? document.body : box).appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function confirm(text, okLabel) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title: 'Are you sure?',
        body: `<p class="fr-confirm-text">${esc(text)}</p><div class="fr-row-btns"><button class="btn go" data-ok>${esc(okLabel || 'Yes')}</button><button class="btn" data-no>Cancel</button></div>`,
        onClose: () => {
          if (!done) resolve(false);
        },
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => {
        done = true;
        m.close();
        resolve(true);
      });
      m.el.querySelector('[data-no]').addEventListener('click', () => {
        done = true;
        m.close();
        resolve(false);
      });
    });
  }

  const progress = (() => {
    let el = null;
    let cancelled = false;
    return {
      show(label) {
        cancelled = false;
        if (!el) {
          el = document.createElement('div');
          el.className = 'fr-progress-back';
          el.innerHTML = `<div class="fr-progress"><div class="fr-progress-label"></div><div class="fr-progress-bar"><i></i></div><button class="btn">Stop</button></div>`;
          el.querySelector('button').addEventListener('click', () => {
            cancelled = true;
            el.querySelector('button').textContent = 'Stopping…';
          });
        }
        el.querySelector('.fr-progress-label').textContent = label || 'Simulating…';
        el.querySelector('i').style.width = '0%';
        el.querySelector('button').textContent = 'Stop';
        document.body.appendChild(el);
      },
      update(frac, label) {
        if (!el) return;
        el.querySelector('i').style.width = Math.round(Math.min(1, frac) * 100) + '%';
        if (label) el.querySelector('.fr-progress-label').textContent = label;
      },
      hide() {
        if (el && el.parentNode) el.remove();
      },
      cancelled: () => cancelled,
    };
  })();

  // Runs a season sim with the progress overlay, then saves and refreshes.
  async function runSim(target, opts) {
    const L = state.league;
    const o = Object.assign({ includeUser: false }, opts || {});
    progress.show(o.label || 'Simulating…');
    try {
      const res = await S().simUntil(L, target, {
        includeUser: o.includeUser,
        onProgress: (f, date) => progress.update(f, (o.label || 'Simulating') + ' · ' + fmt.date(date)),
        shouldStop: progress.cancelled,
      });
      return res;
    } finally {
      progress.hide();
      await saveNow();
      refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Default screens (the UI agent's files replace these)
  // ---------------------------------------------------------------------------
  register('home', {
    tab: 'Home',
    render(el) {
      const L = state.league;
      const t = S().today(L);
      const ug = t.userGame;
      el.innerHTML = `<div class="fr-card"><h3>${t.date ? fmt.dateLong(t.date) : 'Phase complete'}</h3>
        <p>${ug ? `${esc(ug.away)} @ ${esc(ug.home)}` : t.done ? 'No more games in this phase.' : 'No game today.'}</p>
        <div class="fr-row-btns">
          ${ug && ug.status !== 'final' ? '<button class="btn go" data-a="sim1">Sim today</button>' : ''}
          ${!t.done ? '<button class="btn" data-a="week">Sim a week</button>' : '<button class="btn go" data-a="next">Continue</button>'}
        </div></div>`;
      el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'sim1') await runSim({ to: 'day' }, { includeUser: true });
        if (a.dataset.a === 'week') await runSim({ to: 'week' }, { includeUser: true });
        if (a.dataset.a === 'next') {
          S().advancePhase(L);
          saveNow();
          refresh();
        }
      });
    },
  });

  BB.ui = {
    TABS, screens, register, go, back, refresh, show, hide, isOpen, exit, save, saveNow,
    league: () => state.league,
    setLeague: (L) => (state.league = L),
    current: () => state.current,
    modal, toast, confirm, progress, runSim,
    esc, fmt, teamChip, playerLink, formIcon, formText, FORM_ICON, rating, table,
    // Implemented by the UI agent (profile.js, boxscore.js, screens-core.js):
    openPlayer: (pid) => toast('Player profiles are coming soon. (' + pid + ')'),
    openBox: (gid) => toast('Box scores are coming soon. (' + gid + ')'),
    playGame: () => toast('Playing franchise games is coming soon.'),
    onExit: null,
  };
})(typeof window !== 'undefined' ? window : globalThis);
