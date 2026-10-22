/* ==========================================================================
   Omar — Portfolio interaction layer
   Vanilla JS, zero dependencies. Progressive enhancement: every page still
   works without JS; this file adds motion, theme, DB-backed widgets, and
   the bounce/confetti feedback system.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  // The pages are static, so they can be hosted somewhere without a Worker
  // (GitHub Pages). There the API lives on the deployed Worker instead.
  var API_ORIGIN = "https://site-70c8da266b74437b9066daf6785f9b11.freebuff.page";
  var API = (function () {
    if (window.__PORTFOLIO_API__) return window.__PORTFOLIO_API__;
    if (/(^|\.)github\.io$/i.test(location.hostname)) return API_ORIGIN + "/api";
    return "/api";
  })();
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------------- theme */
  var THEME_KEY = "omar-theme";
  function readTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f7f5f2" : "#06060a");
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }
  (function initTheme() {
    var saved = readTheme();
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(saved || (prefersLight ? "light" : "dark"));
  })();

  function toggleTheme(originEl) {
    var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(function () { applyTheme(next); });
    } else {
      applyTheme(next);
    }
    toast(next === "light" ? "☀️ Light mode" : "🌙 Dark mode", "Theme switched");
    if (originEl) originEl.animate(
      [{ transform: "rotate(0deg) scale(1)" }, { transform: "rotate(180deg) scale(1.15)" }, { transform: "rotate(360deg) scale(1)" }],
      { duration: 620, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
  }
  $$("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () { toggleTheme(btn); });
  });

  function setYear() {
    $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* --------------------------------------------------------------- toasts */
  var toastHost = null;
  function toast(icon, text, ms) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toasts";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var el = document.createElement("div");
    el.className = "toast";
    var i = document.createElement("span");
    i.className = "toast__icon";
    i.textContent = icon;
    var t = document.createElement("span");
    t.textContent = text;
    el.appendChild(i);
    el.appendChild(t);
    toastHost.appendChild(el);
    var life = ms || 3200;
    var kill = function () {
      el.classList.add("is-out");
      setTimeout(function () { el.remove(); }, 360);
    };
    setTimeout(kill, life);
    el.addEventListener("click", kill);
    return el;
  }

  /* -------------------------------------------------------------- confetti */
  var canvas = null, ctx = null, particles = [], raf = 0;
  function confetti(x, y, opts) {
    if (reduceMotion) return;
    opts = opts || {};
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti";
      document.body.appendChild(canvas);
      ctx = canvas.getContext("2d");
      window.addEventListener("resize", sizeCanvas);
      sizeCanvas();
    }
    var colors = ["#8b5cf6", "#ec4899", "#22d3ee", "#a3e635", "#fbbf24", "#ffffff"];
    var count = opts.count || 42;
    for (var n = 0; n < count; n++) {
      var angle = (Math.PI * 2 * n) / count + Math.random() * 0.5;
      var speed = 3 + Math.random() * (opts.power || 7);
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function sizeCanvas() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function step() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += 0.22;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.012;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (particles.length) {
      raf = requestAnimationFrame(step);
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }
  function burstFrom(el) {
    if (!el) return confetti(window.innerWidth / 2, window.innerHeight / 2);
    var r = el.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
  }

  /* ------------------------------------------------------ scroll progress */
  var progress = $(".progress");
  var navWrap = $(".nav-wrap");
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
    if (progress) progress.style.transform = "scaleX(" + p.toFixed(4) + ")";
    if (navWrap) navWrap.classList.toggle("is-stuck", h.scrollTop > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------------------------------------------------- scroll reveals */
  function initReveals() {
    var items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var group = el.closest("[data-reveal-group]");
        if (group && !el.style.getPropertyValue("--reveal-delay")) {
          var sibs = $$("[data-reveal]", group);
          var idx = sibs.indexOf(el);
          el.style.setProperty("--reveal-delay", Math.min(idx, 8) * 70 + "ms");
        }
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------- hero headline */
  function splitHeroTitle() {
    $$("[data-split]").forEach(function (el) {
      var text = el.textContent.trim();
      el.textContent = "";
      text.split(/\s+/).forEach(function (word, i) {
        var outer = document.createElement("span");
        outer.className = "word";
        var inner = document.createElement("span");
        inner.textContent = word;
        inner.style.setProperty("--i", String(i));
        outer.appendChild(inner);
        el.appendChild(outer);
        el.appendChild(document.createTextNode(" "));
      });
    });
  }

  /* ----------------------------------------------------- rotating phrase */
  function initRotator() {
    var el = $("[data-rotate]");
    if (!el) return;
    var words;
    try { words = JSON.parse(el.getAttribute("data-rotate")); } catch (e) { return; }
    if (!Array.isArray(words) || !words.length) return;
    if (reduceMotion) { el.textContent = words[0]; return; }

    var wrap = document.createElement("span");
    wrap.className = "grad-text";
    el.textContent = "";
    el.appendChild(wrap);
    var w = 0, char = 0, deleting = false;

    function tick() {
      var full = words[w % words.length];
      char += deleting ? -1 : 1;
      wrap.textContent = full.slice(0, char);
      var wait = deleting ? 42 : 78;
      if (!deleting && char === full.length) { deleting = true; wait = 1700; }
      else if (deleting && char === 0) { deleting = false; w++; wait = 320; }
      setTimeout(tick, wait);
    }
    tick();
  }

  /* --------------------------------------------------------- cursor glow */
  function initSpotlight() {
    if (!finePointer || reduceMotion) return;
    var dot = document.createElement("div");
    dot.className = "spotlight";
    document.body.appendChild(dot);
    var tx = 0, ty = 0, cx = 0, cy = 0, visible = false;
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!visible) { dot.classList.add("is-on"); visible = true; cx = tx; cy = ty; }
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      dot.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------------------------------------------- magnetic buttons */
  function initMagnets() {
    if (!finePointer || reduceMotion) return;
    $$("[data-magnet]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnet")) || 0.28;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        el.style.transform = "translate(" + (mx * strength).toFixed(1) + "px," + (my * strength).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ------------------------------------------------------- card 3D tilt */
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $$("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 7;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "perspective(900px) rotateX(" + (-py * max).toFixed(2) + "deg) rotateY(" + (px * max).toFixed(2) + "deg) translateY(-4px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ----------------------------------------------------------- counters */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;
    var suffix = el.getAttribute("data-count-suffix") || "";
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var start = performance.now();
    var dur = 1400;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function initCounters() {
    var els = $$("[data-count]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(animateCount); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animateCount(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }
  function initSkillBars() {
    var bars = $$(".skill");
    if (!bars.length) return;
    if (!("IntersectionObserver" in window)) { bars.forEach(function (b) { b.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var idx = $$(".skill").indexOf(el);
        setTimeout(function () { el.classList.add("is-in"); }, Math.min(idx, 10) * 90);
        io.unobserve(el);
      });
    }, { threshold: 0.35 });
    bars.forEach(function (b) { io.observe(b); });
  }

  /* ------------------------------------------------------------- nav/menu */
  function initNav() {
    var toggle = $("[data-nav-toggle]");
    var sheet = $("[data-nav-sheet]");
    if (!toggle || !sheet) return;
    var setOpen = function (open) {
      sheet.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        var first = sheet.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      }
    };
    toggle.addEventListener("click", function () {
      setOpen(!sheet.classList.contains("is-open"));
    });
    $$("a", sheet).forEach(function (a, i) {
      a.style.setProperty("--i", String(i));
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }
  function markCurrentPage() {
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".nav__link, .nav__mobile a").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop().split("#")[0];
      if (href && decodeURIComponent(href) === decodeURIComponent(here)) {
        a.setAttribute("aria-current", "page");
      }
    });
  }

  /* ----------------------------------------------------------- the modal */
  var modal = null, lastFocus = null;
  function ensureModal() {
    if (modal) return modal;
    modal = $("[data-modal]");
    if (!modal) return null;
    modal.setAttribute("aria-hidden", "true");
    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.closest("[data-modal-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });
    return modal;
  }
  function openModal() {
    var m = ensureModal();
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var focusable = m.querySelector("[data-modal-close], .btn, button");
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 80);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $$("[data-modal-open]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
  });
  function maybeAutoPopup() {
    var m = ensureModal();
    if (!m || !m.hasAttribute("data-auto")) return;
    var KEY = "omar-welcome-v1";
    var seen = null;
    try { seen = localStorage.getItem(KEY); } catch (e) { return; }
    if (seen) return;
    setTimeout(function () {
      openModal();
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
    }, 2600);
  }

  /* -------------------------------------------------------------- API glue */
  function api(path, options) {
    if (typeof fetch !== "function") return Promise.reject(new Error("fetch unavailable"));
    return fetch(API + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin"
    }, options || {})).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function initStats() {
    var visitEls = $$("[data-visits]");
    if (!visitEls.length) return;
    api("/visit", { method: "POST" }).then(function (data) {
      visitEls.forEach(function (el) { el.textContent = formatNum(data.visits); });
    }).catch(function () {
      visitEls.forEach(function (el) { el.textContent = "—"; });
    });
  }
  function formatNum(n) {
    return typeof n === "number" ? n.toLocaleString("en-US") : String(n);
  }

  function initLikes() {
    var buttons = $$("[data-like]");
    if (!buttons.length) return;
    api("/stats").then(function (data) {
      buttons.forEach(function (btn) {
        var key = btn.getAttribute("data-like");
        btn.setAttribute("data-server", "1");
        var count = (data.likes && data.likes[key]) || 0;
        var c = $(".like-btn__count", btn);
        if (c) { c.textContent = formatNum(count); c.dataset.value = String(count); }
        if (localStorage.getItem("omar-liked-" + key)) btn.classList.add("is-liked");
      });
    }).catch(function () { /* offline: keep the emoji state only */ });

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-like");
        var countEl = $(".like-btn__count", btn);
        var liked = btn.classList.toggle("is-liked");
        btn.classList.remove("is-popping");
        void btn.offsetWidth;
        btn.classList.add("is-popping");
        try {
          if (liked) localStorage.setItem("omar-liked-" + key, "1");
          else localStorage.removeItem("omar-liked-" + key);
        } catch (e) {}
        if (liked) {
          burstFrom(btn);
          toast("❤️", "Thanks for the love!");
        }
        if (!btn.hasAttribute("data-server")) return;
        api("/like", {
          method: "POST",
          body: JSON.stringify({ project: key, delta: liked ? 1 : -1 })
        }).then(function (data) {
          var v = (data.likes && data.likes[key]) || 0;
          if (countEl) countEl.textContent = formatNum(v);
        }).catch(function () {
          toast("⚠️", "Couldn't save that like — try again.");
        });
      });
    });
  }

  /* ---------------------------------------------------------- guestbook */
  function timeAgo(iso) {
    var then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    var s = Math.max(1, Math.floor((Date.now() - then) / 1000));
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 30) return d + "d ago";
    return new Date(then).toLocaleDateString();
  }

  function renderGuests(container, items) {
    container.textContent = "";
    if (!items || !items.length) {
      var empty = document.createElement("div");
      empty.className = "guest-empty";
      empty.textContent = "No notes yet — be the first to leave one ✨";
      container.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "guest";

      var head = document.createElement("div");
      head.className = "guest__head";

      var name = document.createElement("span");
      name.className = "guest__name";
      var avatar = document.createElement("span");
      avatar.className = "guest__avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = (item.name || "?").trim().charAt(0).toUpperCase() || "?";
      var nameText = document.createElement("span");
      nameText.textContent = item.name || "Anonymous";
      name.appendChild(avatar);
      name.appendChild(nameText);

      var time = document.createElement("span");
      time.className = "guest__time";
      time.textContent = timeAgo(item.created_at);

      var body = document.createElement("p");
      body.className = "guest__body";
      body.textContent = item.message || "";

      head.appendChild(name);
      head.appendChild(time);
      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function initGuestbook() {
    var list = $("[data-guestbook-list]");
    var form = $("[data-guestbook-form]");
    if (list) {
      api("/messages?kind=guestbook&limit=12").then(function (data) {
        renderGuests(list, data.items);
      }).catch(function () { /* leave the empty state */ });
    }
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameField = form.elements.name;
      var msgField = form.elements.message;
      var ok = true;
      if (!nameField.value.trim() || nameField.value.trim().length < 2) {
        flag(nameField, "Please tell us your name (2+ characters)");
        ok = false;
      }
      if (!msgField.value.trim() || msgField.value.trim().length < 4) {
        flag(msgField, "Write at least 4 characters");
        ok = false;
      }
      if (!ok) return;

      var btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      api("/messages", {
        method: "POST",
        body: JSON.stringify({
          name: nameField.value.trim(),
          message: msgField.value.trim(),
          kind: "guestbook"
        })
      }).then(function (data) {
        form.reset();
        toast("🎉", "Your note is live. Thank you!");
        burstFrom(btn);
        if (list) {
          if (data.item) {
            var existing = list.querySelector(".guest-empty");
            if (existing) existing.remove();
            var wrap = document.createElement("div");
            renderGuests(wrap, [data.item]);
            list.insertBefore(wrap.firstChild, list.firstChild);
          } else {
            return api("/messages?kind=guestbook&limit=12").then(function (d) { renderGuests(list, d.items); });
          }
        }
      }).catch(function () {
        toast("⚠️", "Couldn't reach the server. Please try again.");
      }).then(function () { setLoading(btn, false); });
    });
  }

  function flag(field, message) {
    var wrap = field.closest(".field");
    if (!wrap) return;
    wrap.classList.remove("is-invalid");
    void wrap.offsetWidth;
    wrap.classList.add("is-invalid");
    var err = wrap.querySelector(".field__error");
    if (err) err.textContent = message;
    field.focus({ preventScroll: false });
    field.addEventListener("input", function handler() {
      wrap.classList.remove("is-invalid");
      field.removeEventListener("input", handler);
    });
  }
  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
    var label = btn.querySelector("[data-label]");
    if (label) label.textContent = on ? "Sending…" : (label.getAttribute("data-idle") || "Send");
  }

  /* ------------------------------------------------------- contact form */
  function initContactForm() {
    var form = $("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var email = form.elements.email;
      var message = form.elements.message;
      var ok = true;

      if (!name.value.trim() || name.value.trim().length < 2) { flag(name, "Please enter your name"); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { flag(email, "That email doesn't look right"); ok = false; }
      if (!message.value.trim() || message.value.trim().length < 10) { flag(message, "A little more detail (10+ characters)"); ok = false; }
      if (!ok) return;

      var btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      api("/messages", {
        method: "POST",
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          message: message.value.trim(),
          kind: "contact"
        })
      }).then(function () {
        form.reset();
        setLoading(btn, false);
        var label = btn.querySelector("[data-label]");
        if (label) label.textContent = "Sent ✓";
        toast("✅", "Message received — I'll reply soon!");
        burstFrom(btn);
        setTimeout(function () {
          if (label) label.textContent = label.getAttribute("data-idle") || "Send message";
        }, 2600);
      }).catch(function () {
        setLoading(btn, false);
        toast("⚠️", "Something went wrong. Email me directly instead.");
      });
    });
  }

  /* --------------------------------------------------------------- RSVP */
  function initRsvp() {
    var form = $("[data-rsvp-form]");
    if (!form) return;
    var counter = $("[data-rsvp-count]");
    var refresh = function () {
      api("/messages?kind=rsvp&limit=1").then(function (data) {
        if (counter) counter.textContent = formatNum(data.total || 0);
      }).catch(function () {
        if (counter) counter.textContent = "—";
      });
    };
    refresh();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.elements.name;
      if (!name.value.trim() || name.value.trim().length < 2) {
        flag(name, "Your name, please!");
        return;
      }
      var btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      api("/messages", {
        method: "POST",
        body: JSON.stringify({
          name: name.value.trim(),
          message: "is coming to the party 🎈",
          kind: "rsvp"
        })
      }).then(function () {
        form.reset();
        setLoading(btn, false);
        toast("🎈", "You're on the list! See you on 28 May.");
        burstFrom(btn);
        refresh();
      }).catch(function () {
        setLoading(btn, false);
        toast("⚠️", "RSVP didn't save — please try again.");
      });
    });
  }

  /* ------------------------------------------------------------ copy text */
  function initCopy() {
    $$("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-copy");
        var done = function () {
          toast("📋", "Copied: " + value);
          btn.animate(
            [{ transform: "scale(1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
            { duration: 380, easing: "cubic-bezier(.34,1.56,.64,1)" }
          );
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done).catch(function () { toast("⚠️", "Copy failed — select it manually."); });
        } else {
          var t = document.createElement("textarea");
          t.value = value;
          document.body.appendChild(t);
          t.select();
          try { document.execCommand("copy"); done(); } catch (e) { toast("⚠️", "Copy failed."); }
          t.remove();
        }
      });
    });
  }

  /* ----------------------------------------------------------- countdown */
  function initCountdown() {
    var root = $("[data-countdown]");
    if (!root) return;
    var target = new Date(root.getAttribute("data-countdown") + "T00:00:00");
    var cells = {
      days: $("[data-cd=days]"), hours: $("[data-cd=hours]"),
      minutes: $("[data-cd=minutes]"), seconds: $("[data-cd=seconds]")
    };
    var tick = function () {
      var now = new Date();
      if (isNaN(target.getTime())) return;
      // numeric constructor: avoids non-ISO strings like "2026-5-28" that some engines reject
      var next = new Date(now.getFullYear(), target.getMonth(), target.getDate());
      if (next.getTime() <= now.getTime()) next.setFullYear(next.getFullYear() + 1);
      var diff = Math.max(0, next.getTime() - now.getTime());
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var pad = function (n) { return String(n).padStart(2, "0"); };
      if (cells.days) cells.days.textContent = String(d);
      if (cells.hours) cells.hours.textContent = pad(h);
      if (cells.minutes) cells.minutes.textContent = pad(m);
      if (cells.seconds) cells.seconds.textContent = pad(s);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------ balloons */
  function initBalloons() {
    var host = $(".balloons");
    if (!host || reduceMotion) return;
    var colors = ["#ec4899", "#8b5cf6", "#fbbf24", "#22d3ee", "#a3e635", "#fb7185"];
    for (var i = 0; i < 10; i++) {
      var b = document.createElement("i");
      b.style.left = 4 + Math.random() * 92 + "%";
      b.style.background = "radial-gradient(circle at 32% 28%, rgba(255,255,255,.65), " + colors[i % colors.length] + " 62%)";
      b.style.animationDuration = 14 + Math.random() * 12 + "s";
      b.style.animationDelay = -Math.random() * 18 + "s";
      b.style.transform = "scale(" + (0.6 + Math.random() * 0.7) + ")";
      host.appendChild(b);
    }
  }

  /* -------------------------------------------------------------- reveal on scroll cue */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (!id || id === "#") return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", id);
      });
    });
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    setYear();
    splitHeroTitle();
    markCurrentPage();
    initNav();
    initAnchors();
    initReveals();
    initRotator();
    initSpotlight();
    initMagnets();
    initTilt();
    initCounters();
    initSkillBars();
    initCopy();
    initStats();
    initLikes();
    initGuestbook();
    initContactForm();
    initRsvp();
    initCountdown();
    initBalloons();
    onScroll();
    maybeAutoPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
