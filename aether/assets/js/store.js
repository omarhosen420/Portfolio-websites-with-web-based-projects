/* ==========================================================================
   AetherOS — state, persistence and vault sync
   --------------------------------------------------------------------------
   One source of truth: `state`. It is written to localStorage on every change
   (debounced) so the app works with no network at all, and it can be sealed
   into an encrypted blob in the D1-backed vault when you want it on another
   device.
   ========================================================================== */
(function (root) {
  "use strict";

  var KEY = "aether.state.v1";
  var META_KEY = "aether.vault.v1";

  var MANA_MAX = 100;
  var REGEN_MS = 12000; // one point of mana every 12 seconds
  var PRIORITIES = { low: { label: "Whisper", mana: 5, xp: 1 }, mid: { label: "Invocation", mana: 10, xp: 2 }, high: { label: "Ritual", mana: 18, xp: 4 } };

  // Four realms: every spell is cast into one, and the vault renders them as
  // floating artifacts whose size and glow track real progress.
  var REALMS = [
    { id: "ember", name: "Ember Forge", glyph: "✦", hue: 24, blurb: "Things you build and ship." },
    { id: "tide", name: "Tide Library", glyph: "≈", hue: 196, blurb: "Things you study and learn." },
    { id: "gale", name: "Gale Scriptorium", glyph: "❖", hue: 152, blurb: "Things you write and document." },
    { id: "void", name: "Void Keep", glyph: "◈", hue: 276, blurb: "Maintenance, cleanup, the unglamorous." }
  ];

  var API_ORIGIN = "https://site-70c8da266b74437b9066daf6785f9b11.freebuff.page";

  function apiBase() {
    if (root.__AETHER_API__) return root.__AETHER_API__;
    if (/(^|\.)github\.io$/i.test(root.location.hostname)) return API_ORIGIN + "/api";
    return "/api";
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function blank() {
    return {
      version: 1,
      seeded: false,
      spells: [],
      notes: [],
      mana: { value: MANA_MAX, updatedAt: Date.now() },
      xp: 0,
      cast: 0,
      createdAt: new Date().toISOString()
    };
  }

  function seed(state) {
    var now = Date.now();
    state.seeded = true;
    state.spells = [
      { id: uid("spell"), title: "Sketch the vault's 3D stage", rune: "ember", priority: "high", status: "active", createdAt: now - 5400000, compiledAt: null },
      { id: uid("spell"), title: "Read the WebCrypto AES-GCM spec", rune: "tide", priority: "mid", status: "compiled", createdAt: now - 9000000, compiledAt: now - 7200000 },
      { id: uid("spell"), title: "Write the vault sync notes", rune: "gale", priority: "low", status: "active", createdAt: now - 1200000, compiledAt: null }
    ];
    state.notes = [
      {
        id: uid("note"),
        title: "On naming things",
        body: "A spell is only a task with better posture.\n\nName the outcome, not the activity:\n  ✗ \"work on dashboard\"\n  ✓ \"make the mana bar drain on cast\"\n\nThe second one can be finished. The first one can only be abandoned.",
        createdAt: now - 86400000,
        updatedAt: now - 86400000
      },
      {
        id: uid("note"),
        title: "The vault is a dumb locker",
        body: "The server stores one base64 blob per sigil. It has no key and no idea what is inside.\n\nThat means:\n  · losing the passphrase loses the data — there is no reset link\n  · the sigil is an address, not a secret; treat it like a username\n  · anyone who can read the blob still cannot read your notes",
        createdAt: now - 43200000,
        updatedAt: now - 43200000
      }
    ];
  }

  var listeners = [];
  var saveTimer = null;

  var state = blank();
  var meta = { sigil: "", revision: 0, writeKey: "", salt: "", lastSync: "" };

  function load() {
    state = blank();
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) state = Object.assign(blank(), parsed);
      }
    } catch (error) {
      state = blank();
    }
    if (!state.seeded) seed(state);

    try {
      var vault = JSON.parse(root.localStorage.getItem(META_KEY) || "{}");
      meta = Object.assign({ sigil: "", revision: 0, writeKey: "", salt: "", lastSync: "" }, vault || {});
    } catch (error) {
      meta = { sigil: "", revision: 0, writeKey: "", salt: "", lastSync: "" };
    }
    regen();
    return state;
  }

  function writeLocal() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
      root.localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (error) {
      // private mode / quota: keep running in memory
    }
  }

  function save() {
    if (saveTimer) root.clearTimeout(saveTimer);
    saveTimer = root.setTimeout(function () {
      saveTimer = null;
      writeLocal();
    }, 120);
  }

  function emit(event) {
    listeners.forEach(function (fn) {
      try { fn(state, event || "change"); } catch (error) { /* a bad listener must not break the app */ }
    });
  }

  function commit(event) {
    save();
    emit(event);
    return state;
  }

  /* ---------------------------------------------------------------- mana */

  function regen() {
    if (!state.mana) state.mana = { value: MANA_MAX, updatedAt: Date.now() };
    if (state.mana.value >= MANA_MAX) {
      state.mana.value = MANA_MAX;
      state.mana.updatedAt = Date.now();
      return state.mana.value;
    }
    var elapsed = Date.now() - Number(state.mana.updatedAt || Date.now());
    var gained = Math.floor(elapsed / REGEN_MS);
    if (gained > 0) {
      state.mana.value = clamp(state.mana.value + gained, 0, MANA_MAX);
      state.mana.updatedAt = state.mana.value >= MANA_MAX ? Date.now() : Number(state.mana.updatedAt) + gained * REGEN_MS;
    }
    return state.mana.value;
  }

  function mana() {
    return regen();
  }

  function nextManaIn() {
    regen();
    if (state.mana.value >= MANA_MAX) return 0;
    return Math.max(0, REGEN_MS - (Date.now() - Number(state.mana.updatedAt)));
  }

  /* -------------------------------------------------------------- spells */

  function cast(input) {
    var title = String(input && input.title ? input.title : "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (title.length < 3) throw new Error("A spell needs at least three characters.");
    var rune = REALMS.some(function (r) { return r.id === input.rune; }) ? input.rune : "ember";
    var priority = PRIORITIES[input.priority] ? input.priority : "mid";

    regen();
    var cost = PRIORITIES[priority].mana;
    if (state.mana.value < cost) {
      var error = new Error("Not enough mana for a " + PRIORITIES[priority].label + ". Wait for it to refill.");
      error.code = "MANA";
      throw error;
    }

    state.mana.value -= cost;
    state.mana.updatedAt = Date.now();
    state.cast = (state.cast || 0) + 1;

    var spell = {
      id: uid("spell"),
      title: title,
      rune: rune,
      priority: priority,
      status: "active",
      createdAt: Date.now(),
      compiledAt: null
    };
    state.spells.unshift(spell);
    commit("cast");
    return spell;
  }

  function findSpell(id) {
    for (var i = 0; i < state.spells.length; i++) if (state.spells[i].id === id) return state.spells[i];
    return null;
  }

  function priorityOf(spell) {
    return PRIORITIES[spell && spell.priority] || PRIORITIES.mid;
  }

  function compile(id) {
    var spell = findSpell(id);
    if (!spell || spell.status === "compiled") return null;
    spell.status = "compiled";
    spell.compiledAt = Date.now();
    state.xp = (state.xp || 0) + priorityOf(spell).xp;
    regen();
    state.mana.value = clamp(state.mana.value + 10, 0, MANA_MAX);
    state.mana.updatedAt = state.mana.value >= MANA_MAX ? Date.now() : state.mana.updatedAt;
    commit("compile");
    return spell;
  }

  function reopen(id) {
    var spell = findSpell(id);
    if (!spell || spell.status !== "compiled") return null;
    spell.status = "active";
    spell.compiledAt = null;
    state.xp = Math.max(0, (state.xp || 0) - priorityOf(spell).xp);
    commit("reopen");
    return spell;
  }

  function archive(id) {
    var spell = findSpell(id);
    if (!spell) return null;
    spell.status = spell.status === "archived" ? (spell.compiledAt ? "compiled" : "active") : "archived";
    commit("archive");
    return spell;
  }

  function destroy(id) {
    var before = state.spells.length;
    state.spells = state.spells.filter(function (spell) { return spell.id !== id; });
    if (state.spells.length !== before) {
      state.cast = Math.max(0, (state.cast || 0) - 1);
      commit("destroy");
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- notes */

  function addNote(input) {
    var title = String(input && input.title ? input.title : "").replace(/\s+/g, " ").trim().slice(0, 90) || "Untitled page";
    var body = String((input && input.body) || "").slice(0, 12000);
    var note = { id: uid("note"), title: title, body: body, createdAt: Date.now(), updatedAt: Date.now() };
    state.notes.unshift(note);
    commit("note");
    return note;
  }

  function findNote(id) {
    for (var i = 0; i < state.notes.length; i++) if (state.notes[i].id === id) return state.notes[i];
    return null;
  }

  function updateNote(id, patch) {
    var note = findNote(id);
    if (!note) return null;
    if (typeof patch.title === "string") note.title = patch.title.replace(/\s+/g, " ").trim().slice(0, 90) || "Untitled page";
    if (typeof patch.body === "string") note.body = patch.body.slice(0, 12000);
    note.updatedAt = Date.now();
    commit("note");
    return note;
  }

  function deleteNote(id) {
    var before = state.notes.length;
    state.notes = state.notes.filter(function (note) { return note.id !== id; });
    if (state.notes.length !== before) {
      commit("note");
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ progress */

  function realmStats(realmId) {
    var spells = state.spells.filter(function (spell) { return spell.rune === realmId; });
    var compiled = spells.filter(function (spell) { return spell.status === "compiled"; }).length;
    return {
      total: spells.length,
      compiled: compiled,
      active: spells.filter(function (spell) { return spell.status === "active"; }).length,
      archived: spells.filter(function (spell) { return spell.status === "archived"; }).length,
      percent: spells.length ? Math.round((compiled / spells.length) * 100) : 0
    };
  }

  function progress() {
    var live = state.spells.filter(function (spell) { return spell.status !== "archived"; });
    var compiled = live.filter(function (spell) { return spell.status === "compiled"; }).length;
    return {
      total: live.length,
      compiled: compiled,
      percent: live.length ? Math.round((compiled / live.length) * 100) : 0,
      xp: state.xp || 0,
      level: 1 + Math.floor((state.xp || 0) / 40),
      nextLevelXp: 40 - ((state.xp || 0) % 40)
    };
  }

  /* ------------------------------------------------------------ transfer */

  function exportJSON() {
    return JSON.stringify({ app: "AetherOS", version: 1, exportedAt: new Date().toISOString(), state: state }, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var incoming = parsed && parsed.app === "AetherOS" ? parsed.state : parsed;
    if (!incoming || incoming.version !== 1 || !Array.isArray(incoming.spells) || !Array.isArray(incoming.notes)) {
      throw new Error("That file is not an AetherOS grimoire.");
    }
    state = Object.assign(blank(), incoming, { seeded: true });
    regen();
    commit("import");
    return state;
  }

  function reset() {
    state = blank();
    seed(state);
    state.mana = { value: MANA_MAX, updatedAt: Date.now() };
    state.xp = 0;
    state.cast = 0;
    commit("reset");
    return state;
  }

  /* ---------------------------------------------------------------- sync */

  async function request(method, body) {
    var response = await root.fetch(apiBase() + "/aether/vault" + (method === "GET" ? "?sigil=" + encodeURIComponent(body.sigil) : ""), {
      method: method,
      headers: body && method !== "GET" ? { "content-type": "application/json" } : undefined,
      body: body && method !== "GET" ? JSON.stringify(body) : undefined
    });
    var data = null;
    try { data = await response.json(); } catch (error) { /* empty body */ }
    if (!response.ok) {
      var failure = new Error((data && data.error) || "Vault request failed (" + response.status + ")");
      failure.status = response.status;
      failure.data = data;
      throw failure;
    }
    return data;
  }

  function cryptoReady() {
    return !!(root.crypto && root.crypto.subtle && root.AetherCrypto);
  }

  // Seal the current state and push it. Returns the new revision.
  async function push(passphrase, sigil) {
    if (!cryptoReady()) throw new Error("This browser cannot encrypt — the vault needs WebCrypto.");
    var address = String(sigil || meta.sigil || "").toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(address)) {
      throw new Error("A sigil is 3-24 lowercase letters, digits, - or _.");
    }

    var vault = root.AetherCrypto;
    var salt = meta.salt && meta.sigil === address ? meta.salt : vault.makeSalt();
    var writeKey = meta.writeKey || vault.makeWriteKey();
    var key = await vault.deriveKey(passphrase, salt);
    var sealed = await vault.encrypt(key, { writeKey: writeKey, state: state });

    var payload = {
      sigil: address,
      salt: salt,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
      writeKey: writeKey,
      revision: meta.sigil === address ? meta.revision : 0
    };

    var result = await request("PUT", payload);
    meta = { sigil: address, revision: result.revision, writeKey: writeKey, salt: salt, lastSync: new Date().toISOString() };
    writeLocal();
    emit("sync");
    return result;
  }

  // Fetch and open the vault under `sigil`, replacing local state.
  async function pull(passphrase, sigil) {
    if (!cryptoReady()) throw new Error("This browser cannot decrypt — the vault needs WebCrypto.");
    var address = String(sigil || meta.sigil || "").toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(address)) {
      throw new Error("A sigil is 3-24 lowercase letters, digits, - or _.");
    }

    var payload = await request("GET", { sigil: address });
    var blob = payload.vault;
    var key = await root.AetherCrypto.deriveKey(passphrase, blob.salt);
    var opened = await root.AetherCrypto.decrypt(key, blob.iv, blob.ciphertext);
    if (!opened || !opened.state) throw new Error("This vault is empty or unreadable.");

    state = Object.assign(blank(), opened.state, { seeded: true });
    meta = {
      sigil: address,
      revision: blob.revision,
      writeKey: opened.writeKey || "",
      salt: blob.salt,
      lastSync: new Date().toISOString()
    };
    regen();
    writeLocal();
    emit("sync");
    return state;
  }

  async function forget(passphrase) {
    if (!meta.sigil) throw new Error("No vault is linked to this device yet.");
    if (!meta.writeKey) throw new Error("This device has no write key for that vault.");
    var vault = root.AetherCrypto;
    var key = await vault.deriveKey(passphrase, meta.salt);
    var sealed = await vault.encrypt(key, { writeKey: meta.writeKey, state: state });
    var result = await request("DELETE", {
      sigil: meta.sigil,
      salt: meta.salt,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
      writeKey: meta.writeKey,
      revision: meta.revision
    });
    meta = { sigil: "", revision: 0, writeKey: "", salt: "", lastSync: "" };
    writeLocal();
    emit("sync");
    return result;
  }

  load();

  root.AetherStore = {
    KEY: KEY,
    MANA_MAX: MANA_MAX,
    REGEN_MS: REGEN_MS,
    PRIORITIES: PRIORITIES,
    REALMS: REALMS,
    get: function () { return state; },
    getMeta: function () { return meta; },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
    },
    emit: emit,
    mana: mana,
    nextManaIn: nextManaIn,
    cast: cast,
    compile: compile,
    reopen: reopen,
    archive: archive,
    destroy: destroy,
    findSpell: findSpell,
    addNote: addNote,
    updateNote: updateNote,
    deleteNote: deleteNote,
    findNote: findNote,
    realmStats: realmStats,
    progress: progress,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    cryptoReady: cryptoReady,
    apiBase: apiBase,
    sync: { push: push, pull: pull, forget: forget }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
