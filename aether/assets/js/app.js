/* ==========================================================================
   AetherOS — interface layer
   Hash-routed single page. Everything renders from AetherStore; all clicks go
   through one delegated handler, so re-renders never leak listeners.
   ========================================================================== */
(function () {
  "use strict";

  var Store = window.AetherStore;
  var FX = window.AetherFX;

  var $ = function (sel, rootNode) { return (rootNode || document).querySelector(sel); };
  var $$ = function (sel, rootNode) { return Array.prototype.slice.call((rootNode || document).querySelectorAll(sel)); };

  var VIEWS = ["console", "vault", "codex", "sigil"];
  var state = Store.get();

  var ui = {
    view: "console",
    filter: "active",
    realm: Store.REALMS[0].id,
    noteIndex: 0,
    noteDraft: null,
    flipping: false,
    paletteOpen: false,
    paletteIndex: 0,
    toastTimer: null
  };

  /* ------------------------------------------------------------- helpers */

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function realm(id) {
    for (var i = 0; i < Store.REALMS.length; i++) if (Store.REALMS[i].id === id) return Store.REALMS[i];
    return Store.REALMS[0];
  }

  function ago(time) {
    if (!time) return "just now";
    var diff = Math.max(0, Date.now() - Number(time));
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "moments ago";
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    if (days < 30) return days + "d ago";
    return new Date(Number(time)).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function toast(message, kind) {
    var node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind || "info";
    node.classList.add("is-on");
    if (ui.toastTimer) clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { node.classList.remove("is-on"); }, 4200);
  }

  function noteList() {
    return state.notes.slice().sort(function (a, b) { return Number(b.updatedAt) - Number(a.updatedAt); });
  }

  /* -------------------------------------------------------- chrome render */

  function renderNav() {
    $$("[data-nav]").forEach(function (link) {
      var active = link.getAttribute("data-nav") === ui.view;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function manaMarkup() {
    var value = Store.mana();
    var percent = Math.round((value / Store.MANA_MAX) * 100);
    var wait = Store.nextManaIn();
    return {
      percent: percent,
      label: percent + "%",
      detail: value >= Store.MANA_MAX ? "Full" : "+1 in " + Math.ceil(wait / 1000) + "s"
    };
  }

  function renderMana() {
    var info = manaMarkup();
    var fill = $("#mana-fill");
    if (fill) fill.style.width = info.percent + "%";
    var numeric = $("#mana-value");
    if (numeric) numeric.textContent = info.label;
    var next = $("#mana-next");
    if (next) next.textContent = info.detail;
    var wrap = $("#mana-meter");
    if (wrap) wrap.setAttribute("aria-valuenow", String(info.percent));
  }

  /* -------------------------------------------------------- console view */

  function spellRow(spell) {
    var rune = realm(spell.rune);
    var status = spell.status;
    var prio = Store.PRIORITIES[spell.priority] || Store.PRIORITIES.mid;
    var badge = status === "compiled" ? "Compiled" : status === "archived" ? "Archived" : "Casting";
    var action = status === "compiled"
      ? '<button class="btn btn--ghost btn--sm" data-action="reopen" data-id="' + spell.id + '">Reopen</button>'
      : '<button class="btn btn--ghost btn--sm" data-action="compile" data-id="' + spell.id + '">Compile</button>';

    return (
      '<li class="spell spell--' + status + '" style="--hue:' + rune.hue + '">' +
        '<span class="spell__glyph" aria-hidden="true">' + rune.glyph + "</span>" +
        '<div class="spell__body">' +
          '<p class="spell__title">' + esc(spell.title) + "</p>" +
          '<p class="spell__meta">' +
            '<span class="spell__rune">' + esc(rune.name) + "</span>" +
            "<span>" + esc(prio.label) + "</span>" +
            "<span>" + badge + "</span>" +
            "<span>" + ago(spell.createdAt) + "</span>" +
          "</p>" +
        "</div>" +
        '<div class="spell__actions">' +
          action +
          '<button class="btn btn--icon" data-action="archive" data-id="' + spell.id + '" aria-label="' +
            (status === "archived" ? "Restore " : "Archive ") + esc(spell.title) + '">' +
            '<span aria-hidden="true">' + (status === "archived" ? "↺" : "⌸") + "</span></button>" +
          '<button class="btn btn--icon btn--danger" data-action="destroy" data-id="' + spell.id + '" aria-label="Erase ' +
            esc(spell.title) + '"><span aria-hidden="true">✕</span></button>' +
        "</div>" +
      "</li>"
    );
  }

  function renderConsole() {
    var progress = Store.progress();
    var filtered = state.spells.filter(function (spell) {
      if (ui.filter === "all") return true;
      return spell.status === ui.filter;
    });

    var counts = {
      active: state.spells.filter(function (s) { return s.status === "active"; }).length,
      compiled: state.spells.filter(function (s) { return s.status === "compiled"; }).length,
      archived: state.spells.filter(function (s) { return s.status === "archived"; }).length
    };

    var chips = ["active", "compiled", "archived"].map(function (key) {
      return '<button class="chip" data-action="filter" data-filter="' + key + '" aria-pressed="' +
        (ui.filter === key) + '">' + key + " <span class=\"chip__count\">" + counts[key] + "</span></button>";
    }).join("");

    var runeOptions = Store.REALMS.map(function (item) {
      return '<option value="' + item.id + '">' + item.glyph + "  " + esc(item.name) + "</option>";
    }).join("");

    var priorityChips = Object.keys(Store.PRIORITIES).map(function (key) {
      var item = Store.PRIORITIES[key];
      return '<label class="prio">' +
        '<input type="radio" name="priority" value="' + key + '"' + (key === "mid" ? " checked" : "") + ">" +
        '<span class="prio__face"><span class="prio__name">' + item.label + "</span>" +
        '<span class="prio__cost">' + item.mana + " mana</span></span></label>";
    }).join("");

    var realms = Store.REALMS.map(function (item) {
      var stats = Store.realmStats(item.id);
      return '<li class="realm-row" style="--hue:' + item.hue + '">' +
        '<span class="realm-row__glyph" aria-hidden="true">' + item.glyph + "</span>" +
        '<div class="realm-row__body">' +
          '<p class="realm-row__name">' + esc(item.name) + "</p>" +
          '<div class="bar"><span style="width:' + stats.percent + '%"></span></div>' +
        "</div>" +
        '<span class="realm-row__count">' + stats.compiled + "/" + stats.total + "</span>" +
      "</li>";
    }).join("");

    return (
      '<section class="view view--console" id="view-console" data-view="console">' +
        '<header class="hero">' +
          '<p class="eyebrow"><span class="dot"></span> AetherOS console</p>' +
          "<h1>Cast what you mean <span class=\"grad\">to finish</span>.</h1>" +
          "<p class=\"hero__sub\">Every task is a spell: cast it into a realm, watch it draw mana, compile it when it is real. " +
            "Notes live in the codex, projects float in the vault, and the whole grimoire can be sealed into an encrypted vault you own.</p>" +
          '<div class="hero__stats">' +
            '<div class="hero__stat"><strong id="hero-level">' + progress.level + '</strong><span>circle</span></div>' +
            '<div class="hero__stat"><strong id="hero-xp">' + progress.xp + '</strong><span>xp</span></div>' +
            '<div class="hero__stat"><strong id="hero-cast">' + (state.cast || 0) + '</strong><span>spells cast</span></div>' +
            '<div class="hero__stat"><strong id="hero-done">' + progress.compiled + '</strong><span>compiled</span></div>' +
          "</div>" +
        "</header>" +

        '<div class="console">' +
          '<div class="console__main">' +
            '<form class="cast" id="cast-form" autocomplete="off">' +
              '<div class="cast__ring" aria-hidden="true"></div>' +
              '<label class="cast__label" for="cast-title">Inscribe a new spell</label>' +
              '<div class="cast__row">' +
                '<input class="cast__input" id="cast-title" name="title" type="text" maxlength="120" required ' +
                  'placeholder="e.g. make the mana bar drain on cast" ' +
                  'aria-describedby="cast-hint">' +
                '<button class="btn btn--cast" type="submit"><span class="btn--cast__glyph" aria-hidden="true">✦</span> Cast</button>' +
              "</div>" +
              '<p class="cast__hint" id="cast-hint">Enter casts · the rune decides which realm it belongs to</p>' +
              '<div class="cast__options">' +
                '<label class="field"><span class="field__label">Realm</span>' +
                  '<select class="select" name="rune" id="cast-rune">' + runeOptions + "</select></label>" +
                '<fieldset class="field field--prio"><legend class="field__label">Magnitude</legend>' +
                  '<div class="prio-group">' + priorityChips + "</div></fieldset>" +
              "</div>" +
            "</form>" +

            '<div class="log">' +
              '<div class="log__head">' +
                "<h2 class=\"log__title\">Invocations</h2>" +
                '<div class="chips" role="group" aria-label="Filter spells">' + chips + "</div>" +
              "</div>" +
              '<ul class="spells" id="spell-list">' +
                (filtered.length ? filtered.map(spellRow).join("") :
                  '<li class="empty"><span aria-hidden="true">◇</span><p>Nothing here yet. Cast a spell above and it lands in this list.</p></li>') +
              "</ul>" +
            "</div>" +
          "</div>" +

          '<aside class="console__side">' +
            '<div class="panel">' +
              '<h2 class="panel__title">Circle of the Ninth</h2>' +
              '<p class="panel__sub">Level ' + progress.level + " · " + progress.nextLevelXp + " xp to the next circle</p>" +
              '<div class="bar bar--tall"><span style="width:' + (100 - Math.round((progress.nextLevelXp / 40) * 100)) + '%"></span></div>' +
              '<h3 class="panel__label">Realm progress</h3>' +
              '<ul class="realms">' + realms + "</ul>" +
            "</div>" +
            '<div class="panel panel--quiet">' +
              '<h2 class="panel__title">Arcane mechanics</h2>' +
              '<ul class="mechanics">' +
                "<li><strong>Mana</strong> refills one point every 12 seconds. Casting spends it.</li>" +
                "<li><strong>Compiling</strong> a spell grants xp and returns 10 mana.</li>" +
                "<li><strong>Archive</strong> keeps a spell without counting it against progress.</li>" +
              "</ul>" +
            "</div>" +
          "</aside>" +
        "</div>" +
      "</section>"
    );
  }

  /* ---------------------------------------------------------- vault view */

  var SLOTS = [
    { x: -0.29, y: -0.1, z: -180, scale: 0.86 },
    { x: -0.08, y: 0.16, z: 90, scale: 1.06 },
    { x: 0.18, y: -0.16, z: -40, scale: 0.96 },
    { x: 0.38, y: 0.14, z: -260, scale: 0.74 }
  ];

  function artifactMarkup(item, index) {
    var stats = Store.realmStats(item.id);
    var slot = SLOTS[index % SLOTS.length];
    var selected = ui.realm === item.id;
    var spells = state.spells.filter(function (spell) { return spell.rune === item.id; }).slice(0, 4);

    return (
      '<button class="artifact' + (selected ? " is-selected" : "") + '" data-action="realm" data-realm="' + item.id + '" ' +
        'style="--hue:' + item.hue + ";--p:" + stats.percent + ";--slot-x:" + slot.x + ";--slot-y:" + slot.y +
        ";--slot-z:" + slot.z + ";--slot-scale:" + slot.scale + ";--delay:" + (index * 0.7) + 's" ' +
        'aria-pressed="' + selected + '">' +
        '<span class="artifact__aura" aria-hidden="true"></span>' +
        '<span class="artifact__core">' +
          '<span class="artifact__glyph" aria-hidden="true">' + item.glyph + "</span>" +
          '<span class="artifact__ring" aria-hidden="true"></span>' +
        "</span>" +
        '<span class="artifact__label">' + esc(item.name) + "</span>" +
        '<span class="artifact__count">' + stats.compiled + "/" + stats.total + "</span>" +
        '<span class="artifact__sr">' + esc(item.blurb) + " — " + stats.percent + "% compiled</span>" +
        (spells.length ? "" : "") +
      "</button>"
    );
  }

  function renderVault() {
    var current = realm(ui.realm);
    var stats = Store.realmStats(current.id);
    var spells = state.spells.filter(function (spell) { return spell.rune === current.id; });

    var list = spells.length ? spells.map(function (spell) {
      return '<li class="mini-spell"><span class="mini-spell__dot" aria-hidden="true"></span>' +
        '<span class="mini-spell__title">' + esc(spell.title) + "</span>" +
        '<span class="mini-spell__state">' + spell.status + "</span></li>";
    }).join("") : '<li class="empty empty--tight">No spells in this realm yet.</li>';

    return (
      '<section class="view view--vault" id="view-vault" data-view="vault">' +
        '<header class="page-head">' +
          '<p class="eyebrow"><span class="dot"></span> The Arcane Vault</p>' +
          "<h1>Artifacts, <span class=\"grad\">floating</span>.</h1>" +
          "<p class=\"page-head__sub\">Four realms hang in a zero-gravity chamber. Move your pointer to tilt the room; " +
            "each artifact glows in proportion to what you have actually compiled.</p>" +
        "</header>" +
        '<div class="vault">' +
          '<div class="vault__stage" id="vault-stage" tabindex="0" aria-label="Floating realm artifacts">' +
            '<div class="vault__grid" aria-hidden="true"></div>' +
            '<div class="vault__world" id="vault-world">' +
              Store.REALMS.map(artifactMarkup).join("") +
            "</div>" +
          "</div>" +
          '<aside class="vault__detail" aria-live="polite">' +
            '<div class="panel" style="--hue:' + current.hue + '">' +
              '<p class="panel__kicker">Selected artifact</p>' +
              "<h2 class=\"panel__title\">" + current.glyph + " " + esc(current.name) + "</h2>" +
              '<p class="panel__sub">' + esc(current.blurb) + "</p>" +
              '<div class="stat-row">' +
                '<div class="stat"><strong>' + stats.percent + '%</strong><span>compiled</span></div>' +
                '<div class="stat"><strong>' + stats.active + '</strong><span>casting</span></div>' +
                '<div class="stat"><strong>' + stats.compiled + '</strong><span>done</span></div>' +
              "</div>" +
              '<div class="bar bar--tall"><span style="width:' + stats.percent + '%"></span></div>' +
              '<h3 class="panel__label">Inside</h3>' +
              '<ul class="mini-spells" id="realm-spells">' + list + "</ul>" +
              '<button class="btn btn--primary btn--block" data-action="realm-open" data-realm="' + current.id + '">' +
                "Open in the grimoire <span aria-hidden=\"true\">↗</span></button>" +
            "</div>" +
          "</aside>" +
        "</div>" +
      "</section>"
    );
  }

  /* ---------------------------------------------------------- codex view */

  function pageMarkup(note) {
    if (!note) {
      return '<div class="page__empty">' +
        '<p class="page__empty-title">The codex is blank</p>' +
        '<p>Write the first page and it will be bound into the book.</p>' +
        '<button class="btn btn--primary" data-action="note-new">Begin a page</button>' +
      "</div>";
    }
    var body = esc(note.body).split("\n").map(function (line) {
      return line.trim() ? "<p>" + line + "</p>" : "<p class=\"page__gap\"></p>";
    }).join("");
    return (
      '<div class="page">' +
        '<p class="page__kicker">Codex · ' + new Date(Number(note.updatedAt)).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) + "</p>" +
        "<h2 class=\"page__title\">" + esc(note.title) + "</h2>" +
        '<div class="page__body">' + body + "</div>" +
      "</div>"
    );
  }

  function editorMarkup() {
    var draft = ui.noteDraft || { title: "", body: "" };
    return (
      '<form class="editor" id="note-form" autocomplete="off">' +
        '<p class="editor__kicker">Inscribe</p>' +
        '<label class="sr-only" for="note-title">Page title</label>' +
        '<input class="editor__title" id="note-title" name="title" value="' + esc(draft.title) + '" placeholder="Page title" maxlength="90">' +
        '<label class="sr-only" for="note-body">Page contents</label>' +
        '<textarea class="editor__body" id="note-body" name="body" rows="10" placeholder="Write freely. Line breaks become paragraphs.">' + esc(draft.body) + "</textarea>" +
        '<div class="editor__foot">' +
          '<button class="btn btn--primary" type="submit">Bind page</button>' +
          '<button class="btn btn--ghost" type="button" data-action="note-cancel">Cancel</button>' +
        "</div>" +
      "</form>"
    );
  }

  function renderCodex() {
    var notes = noteList();
    if (ui.noteIndex > notes.length - 1) ui.noteIndex = Math.max(0, notes.length - 1);
    var current = notes[ui.noteIndex] || null;

    var toc = notes.map(function (note, index) {
      return '<li><button class="toc__item' + (index === ui.noteIndex ? " is-active" : "") + '" ' +
        'data-action="note-open" data-index="' + index + '">' +
        '<span class="toc__title">' + esc(note.title) + "</span>" +
        '<span class="toc__meta">' + ago(note.updatedAt) + "</span></button></li>";
    }).join("");

    return (
      '<section class="view view--codex" id="view-codex" data-view="codex">' +
        '<header class="page-head">' +
          '<p class="eyebrow"><span class="dot"></span> The Interactive Grimoire</p>' +
          "<h1>Turn the <span class=\"grad\">page</span>.</h1>" +
          "<p class=\"page-head__sub\">Real notes, bound as a book. Flip with the arrows or the keyboard; " +
            "the paper carries a little holographic interference from the machinery behind it.</p>" +
        "</header>" +
        '<div class="codex">' +
          '<aside class="codex__toc">' +
            '<div class="toc__head"><h2 class="panel__title">Contents</h2>' +
              '<button class="btn btn--primary btn--sm" data-action="note-new">New page</button></div>' +
            '<ul class="toc" id="codex-toc">' + (toc || '<li class="empty empty--tight">No pages yet.</li>') + "</ul>" +
          "</aside>" +
          '<div class="codex__bookwrap">' +
            '<div class="book" id="codex-book">' +
              '<div class="book__sheet" id="codex-sheet">' +
                '<div class="book__face book__face--front" id="codex-front">' + pageMarkup(current) + "</div>" +
                '<div class="book__face book__face--back" id="codex-back"><div class="page"></div></div>' +
              "</div>" +
              '<div class="book__glitch" aria-hidden="true"></div>' +
            "</div>" +
            '<div class="book__nav">' +
              '<button class="btn btn--ghost" data-action="note-flip" data-dir="-1"' + (ui.noteIndex <= 0 ? " disabled" : "") + ">← Previous</button>" +
              '<p class="book__folia">Page ' + (notes.length ? ui.noteIndex + 1 : 0) + " of " + notes.length + "</p>" +
              '<button class="btn btn--ghost" data-action="note-flip" data-dir="1"' + (ui.noteIndex >= notes.length - 1 ? " disabled" : "") + ">Next →</button>" +
            "</div>" +
          "</div>" +
          '<aside class="codex__editor" id="codex-editor">' +
            (ui.noteDraft ? editorMarkup() : '<div class="panel panel--quiet"><h2 class="panel__title">Annotation</h2>' +
              '<p class="panel__sub">Pick a page to edit it, or start a new one.</p>' +
              '<div class="panel__actions"><button class="btn btn--ghost btn--block" data-action="note-edit"' +
              (current ? "" : " disabled") + ">Edit this page</button>" +
              '<button class="btn btn--ghost btn--block btn--danger" data-action="note-delete"' +
              (current ? "" : " disabled") + ">Unbind this page</button></div></div>") +
          "</aside>" +
        "</div>" +
      "</section>"
    );
  }

  /* ---------------------------------------------------------- sigil view */

  function renderSigil() {
    var meta = Store.getMeta();
    var linked = !!meta.sigil;
    var canCrypto = Store.cryptoReady();

    return (
      '<section class="view view--sigil" id="view-sigil" data-view="sigil">' +
        '<header class="page-head">' +
          '<p class="eyebrow"><span class="dot"></span> Sigil &amp; vault</p>' +
          "<h1>Your grimoire, <span class=\"grad\">sealed</span>.</h1>" +
          "<p class=\"page-head__sub\">The vault stores one encrypted blob in the portfolio's D1 database. " +
            "Your passphrase never leaves this browser, and the server has no key — it is a locker, not a reader.</p>" +
        "</header>" +

        '<div class="sigil-grid">' +
          '<div class="panel">' +
            "<h2 class=\"panel__title\">" + (linked ? "Linked vault" : "Seal this grimoire") + "</h2>" +
            (linked
              ? '<p class="panel__sub">Sealed as <code class="code">' + esc(meta.sigil) + "</code> · revision " + meta.revision +
                (meta.lastSync ? " · last sync " + ago(meta.lastSync) : "") + "</p>"
              : '<p class="panel__sub">Pick a sigil (an address, not a secret) and a passphrase. Keep the passphrase safe: ' +
                "there is no reset link, because nobody — including the server — can read your blob without it.</p>") +
            '<div class="sync-form">' +
              '<label class="field"><span class="field__label">Sigil</span>' +
                '<input class="input" id="sync-sigil" type="text" value="' + esc(meta.sigil) + '" placeholder="e.g. omar-grimoire" ' +
                'maxlength="24" pattern="[a-z0-9][a-z0-9_-]{2,23}" autocomplete="username"></label>' +
              '<label class="field"><span class="field__label">Passphrase</span>' +
                '<input class="input" id="sync-pass" type="password" placeholder="at least 8 characters" autocomplete="current-password"></label>' +
            "</div>" +
            '<div class="panel__actions panel__actions--row">' +
              '<button class="btn btn--primary" data-action="sync-push"' + (canCrypto ? "" : " disabled") + ">" +
                (linked ? "Push changes" : "Seal &amp; push") + "</button>" +
              '<button class="btn btn--ghost" data-action="sync-pull"' + (canCrypto ? "" : " disabled") + ">Open vault</button>" +
              (linked ? '<button class="btn btn--ghost btn--danger" data-action="sync-forget">Delete vault</button>' : "") +
            "</div>" +
            (canCrypto ? "" : '<p class="notice notice--warn">This browser has no WebCrypto, so sealing is unavailable. The grimoire still saves locally.</p>') +
            '<p class="notice">AES-256-GCM, key derived with PBKDF2-SHA256 at ' +
              (window.AetherCrypto ? Number(window.AetherCrypto.ITERATIONS).toLocaleString() : "600,000") +
              " iterations. The server sees base64 and nothing else.</p>" +
          "</div>" +

          '<div class="panel panel--quiet">' +
            '<h2 class="panel__title">Take it with you</h2>' +
            '<p class="panel__sub">The whole grimoire is portable JSON. No lock-in, no account.</p>' +
            '<div class="panel__actions">' +
              '<button class="btn btn--ghost btn--block" data-action="export">Download grimoire JSON</button>' +
              '<button class="btn btn--ghost btn--block" data-action="import">Import a grimoire</button>' +
              '<button class="btn btn--ghost btn--block btn--danger" data-action="reset">Reset to a fresh grimoire</button>' +
            "</div>" +
            '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
            '<p class="notice">Reset clears spells, pages, mana and xp on this device. It does not touch a sealed vault.</p>' +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  /* ------------------------------------------------------------- palette */

  function paletteItems() {
    var items = VIEWS.map(function (view) {
      return { kind: "view", label: view.charAt(0).toUpperCase() + view.slice(1), hint: "Go to view", action: function () { go(view); } };
    });
    Store.REALMS.forEach(function (item) {
      items.push({ kind: "realm", label: item.name, hint: "Open realm in the vault", action: function () { ui.realm = item.id; go("vault"); } });
    });
    state.spells.forEach(function (spell) {
      items.push({
        kind: "spell",
        label: spell.title,
        hint: realm(spell.rune).name + " · " + spell.status,
        action: function () { ui.filter = "all"; go("console"); }
      });
    });
    state.notes.forEach(function (note, index) {
      items.push({
        kind: "note",
        label: note.title,
        hint: "Grimoire page",
        action: function () { ui.noteIndex = noteList().indexOf(note); go("codex"); }
      });
    });
    items.push({ kind: "action", label: "Seal grimoire in the vault", hint: "Sigil & vault", action: function () { go("sigil"); } });
    items.push({ kind: "action", label: "New grimoire page", hint: "Codex", action: function () { ui.noteDraft = { title: "", body: "" }; go("codex"); } });
    return items;
  }

  function renderPalette() {
    var overlay = $("#palette");
    if (!overlay) return;
    overlay.hidden = !ui.paletteOpen;
    document.body.classList.toggle("has-palette", ui.paletteOpen);
    if (!ui.paletteOpen) return;

    var query = ($("#palette-input") || {}).value || "";
    var needle = query.trim().toLowerCase();
    var results = paletteItems().filter(function (item) {
      return !needle || item.label.toLowerCase().indexOf(needle) !== -1 || item.hint.toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 9);

    if (ui.paletteIndex > results.length - 1) ui.paletteIndex = Math.max(0, results.length - 1);

    var list = $("#palette-results");
    if (list) {
      list.innerHTML = results.length ? results.map(function (item, index) {
        return '<li><button class="palette__item' + (index === ui.paletteIndex ? " is-active" : "") + '" ' +
          'data-action="palette-run" data-index="' + index + '">' +
          '<span class="palette__label">' + esc(item.label) + "</span>" +
          '<span class="palette__hint">' + esc(item.hint) + "</span></button></li>";
      }).join("") : '<li class="palette__empty">Nothing matches “' + esc(query) + "”.</li>";
      list.dataset.count = String(results.length);
    }
  }

  function runPalette(index) {
    var query = ($("#palette-input") || {}).value || "";
    var needle = query.trim().toLowerCase();
    var results = paletteItems().filter(function (item) {
      return !needle || item.label.toLowerCase().indexOf(needle) !== -1 || item.hint.toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 9);
    var item = results[index];
    if (!item) return;
    closePalette();
    item.action();
  }

  function openPalette() {
    ui.paletteOpen = true;
    ui.paletteIndex = 0;
    renderPalette();
    var input = $("#palette-input");
    if (input) { input.value = ""; input.focus(); }
    renderPalette();
  }

  function closePalette() {
    ui.paletteOpen = false;
    renderPalette();
  }

  /* ---------------------------------------------------------- rendering */

  function render() {
    var host = $("#view-host");
    if (!host) return;
    var markup =
      ui.view === "vault" ? renderVault() :
      ui.view === "codex" ? renderCodex() :
      ui.view === "sigil" ? renderSigil() :
      renderConsole();
    host.innerHTML = markup;
    renderNav();
    renderMana();
    if (ui.view === "vault") layoutVault();
  }

  function go(view) {
    if (VIEWS.indexOf(view) === -1) view = "console";
    ui.view = view;
    if (window.location.hash !== "#/" + view) {
      window.history.replaceState(null, "", "#/" + view);
    }
    render();
    var heading = $("h1");
    if (heading) heading.setAttribute("tabindex", "-1");
  }

  function viewFromHash() {
    var raw = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return VIEWS.indexOf(raw) === -1 ? "console" : raw;
  }

  /* ------------------------------------------------------------ the vault */

  function layoutVault() {
    var stage = $("#vault-stage");
    var world = $("#vault-world");
    if (!stage || !world) return;

    var place = function () {
      var box = stage.getBoundingClientRect();
      var w = box.width || 640;
      var h = box.height || 420;
      $$(".artifact", world).forEach(function (node) {
        var sx = parseFloat(node.style.getPropertyValue("--slot-x")) || 0;
        var sy = parseFloat(node.style.getPropertyValue("--slot-y")) || 0;
        var sz = parseFloat(node.style.getPropertyValue("--slot-z")) || 0;
        var scale = parseFloat(node.style.getPropertyValue("--slot-scale")) || 1;
        node.style.setProperty("--dx", Math.round(sx * w * 0.46) + "px");
        node.style.setProperty("--dy", Math.round(sy * h * 0.7) + "px");
        node.style.setProperty("--dz", Math.round(sz) + "px");
        node.style.setProperty("--scale", String(scale));
      });
    };

    place();

    if (stage.dataset.bound === "1") return;
    stage.dataset.bound = "1";

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    stage.addEventListener("pointermove", function (event) {
      if (reduced) return;
      var box = stage.getBoundingClientRect();
      var nx = (event.clientX - box.left) / Math.max(1, box.width) - 0.5;
      var ny = (event.clientY - box.top) / Math.max(1, box.height) - 0.5;
      world.style.setProperty("--tilt-x", (-ny * 14).toFixed(2) + "deg");
      world.style.setProperty("--tilt-y", (nx * 18).toFixed(2) + "deg");
      stage.style.setProperty("--glow-x", (nx * 100 + 50).toFixed(1) + "%");
      stage.style.setProperty("--glow-y", (ny * 100 + 50).toFixed(1) + "%");
    });

    stage.addEventListener("pointerleave", function () {
      world.style.setProperty("--tilt-x", "0deg");
      world.style.setProperty("--tilt-y", "0deg");
    });

    stage.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      var index = Store.REALMS.map(function (r) { return r.id; }).indexOf(ui.realm);
      var next = (index + (event.key === "ArrowRight" ? 1 : -1) + Store.REALMS.length) % Store.REALMS.length;
      ui.realm = Store.REALMS[next].id;
      render();
    });

    window.addEventListener("resize", place);
  }

  /* -------------------------------------------------------------- codex  */

  function flip(dir) {
    if (ui.flipping) return;
    var notes = noteList();
    var target = ui.noteIndex + dir;
    if (target < 0 || target > notes.length - 1) return;

    var sheet = $("#codex-sheet");
    var front = $("#codex-front");
    var back = $("#codex-back");
    if (!sheet || !front || !back) return;

    back.innerHTML = pageMarkup(notes[target]);
    ui.flipping = true;
    sheet.classList.add(dir > 0 ? "is-flipping" : "is-flipping-back");

    var finish = function () {
      sheet.removeEventListener("transitionend", finish);
      sheet.classList.add("is-resetting");
      front.innerHTML = back.innerHTML;
      ui.noteIndex = target;
      render();
      requestAnimationFrame(function () { sheet.classList.remove("is-resetting"); });
      ui.flipping = false;
    };
    sheet.addEventListener("transitionend", finish);
    // safety net for reduced-motion / no transition events
    setTimeout(function () { if (ui.flipping) finish(); }, 900);
  }

  /* ------------------------------------------------------------- actions */

  function doCast(form) {
    var titleInput = $("#cast-title");
    var runeInput = $("#cast-rune");
    var priority = (form.querySelector('input[name="priority"]:checked') || {}).value || "mid";

    var value = titleInput ? titleInput.value : "";

    try {
      var spell = Store.cast({ title: value, rune: runeInput ? runeInput.value : "ember", priority: priority });
      var rune = realm(spell.rune);

      var box = titleInput.getBoundingClientRect();
      FX.rune(box.left + box.width / 2, box.top + box.height / 2, rune.hue);
      FX.burst(box.left + box.width / 2, box.top + box.height / 2, rune.hue, 54);
      FX.burst(box.left + box.width * 0.82, box.top + box.height / 2, rune.hue + 40, 22);

      if (form) form.classList.remove("is-casting");
      if (form) {
        form.classList.add("is-casting");
        setTimeout(function () { form.classList.remove("is-casting"); }, 620);
      }
      state = Store.get();
      ui.filter = "active";
      render();
      toast("Cast into " + rune.name + " · −" + (Store.PRIORITIES[spell.priority] || Store.PRIORITIES.mid).mana + " mana", "ok");
      var again = $("#cast-title");
      if (again) again.focus();
    } catch (error) {
      var node = $("#cast-title");
      if (node) {
        node.classList.add("is-shaking");
        setTimeout(function () { node.classList.remove("is-shaking"); }, 520);
      }
      toast(error.message, "error");
    }
  }

  function syncCredentials() {
    var sigil = ($("#sync-sigil") || {}).value || "";
    var pass = ($("#sync-pass") || {}).value || "";
    return { sigil: sigil.trim().toLowerCase(), pass: pass };
  }

  function busy(button, on) {
    if (!button) return;
    button.disabled = on;
    button.classList.toggle("is-busy", on);
  }

  function handleSync(action, button) {
    var creds = syncCredentials();
    if (creds.pass.length < 8) { toast("Use a passphrase of at least 8 characters.", "error"); return; }
    if (!creds.sigil) { toast("Give the vault a sigil first.", "error"); return; }

    busy(button, true);
    var task = action === "push" ? Store.sync.push(creds.pass, creds.sigil) : Store.sync.pull(creds.pass, creds.sigil);

    task.then(function () {
      state = Store.get();
      busy(button, false);
      ui.view = "sigil";
      render();
      toast(action === "push" ? "Grimoire sealed and pushed." : "Vault opened — state restored.", "ok");
      var pass = $("#sync-pass");
      if (pass) pass.value = "";
    }).catch(function (error) {
      busy(button, false);
      if (error.status === 409) {
        toast("That vault changed elsewhere. Open it first, then push.", "error");
      } else if (error.status === 404) {
        toast("No vault under that sigil yet — seal it first.", "error");
      } else if (error.status === 403) {
        toast("That write key does not match this vault.", "error");
      } else {
        toast(error.message, "error");
      }
    });
  }

  function download() {
    var blob = new Blob([Store.exportJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "aetheros-grimoire.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Grimoire exported.", "ok");
  }

  function onClick(event) {
    var trigger = event.target.closest ? event.target.closest("[data-action], [data-nav]") : null;
    if (!trigger) return;

    var nav = trigger.getAttribute("data-nav");
    if (nav) {
      event.preventDefault();
      go(nav);
      return;
    }

    var action = trigger.getAttribute("data-action");
    var id = trigger.getAttribute("data-id");
    var value;

    switch (action) {
      case "filter":
        ui.filter = trigger.getAttribute("data-filter");
        render();
        break;
      case "compile":
        value = Store.compile(id);
        if (value) {
          var prio = Store.PRIORITIES[value.priority] || Store.PRIORITIES.mid;
          FX.burst(window.innerWidth / 2, window.innerHeight * 0.35, realm(value.rune).hue, 34);
          toast("Compiled · +" + prio.xp + " xp, +10 mana", "ok");
        }
        state = Store.get();
        render();
        break;
      case "reopen":
        Store.reopen(id);
        state = Store.get();
        render();
        toast("Spell reopened.", "info");
        break;
      case "archive":
        value = Store.archive(id);
        state = Store.get();
        render();
        if (value) toast(value.status === "archived" ? "Archived." : "Restored.", "info");
        break;
      case "destroy":
        if (Store.destroy(id)) {
          state = Store.get();
          render();
          toast("Spell erased.", "info");
        }
        break;
      case "realm":
        ui.realm = trigger.getAttribute("data-realm");
        render();
        break;
      case "realm-open":
        ui.filter = "all";
        go("console");
        break;
      case "note-open":
        ui.noteIndex = Number(trigger.getAttribute("data-index"));
        ui.noteDraft = null;
        render();
        break;
      case "note-flip":
        flip(Number(trigger.getAttribute("data-dir")));
        break;
      case "note-new":
        ui.noteDraft = { title: "", body: "" };
        render();
        var titleField = $("#note-title");
        if (titleField) titleField.focus();
        break;
      case "note-edit":
        value = noteList()[ui.noteIndex];
        if (value) {
          ui.noteDraft = { id: value.id, title: value.title, body: value.body };
          render();
          var body = $("#note-body");
          if (body) body.focus();
        }
        break;
      case "note-cancel":
        ui.noteDraft = null;
        render();
        break;
      case "note-delete":
        value = noteList()[ui.noteIndex];
        if (value && Store.deleteNote(value.id)) {
          state = Store.get();
          ui.noteIndex = Math.max(0, ui.noteIndex - 1);
          ui.noteDraft = null;
          render();
          toast("Page unbound.", "info");
        }
        break;
      case "sync-push":
        handleSync("push", trigger);
        break;
      case "sync-pull":
        handleSync("pull", trigger);
        break;
      case "sync-forget":
        if (!window.confirm("Delete the sealed vault from the server? This cannot be undone.")) return;
        busy(trigger, true);
        Store.sync.forget(($("#sync-pass") || {}).value || "")
          .then(function () {
            busy(trigger, false);
            render();
            toast("Vault deleted from the server.", "ok");
          })
          .catch(function (error) { busy(trigger, false); toast(error.message, "error"); });
        break;
      case "export":
        download();
        break;
      case "import":
        var picker = $("#import-file");
        if (picker) picker.click();
        break;
      case "reset":
        if (!window.confirm("Reset this device to a fresh grimoire? Spells, pages, mana and xp are cleared.")) return;
        state = Store.reset();
        ui.noteIndex = 0;
        ui.noteDraft = null;
        go("console");
        toast("A fresh grimoire. The ink is dry.", "ok");
        break;
      case "palette-open":
        openPalette();
        break;
      case "palette-close":
        closePalette();
        break;
      case "palette-run":
        runPalette(Number(trigger.getAttribute("data-index")));
        break;
      default:
        break;
    }
  }

  function onSubmit(event) {
    var form = event.target;
    if (form.id === "cast-form") {
      event.preventDefault();
      doCast(form);
      return;
    }
    if (form.id === "note-form") {
      event.preventDefault();
      var title = ($("#note-title") || {}).value || "";
      var body = ($("#note-body") || {}).value || "";
      if (!title.trim()) { toast("Give the page a title.", "error"); return; }
      if (ui.noteDraft && ui.noteDraft.id) {
        Store.updateNote(ui.noteDraft.id, { title: title, body: body });
        toast("Page updated.", "ok");
      } else {
        var note = Store.addNote({ title: title, body: body });
        toast("Page bound into the codex.", "ok");
        state = Store.get();
        ui.noteIndex = noteList().indexOf(note);
      }
      ui.noteDraft = null;
      state = Store.get();
      render();
    }
  }

  function onKeydown(event) {
    var metaKey = event.metaKey || event.ctrlKey;
    if (metaKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      ui.paletteOpen ? closePalette() : openPalette();
      return;
    }
    if (ui.paletteOpen) {
      if (event.key === "Escape") { event.preventDefault(); closePalette(); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        var count = Number((($("#palette-results") || {}).dataset || {}).count || 0);
        if (!count) return;
        ui.paletteIndex = (ui.paletteIndex + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
        renderPalette();
        var active = $(".palette__item.is-active");
        if (active) active.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runPalette(ui.paletteIndex);
        return;
      }
    }
    // book navigation
    if (ui.view === "codex" && !ui.noteDraft) {
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === "ArrowRight") flip(1);
      if (event.key === "ArrowLeft") flip(-1);
    }
  }

  /* ----------------------------------------------------------------- boot */

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKeydown);

    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "palette-input") {
        ui.paletteIndex = 0;
        renderPalette();
      }
    });

    document.addEventListener("change", function (event) {
      if (event.target && event.target.id === "import-file") {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            state = Store.importJSON(String(reader.result || ""));
            ui.noteIndex = 0;
            render();
            toast("Grimoire imported.", "ok");
          } catch (error) {
            toast(error.message, "error");
          }
        };
        reader.readAsText(file);
        event.target.value = "";
      }
    });

    window.addEventListener("hashchange", function () {
      ui.view = viewFromHash();
      render();
    });

    // mana refills on a timer; only the meter re-renders
    setInterval(function () {
      Render.tick();
    }, 1000);

    Store.subscribe(function () {
      state = Store.get();
      Render.tick();
    });

  }

  var Render = {
    tick: function () {
      state = Store.get();
      renderMana();
      var next = $("#mana-next");
      if (!next) return;
      var info = manaMarkup();
      next.textContent = info.detail;
    },
    all: render
  };

  function init() {
    state = Store.get();
    ui.view = viewFromHash();
    if (!window.AetherCrypto || !window.crypto || !window.crypto.subtle) {
      ui.noCrypto = true;
    }
    bind();
    render();
    FX.init($("#fx"));
    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    document.body.classList.add("is-ready");

    // greet a first-time visitor once
    try {
      if (!window.localStorage.getItem("aether.greeted")) {
        window.localStorage.setItem("aether.greeted", "1");
        setTimeout(function () { toast("Tip: press Ctrl+K for the command palette.", "info"); }, 1400);
      }
    } catch (error) { /* ignore */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.AetherApp = { go: go, render: render, ui: ui, flip: flip, openPalette: openPalette, closePalette: closePalette };
})();
