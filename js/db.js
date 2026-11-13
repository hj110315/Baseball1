// Franchise save slot. Uses IndexedDB (the league is several MB), and falls
// back to localStorage when IndexedDB isn't available. Every call returns a
// Promise. Node has neither, so saves are kept in memory there (tests).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const DB_NAME = 'diamond-dash';
  const STORE = 'saves';
  const KEY = 'franchise';
  let memory = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('no indexedDB'));
      let req;
      try {
        req = root.indexedDB.open(DB_NAME, 1);
      } catch (e) {
        return reject(e);
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(STORE, mode);
          const store = t.objectStore(STORE);
          let result;
          const req = fn(store);
          if (req) req.onsuccess = () => (result = req.result);
          t.oncomplete = () => {
            db.close();
            resolve(result);
          };
          t.onerror = t.onabort = () => {
            db.close();
            reject(t.error);
          };
        }),
    );
  }

  function lsGet() {
    try {
      const s = root.localStorage && root.localStorage.getItem('diamond-dash-franchise');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }
  function lsSet(league) {
    try {
      root.localStorage.setItem('diamond-dash-franchise', JSON.stringify(league));
      return true;
    } catch (e) {
      return false;
    }
  }

  function save(league) {
    if (!root.indexedDB && !root.localStorage) {
      memory = JSON.parse(JSON.stringify(league));
      return Promise.resolve(true);
    }
    return tx('readwrite', (s) => s.put(league, KEY))
      .then(() => true)
      .catch(() => lsSet(league));
  }

  function load() {
    if (!root.indexedDB && !root.localStorage) return Promise.resolve(memory ? JSON.parse(JSON.stringify(memory)) : null);
    return tx('readonly', (s) => s.get(KEY))
      .then((v) => v || lsGet())
      .catch(() => lsGet());
  }

  function clear() {
    memory = null;
    try {
      root.localStorage && root.localStorage.removeItem('diamond-dash-franchise');
    } catch (e) {
      /* ignore */
    }
    if (!root.indexedDB) return Promise.resolve(true);
    return tx('readwrite', (s) => s.delete(KEY))
      .then(() => true)
      .catch(() => true);
  }

  // Quick check without loading everything into the UI.
  function exists() {
    return load().then((v) => !!v);
  }

  BB.db = { save, load, clear, exists };
})(typeof window !== 'undefined' ? window : globalThis);
