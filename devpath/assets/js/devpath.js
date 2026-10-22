/* ==========================================================================
   ZeroStack — behaviour layer
   Vanilla JS. Progressive enhancement: every page reads, links and teaches
   correctly with this file blocked. This adds the curriculum rendering, saved
   progress, theme, motion and the command palette.
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.ZS;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var KEY = "zerostack.progress.v1";
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var pad = function (n) { return String(n).length < 2 ? "0" + n : String(n); };

  /* ---------------------------------------------------------------- store */
  var state = (function () {
    var fallback = { lessons: {}, pace: 10, started: null };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return {
        lessons: parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {},
        pace: Number(parsed.pace) || 10,
        started: parsed.started || null
      };
    } catch (error) {
      return fallback;
    }
  })();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* private mode */ }
  }

  function isDone(id) { return state.lessons[id] === true; }

  function stageDone(stage) {
    var done = 0;
    stage.lessons.forEach(function (lesson) { if (isDone(lesson.id)) done++; });
    return done;
  }

  function stagePct(stage) {
    return Math.round((stageDone(stage) / stage.lessons.length) * 100);
  }

  function doneLessons() {
    var n = 0;
    DATA.STAGES.forEach(function (stage) { n += stageDone(stage); });
    return n;
  }

  function doneHours() {
    var hours = 0;
    DATA.STAGES.forEach(function (stage) {
      hours += stage.hours * (stageDone(stage) / stage.lessons.length);
    });
    return hours;
  }

  function overallPct() {
    return Math.round((doneLessons() / DATA.TOTAL_LESSONS) * 100);
  }

  /* ------------------------------------------------------------------ ui */
  function toast(message, strong) {
    var host = $(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (strong ? "<b>" + esc(strong) + "</b> " : "") + esc(message);
    host.appendChild(el);
    window.setTimeout(function () {
      el.classList.add("toast--out");
      window.setTimeout(function () { el.remove(); }, 400);
    }, 2900);
  }

  function confetti() {
    if (reduceMotion) return;
    var colors = ["#e8441f", "#ffd34d", "#1f5fd0", "#7c3aed", "#0f766e"];
    for (var i = 0; i < 26; i++) {
      var bit = document.createElement("i");
      bit.className = "confetti-bit";
      bit.style.background = colors[i % colors.length];
      bit.style.left = 50 + (Math.random() * 20 - 10) + "vw";
      bit.style.top = "58vh";
      document.body.appendChild(bit);
      var fly = bit.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          {
            transform: "translate(" + (Math.random() * 320 - 160) + "px," + -(120 + Math.random() * 220) + "px) rotate(" + (Math.random() * 540 - 270) + "deg)",
            opacity: 0
          }
        ],
        { duration: 1100 + Math.random() * 700, easing: "cubic-bezier(0.16,1,0.3,1)" }
      );
      fly.onfinish = (function (node) { return function () { node.remove(); }; })(bit);
    }
  }

  /* --------------------------------------------------------------- theme */
  function initTheme() {
    $$("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("zerostack.theme", next); } catch (error) { /* ignore */ }
        button.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
      });
    });
  }

  /* ---------------------------------------------------------------- nav */
  function initNav() {
    var wrap = $(".nav-wrap");
    var readbar = $(".readbar");
    var sheet = $(".nav-sheet");
    var toggle = $("[data-nav-toggle]");

    function onScroll() {
      var y = window.scrollY || 0;
      if (wrap) wrap.classList.toggle("is-stuck", y > 12);
      if (readbar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        readbar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function closeSheet() {
      if (!sheet || !toggle) return;
      sheet.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    if (toggle && sheet) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", open ? "false" : "true");
        sheet.classList.toggle("is-open", !open);
        document.body.style.overflow = open ? "" : "hidden";
      });
      $$("a", sheet).forEach(function (link) { link.addEventListener("click", closeSheet); });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeSheet();
      });
    }

    // mark the current page in the nav
    var file = location.pathname.split("/").pop() || "index.html";
    $$(".nav__link, .footer__links a, .nav-sheet a").forEach(function (link) {
      var target = (link.getAttribute("href") || "").split("#")[0];
      if (target && target === file) link.setAttribute("aria-current", "page");
    });
  }

  /* ------------------------------------------------------------- motion */
  function initReveal() {
    var items = $$("[data-reveal]");
    if (!items.length) return;

    // stagger siblings inside a group so lists don't all land at once
    $$("[data-reveal]").forEach(function (el) {
      var siblings = $$("[data-reveal]", el.parentElement).filter(function (s) { return s.parentElement === el.parentElement; });
      var index = siblings.indexOf(el);
      if (index > 0) el.style.setProperty("--d", Math.min(index * 80, 400) + "ms");
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    items.forEach(function (el) { observer.observe(el); });
  }

  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(node) {
      var target = Number(node.dataset.count) || 0;
      var suffix = node.dataset.countSuffix || "";
      if (reduceMotion) { node.textContent = target + suffix; return; }
      var start = performance.now();
      var duration = 1200;
      function tick(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if (!("IntersectionObserver" in window)) { nodes.forEach(run); return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    nodes.forEach(function (node) { observer.observe(node); });
  }

  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $$("[data-tilt]").forEach(function (el) {
      var max = Number(el.dataset.tilt) || 6;
      el.addEventListener("pointermove", function (event) {
        var box = el.getBoundingClientRect();
        var x = (event.clientX - box.left) / box.width - 0.5;
        var y = (event.clientY - box.top) / box.height - 0.5;
        el.style.transform = "perspective(900px) rotateX(" + (-y * max) + "deg) rotateY(" + (x * max) + "deg)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* --------------------------------------------------------- page: home */
  function renderHome() {
    var list = $("[data-path-list]");
    if (list && DATA) {
      list.innerHTML = DATA.STAGES.map(function (stage) {
        return (
          '<a class="path__row" data-reveal href="roadmap.html#stage-' + stage.id + '">' +
            '<span class="path__no">' + pad(stage.n) + "</span>" +
            '<span class="path__body">' +
              '<span class="path__title">' + esc(stage.title) + "</span>" +
              '<span class="path__meta">' +
                '<span class="path__phase">' + esc(stage.phaseInfo.name) + "</span>" +
                "<small>" + esc(stage.weeks) + "</small>" +
                "<small>· " + stage.hours + "h</small>" +
              "</span>" +
            "</span>" +
            '<span class="path__go" aria-hidden="true">→</span>' +
          "</a>"
        );
      }).join("");
    }

    var phases = $("[data-phases]");
    if (phases && DATA) {
      phases.innerHTML = DATA.PHASES.map(function (phase) {
        var stages = DATA.STAGES.filter(function (s) { return s.phase === phase.id; });
        return (
          '<article class="phase" data-reveal style="--phase-c:' + phase.accent + '">' +
            '<span class="phase__no">' + phase.no + "</span>" +
            '<h3 class="phase__name">' + esc(phase.name) + "</h3>" +
            '<span class="phase__weeks">' + esc(phase.weeks) + "</span>" +
            '<p class="phase__blurb">' + esc(phase.blurb) + "</p>" +
            '<div class="phase__stages">' +
              stages.map(function (s) { return "<span>" + pad(s.n) + "</span>"; }).join("") +
            "</div>" +
          "</article>"
        );
      }).join("");
    }

    // the hero log card animates its own bar once on load
    var bar = $("[data-log-bar]");
    if (bar) window.setTimeout(function () { bar.style.width = bar.dataset.logBar + "%"; }, 500);
  }

  /* ------------------------------------------------------ page: roadmap */
  function lessonHTML(lesson) {
    return (
      '<li class="lesson">' +
        '<input type="checkbox" id="' + lesson.id + '" data-lesson="' + lesson.id + '"' + (isDone(lesson.id) ? " checked" : "") + ">" +
        '<label class="lesson__box" for="' + lesson.id + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>' +
        "</label>" +
        '<span class="lesson__text">' +
          '<label class="lesson__title" for="' + lesson.id + '">' + esc(lesson.t) + "</label>" +
          '<span class="lesson__desc">' + esc(lesson.d) + "</span>" +
        "</span>" +
      "</li>"
    );
  }

  function stageHTML(stage) {
    var phase = stage.phaseInfo;
    return (
      '<article class="stage" id="stage-' + stage.id + '" data-stage="' + stage.id + '" data-phase="' + stage.phase + '">' +
        '<button class="stage__head" type="button" data-stage-toggle aria-expanded="false" aria-controls="panel-' + stage.id + '">' +
          '<span class="stage__no" aria-hidden="true">' + pad(stage.n) + "</span>" +
          "<span>" +
            '<span class="stage__title">' + esc(stage.title) + "</span>" +
            '<span class="stage__meta">' +
              "<b>" + esc(phase.name) + "</b>" +
              "<span>" + esc(stage.weeks) + "</span><span>·</span>" +
              "<span>" + stage.hours + "h</span><span>·</span>" +
              "<span>" + stage.lessons.length + " lessons</span>" +
            "</span>" +
          "</span>" +
          '<span class="stage__right">' +
            '<span class="stage__pct" data-stage-pct>0%</span>' +
            '<svg class="stage__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
          "</span>" +
        "</button>" +
        '<div class="stage__panel" id="panel-' + stage.id + '" role="region" aria-label="' + esc(stage.title) + '">' +
          '<div class="stage__inner"><div class="stage__body">' +
            '<p class="stage__outcome"><strong>By the end:</strong> ' + esc(stage.outcome) + "</p>" +
            '<p class="block-label">Lessons</p>' +
            '<ul class="lessons">' + stage.lessons.map(lessonHTML).join("") + "</ul>" +
            '<div class="concepts">' + stage.concepts.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + "</div>" +
            '<div class="buildbox">' +
              "<h4>Build <span>· stage " + pad(stage.n) + "</span></h4>" +
              "<h4>" + esc(stage.build.title) + "</h4>" +
              "<p>" + esc(stage.build.desc) + "</p>" +
            "</div>" +
            '<div class="resources">' +
              stage.resources.map(function (r) {
                return '<a class="res" href="' + r.url + '" target="_blank" rel="noopener noreferrer">' + esc(r.label) +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>';
              }).join("") +
            "</div>" +
          "</div></div>" +
        "</div>" +
      "</article>"
    );
  }

  function initRoadmap() {
    var host = $("[data-stages]");
    if (!host || !DATA) return;

    host.innerHTML = DATA.STAGES.map(stageHTML).join("");

    var ring = $(".ring__fill");
    var circumference = 2 * Math.PI * 34;
    if (ring) ring.style.strokeDasharray = circumference.toFixed(1);

    var railList = $("[data-rail-list]");
    if (railList) {
      railList.innerHTML = DATA.STAGES.map(function (stage) {
        return (
          '<li><a class="rail__link" href="#stage-' + stage.id + '" data-rail="' + stage.id + '">' +
            "<span>" + pad(stage.n) + ". " + esc(stage.title) + "</span>" +
            "<b data-rail-pct>0%</b>" +
          "</a></li>"
        );
      }).join("");
    }

    function refresh() {
      var pct = overallPct();
      if (ring) ring.style.strokeDashoffset = (circumference * (1 - pct / 100)).toFixed(1);
      var pctLabel = $("[data-overall-pct]");
      if (pctLabel) pctLabel.textContent = pct + "%";
      var countLabel = $("[data-overall-count]");
      if (countLabel) {
        countLabel.textContent = doneLessons() + " of " + DATA.TOTAL_LESSONS + " lessons done";
      }

      DATA.STAGES.forEach(function (stage) {
        var card = $('[data-stage="' + stage.id + '"]');
        if (!card) return;
        var p = stagePct(stage);
        card.classList.toggle("is-done", p === 100);
        var chip = $("[data-stage-pct]", card);
        if (chip) chip.textContent = p + "%";
        var rail = $('[data-rail="' + stage.id + '"]');
        if (rail) {
          var railPct = $("[data-rail-pct]", rail);
          if (railPct) railPct.textContent = p + "%";
          rail.classList.toggle("is-done", p === 100);
        }
      });

      updatePace();
    }

    function updatePace() {
      var out = $("[data-pace-out]");
      var select = $("[data-pace]");
      if (!out || !select) return;
      var pace = Number(select.value) || 10;
      state.pace = pace;
      var remaining = Math.max(DATA.TOTAL_HOURS - doneHours(), 0);
      if (remaining <= 0) {
        out.innerHTML = "<strong>Finished.</strong> Every lesson in the path is done — go build the capstone.";
        return;
      }
      var weeks = Math.ceil(remaining / pace);
      var finish = new Date(Date.now() + weeks * 7 * 24 * 3600 * 1000);
      var label = finish.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      out.innerHTML = "≈ <strong>" + weeks + " weeks</strong> left · around <strong>" + esc(label) + "</strong>";
    }

    // open / close a stage
    host.addEventListener("click", function (event) {
      var head = event.target.closest("[data-stage-toggle]");
      if (!head) return;
      var card = head.closest(".stage");
      var open = card.classList.toggle("is-open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // tick a lesson
    host.addEventListener("change", function (event) {
      var input = event.target.closest("[data-lesson]");
      if (!input) return;
      var id = input.dataset.lesson;
      if (input.checked) state.lessons[id] = true;
      else delete state.lessons[id];

      var stage = DATA.STAGES.filter(function (s) {
        return s.lessons.some(function (l) { return l.id === id; });
      })[0];

      if (stage && stagePct(stage) === 100 && input.checked) {
        confetti();
        toast(stage.title + " complete", "Stage done →");
      }
      refresh();
      save();
    });

    // filters
    $$("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.dataset.filter;
        $$("[data-filter]").forEach(function (other) {
          var active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        $$(".stage").forEach(function (card) {
          card.hidden = filter !== "all" && card.dataset.phase !== filter;
        });
      });
    });

    // pace + actions
    var select = $("[data-pace]");
    if (select) {
      select.value = String(state.pace || 10);
      select.addEventListener("change", function () { updatePace(); save(); });
    }

    var reset = $("[data-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        if (!window.confirm("Clear all saved progress? This can't be undone.")) return;
        state.lessons = {};
        save();
        $$("[data-lesson]").forEach(function (input) { input.checked = false; });
        refresh();
        toast("Progress cleared");
      });
    }

    var exportBtn = $("[data-export]");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        var payload = JSON.stringify({ exported: new Date().toISOString(), lessons: Object.keys(state.lessons), pace: state.pace }, null, 2);
        var blob = new Blob([payload], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "zerostack-progress.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast("Progress exported");
      });
    }

    var nextBtn = $("[data-next]");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        var next = DATA.STAGES.filter(function (s) { return stagePct(s) < 100; })[0];
        if (!next) { toast("You've finished every stage. Time to build."); return; }
        var card = $('[data-stage="' + next.id + '"]');
        if (!card) return;
        if (!card.classList.contains("is-open")) {
          card.classList.add("is-open");
          $("[data-stage-toggle]", card).setAttribute("aria-expanded", "true");
        }
        card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        var firstUnchecked = $("[data-lesson]", card);
        if (firstUnchecked) window.setTimeout(function () { firstUnchecked.focus({ preventScroll: true }); }, 600);
      });
    }

    refresh();

    // deep link: /roadmap.html#stage-sql-and-data opens that stage
    if (location.hash) {
      var target = $(location.hash);
      if (target && target.classList.contains("stage")) {
        target.classList.add("is-open");
        var button = $("[data-stage-toggle]", target);
        if (button) button.setAttribute("aria-expanded", "true");
        window.setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 250);
      }
    }

    // highlight the stage you're reading in the rail
    if ("IntersectionObserver" in window) {
      var railObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          $$(".rail__link").forEach(function (link) { link.classList.remove("is-active"); });
          var active = $('[data-rail="' + entry.target.dataset.stage + '"]');
          if (active) active.classList.add("is-active");
        });
      }, { rootMargin: "-30% 0px -55% 0px" });
      $$(".stage").forEach(function (card) { railObserver.observe(card); });
    }
  }

  /* ----------------------------------------------------- page: projects */
  function initProjects() {
    var host = $("[data-project-grid]");
    if (!host || !DATA) return;

    host.innerHTML = DATA.PROJECTS.map(function (project) {
      var stage = DATA.STAGES.filter(function (s) { return s.n === project.stage; })[0];
      return (
        '<article class="project" id="proj-' + project.id + '" data-level="' + project.level + '" data-reveal>' +
          '<div class="project__top">' +
            '<span class="project__level" data-level="' + project.level + '">' + esc(project.level) + "</span>" +
            '<span class="project__stage">stage ' + pad(project.stage) + " · " + esc(project.time) + "</span>" +
          "</div>" +
          '<h3 class="project__title">' + esc(project.title) + "</h3>" +
          '<p class="project__brief">' + esc(project.brief) + "</p>" +
          '<div class="project__section">' +
            '<p class="block-label">Must have</p>' +
            '<ul class="project__list">' + project.must.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</ul>" +
          "</div>" +
          '<div class="project__section">' +
            '<p class="block-label">If you have time</p>' +
            '<ul class="project__list">' + project.stretch.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</ul>" +
          "</div>" +
          '<div class="project__stack">' + project.stack.map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</div>" +
          '<p class="project__done"><b>Done when</b><span>' + esc(project.done) + "</span></p>" +
          (stage ? '<p class="progress-note">Taught in <a href="roadmap.html#stage-' + stage.id + '">stage ' + pad(stage.n) + " · " + esc(stage.title) + "</a></p>" : "") +
        "</article>"
      );
    }).join("");

    $$("[data-level-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.dataset.levelFilter;
        $$("[data-level-filter]").forEach(function (other) {
          var active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        $$(".project").forEach(function (card) {
          card.hidden = filter !== "all" && card.dataset.level !== filter;
        });
      });
    });
  }

  /* ------------------------------------------------------- command menu */
  function initPalette() {
    var overlay = $("[data-palette]");
    if (!overlay || !DATA) return;

    var input = $("[data-palette-input]", overlay);
    var results = $("[data-palette-results]", overlay);
    var index = [];
    var activeIndex = 0;

    DATA.STAGES.forEach(function (stage) {
      index.push({ title: stage.title, meta: "stage " + pad(stage.n), href: "roadmap.html#stage-" + stage.id });
    });
    DATA.PROJECTS.forEach(function (project) {
      index.push({ title: project.title, meta: "project", href: "projects.html#proj-" + project.id });
    });
    index.push({ title: "The roadmap", meta: "page", href: "roadmap.html" });
    index.push({ title: "Project briefs", meta: "page", href: "projects.html" });
    index.push({ title: "Toolkit & first week", meta: "page", href: "resources.html" });

    function render(query) {
      var q = query.trim().toLowerCase();
      var matches = index.filter(function (item) {
        return !q || (item.title + " " + item.meta).toLowerCase().indexOf(q) > -1;
      }).slice(0, 8);
      activeIndex = 0;

      if (!matches.length) {
        results.innerHTML = '<li class="palette__empty">Nothing matches “' + esc(query) + '”</li>';
        return;
      }
      results.innerHTML = matches.map(function (item, i) {
        return '<li class="palette__item' + (i === 0 ? " is-active" : "") + '" data-href="' + item.href + '">' +
          "<span>" + esc(item.title) + "</span><em>" + esc(item.meta) + "</em></li>";
      }).join("");
    }

    function open() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      input.value = "";
      render("");
      window.setTimeout(function () { input.focus(); }, 30);
    }

    function close() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    function move(step) {
      var items = $$(".palette__item", results);
      if (!items.length) return;
      activeIndex = (activeIndex + step + items.length) % items.length;
      items.forEach(function (item, i) { item.classList.toggle("is-active", i === activeIndex); });
      items[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function go() {
      var active = $(".palette__item.is-active", results);
      if (!active) return;
      location.href = active.dataset.href;
    }

    $$("[data-palette-open]").forEach(function (button) {
      button.addEventListener("click", open);
    });

    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        overlay.classList.contains("is-open") ? close() : open();
      } else if (event.key === "Escape" && overlay.classList.contains("is-open")) {
        close();
      } else if (overlay.classList.contains("is-open")) {
        if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
        else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
        else if (event.key === "Enter") { event.preventDefault(); go(); }
      }
    });

    input.addEventListener("input", function () { render(input.value); });
    results.addEventListener("click", function (event) {
      var item = event.target.closest(".palette__item");
      if (item) location.href = item.dataset.href;
    });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
  }

  /* ------------------------------------------------------------- boot */
  function boot() {
    initTheme();
    initNav();
    initPalette();
    // render first, so the reveal observer also covers cards built from data
    renderHome();
    initRoadmap();
    initProjects();
    initReveal();
    initCounters();
    initTilt();

    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
