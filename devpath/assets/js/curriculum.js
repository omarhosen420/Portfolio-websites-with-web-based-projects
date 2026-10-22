/* ==========================================================================
   ZeroStack — curriculum data
   One source of truth for the roadmap, the project briefs and the landing page.
   No dependencies: this is a plain object on window.ZS.
   ========================================================================== */
window.ZS = (function () {
  "use strict";

  var PHASES = [
    {
      id: "foundations",
      no: "01",
      name: "Foundations",
      weeks: "Weeks 1–5",
      accent: "#e8441f",
      blurb:
        "How the web actually works, markup that holds up without CSS, layouts that survive a phone, and putting a real page online."
    },
    {
      id: "frontend",
      no: "02",
      name: "The front end",
      weeks: "Weeks 6–10",
      accent: "#1f5fd0",
      blurb:
        "JavaScript until it stops being scary — then React, data fetching and the habits that keep a big UI from turning into spaghetti."
    },
    {
      id: "backend",
      no: "03",
      name: "Servers & data",
      weeks: "Weeks 11–18",
      accent: "#7c3aed",
      blurb:
        "Node, REST, SQL, passwords, authorisation and tests. The half of full-stack that most tutorials quietly skip."
    },
    {
      id: "launch",
      no: "04",
      name: "Ship & get hired",
      weeks: "Weeks 19–24",
      accent: "#0f766e",
      blurb:
        "Deployment, CI and monitoring, then the portfolio, case studies and interview reps that turn skill into offers."
    }
  ];

  /* Each lesson is [title, one-line description]. Ids are derived below. */
  var STAGES = [
    {
      n: 1,
      id: "how-the-web-works",
      phase: "foundations",
      title: "How the web actually works",
      weeks: "Week 1",
      hours: 8,
      outcome:
        "Explain what happens between typing a URL and seeing pixels — so the browser stops feeling like magic.",
      concepts: ["DNS", "HTTP", "client vs server", "the DOM"],
      lessons: [
        ["Open the hood", "Open DevTools on a site you use daily and read the request waterfall line by line."],
        ["DNS, TCP and TLS in plain English", "Look up a domain, see where it resolves, and inspect the certificate in the browser."],
        ["Verbs, status codes and headers", "Fire requests with curl; then break a page on purpose and read the 404 and 500."],
        ["Draw the request/response cycle", "Sketch it on paper until you can explain it without notes. Keep the sketch."]
      ],
      build: {
        title: "Browser detective report",
        desc: "A one-page write-up of everything that happens when your own homepage loads: DNS, TLS, HTML, CSS, fonts, images, and what each status code meant."
      },
      resources: [
        ["HTTP overview — MDN", "https://developer.mozilla.org/en-US/docs/Web/HTTP"],
        ["How the web works — MDN", "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works"],
        ["Learn Performance — web.dev", "https://web.dev/learn/performance/"]
      ]
    },
    {
      n: 2,
      id: "html-and-accessibility",
      phase: "foundations",
      title: "HTML & accessibility",
      weeks: "Week 2",
      hours: 10,
      outcome:
        "Write semantic pages that a screen reader, a keyboard and a search engine can all understand.",
      concepts: ["semantics", "forms", "labels", "focus order"],
      lessons: [
        ["The semantic skeleton", "header, nav, main, section, article, footer — and when a div is actually the honest answer."],
        ["Forms that don't fight the user", "Labels tied to inputs, sensible types, validation messages read out loud, autocomplete."],
        ["Alt text, contrast and landmarks", "Write alt text people can use; check contrast with a real tool instead of your eyes."],
        ["Audit with keyboard and Lighthouse", "Tab through your page and fix every place the focus disappears."]
      ],
      build: {
        title: "Screen-reader clean recipe page",
        desc: "A recipe page with exactly one heading per level, labelled controls, and zero keyboard traps. Audit it and save the before/after screenshots."
      },
      resources: [
        ["HTML — MDN", "https://developer.mozilla.org/en-US/docs/Web/HTML"],
        ["Learn Accessibility — web.dev", "https://web.dev/learn/accessibility/"],
        ["The A11Y Project checklist", "https://www.a11yproject.com/checklist/"]
      ]
    },
    {
      n: 3,
      id: "css-and-responsive-layout",
      phase: "foundations",
      title: "CSS & responsive layout",
      weeks: "Weeks 3–4",
      hours: 16,
      outcome:
        "Build a layout that looks deliberate at 360px and at 1440px, using flexbox and grid instead of guesswork.",
      concepts: ["box model", "flexbox", "grid", "container queries"],
      lessons: [
        ["The box model, for real", "Padding, borders, margins and why your width stopped adding up. Then box-sizing and the reset."],
        ["Flexbox for one axis", "Alignment, gaps, wrapping and the three flex mistakes everyone makes in week one."],
        ["Grid for two axes", "Template areas, implicit rows, minmax and auto-fit — the layout factory."],
        ["Fluid type and real breakpoints", "clamp(), rem, and designing between breakpoints rather than at them."],
        ["States and motion", "Hover, focus-visible, active and a transition that makes a click feel finished."],
        ["One design system", "Tokens for colour, spacing and type in :root — then every component reads from them."]
      ],
      build: {
        title: "Clone a pricing section",
        desc: "Pick a pricing block from a product you like and rebuild it from scratch. Compare side by side at four widths and note every difference."
      },
      resources: [
        ["Learn CSS — web.dev", "https://web.dev/learn/css/"],
        ["Flexbox Froggy", "https://flexboxfroggy.com/"],
        ["Grid Garden", "https://cssgridgarden.com/"],
        ["CSS Almanac", "https://css-tricks.com/almanac/"]
      ]
    },
    {
      n: 4,
      id: "git-and-shipping",
      phase: "foundations",
      title: "Git, GitHub & shipping",
      weeks: "Week 5",
      hours: 8,
      outcome:
        "Put your work under version control, survive a merge conflict, and own a live URL you can share.",
      concepts: ["commits", "branches", "pull requests", "static hosting"],
      lessons: [
        ["Commits, branches, and a history that reads", "Small commits with honest messages; branch per experiment."],
        ["Merge conflicts without panic", "Create one on purpose, read the markers, resolve it, and keep both intentions."],
        ["Pull requests and review", "Open a PR against your own repo and review it as if a senior wrote it."],
        ["Deploy a static site", "Ship to GitHub Pages or Cloudflare Pages and check the live URL on your phone."]
      ],
      build: {
        title: "Ship your first live URL",
        desc: "Your own site, public, with a README that says what it is and how to run it. Send it to one person the same day."
      },
      resources: [
        ["Pro Git (free book)", "https://git-scm.com/book/en/v2"],
        ["GitHub Skills", "https://skills.github.com/"],
        ["GitHub Pages docs", "https://docs.github.com/en/pages"],
        ["Cloudflare Pages", "https://developers.cloudflare.com/pages/"]
      ]
    },
    {
      n: 5,
      id: "javascript-core",
      phase: "frontend",
      title: "JavaScript core",
      weeks: "Weeks 6–7",
      hours: 20,
      outcome:
        "Read and write JavaScript that behaves predictably — values, functions, arrays, objects and the DOM.",
      concepts: ["types", "scope", "array methods", "events"],
      lessons: [
        ["Values, types and coercion", "Why '1' + 1 is '11', and the three equality rules worth memorising."],
        ["Functions and scope", "Declarations, arrow functions, closures, and what this actually refers to."],
        ["Arrays and objects", "map, filter, reduce, spread and destructuring — practised, not just watched."],
        ["The DOM: find, change, listen", "querySelector, createElement, addEventListener, and event delegation for lists."],
        ["Debug like an adult", "Breakpoints, watch expressions, the console API, and reading a stack trace."]
      ],
      build: {
        title: "Vanilla todo app",
        desc: "Add, complete, delete and filter todos — no framework, no library. State lives in one array and one render function."
      },
      resources: [
        ["javascript.info", "https://javascript.info/"],
        ["JavaScript — MDN", "https://developer.mozilla.org/en-US/docs/Web/JavaScript"],
        ["freeCodeCamp JS curriculum", "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/"]
      ]
    },
    {
      n: 6,
      id: "async-and-apis",
      phase: "frontend",
      title: "Async, fetch & real APIs",
      weeks: "Week 8",
      hours: 12,
      outcome:
        "Talk to a real API, handle the three states every screen has (loading, error, empty), and keep data across reloads.",
      concepts: ["event loop", "promises", "fetch", "localStorage"],
      lessons: [
        ["The event loop, slowly", "Callbacks, the task queue and why a blocked main thread freezes the page."],
        ["Promises and async/await", "Resolve, reject, try/catch and awaiting more than one thing at a time."],
        ["fetch, JSON and status codes", "Check res.ok, parse once, and never assume the shape of a response."],
        ["Persist state", "localStorage and sessionStorage, quota limits, and storing only what you can rebuild."]
      ],
      build: {
        title: "Search app on a public API",
        desc: "Pick an open API, add search, debounce, a loading skeleton, an honest empty state, a retry on failure, and recent searches that survive a reload."
      },
      resources: [
        ["Async JavaScript — javascript.info", "https://javascript.info/async"],
        ["Fetch — MDN", "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"],
        ["Public APIs list", "https://github.com/public-apis/public-apis"]
      ]
    },
    {
      n: 7,
      id: "react-and-components",
      phase: "frontend",
      title: "React & component thinking",
      weeks: "Weeks 9–10",
      hours: 20,
      outcome:
        "Break a screen into components, pass data with props and state, fetch real data, and route between views.",
      concepts: ["components", "props vs state", "effects", "routing"],
      lessons: [
        ["Components, props and composition", "Build a card once, reuse it ten times, and know when to extract."],
        ["State and events", "useState, controlled inputs, and lifting state to the nearest common parent."],
        ["Effects and data fetching", "useEffect, dependencies, cleanup, and the double-run you'll meet in development."],
        ["Lists, forms and keys", "Rendering arrays, stable keys, and form state that doesn't drift."],
        ["Routing and folder structure", "Routes, layouts, nested pages, and a project layout you can still read at 40 files."]
      ],
      build: {
        title: "Dashboard with three routes",
        desc: "A small React app with a shared layout, a list view, a detail view, a filter, and a clean loading/error story on the data calls."
      },
      resources: [
        ["React docs", "https://react.dev/learn"],
        ["Thinking in React", "https://react.dev/learn/thinking-in-react"],
        ["Vite guide", "https://vite.dev/guide/"],
        ["React Router", "https://reactrouter.com/"]
      ]
    },
    {
      n: 8,
      id: "node-and-rest",
      phase: "backend",
      title: "Node.js & REST APIs",
      weeks: "Weeks 11–13",
      hours: 24,
      outcome:
        "Write an HTTP API with routing, validation and sensible errors — and test it from the terminal.",
      concepts: ["routing", "REST", "validation", "env vars"],
      lessons: [
        ["The Node runtime", "Modules, npm, package.json scripts, and where your code runs when it isn't a browser."],
        ["An HTTP server and routing", "Build one with node:http, then meet Express or Hono and see what they save you."],
        ["REST that makes sense", "Resources, verbs, status codes, pagination — designed on paper before code."],
        ["Validate every input", "Zod schemas, 400 vs 422, and never trusting JSON from the wire."],
        ["CRUD + errors + config", "Read/write endpoints, a central error handler, and secrets that stay in .env."]
      ],
      build: {
        title: "Notes API",
        desc: "Five endpoints with validation, pagination, correct status codes, a health check, and a shell script that exercises all of it."
      },
      resources: [
        ["Node.js learn", "https://nodejs.org/en/learn"],
        ["Express", "https://expressjs.com/"],
        ["Hono", "https://hono.dev/"],
        ["Zod", "https://zod.dev/"]
      ]
    },
    {
      n: 9,
      id: "sql-and-data",
      phase: "backend",
      title: "SQL & data modelling",
      weeks: "Weeks 14–15",
      hours: 16,
      outcome:
        "Design tables that hold real relationships, write joins without copying queries from the internet, and migrate safely.",
      concepts: ["relations", "joins", "indexes", "migrations"],
      lessons: [
        ["Tables, keys and relationships", "Primary, foreign, one-to-many and the many-to-many join table."],
        ["SELECT to GROUP BY", "Filtering, sorting, aggregates, having — the 20% of SQL you'll use 80% of the time."],
        ["Joins in anger", "Inner, left, and the N+1 query you'll accidentally write on day three."],
        ["Schema design and migrations", "Normalise, add constraints, then change a live schema without losing data."],
        ["Connect from Node", "Parameterised queries, connection pooling, transactions, and an ORM you can debug."]
      ],
      build: {
        title: "Blog with users, posts and comments",
        desc: "Three related tables, a seeded dataset, and queries for 'latest posts with author and comment count' that don't melt under a filter."
      },
      resources: [
        ["SQLBolt", "https://sqlbolt.com/"],
        ["PostgreSQL tutorial", "https://www.postgresql.org/docs/current/tutorial.html"],
        ["Prisma docs", "https://www.prisma.io/docs"],
        ["SQLite docs", "https://www.sqlite.org/docs.html"]
      ]
    },
    {
      n: 10,
      id: "auth-security-testing",
      phase: "backend",
      title: "Auth, security & testing",
      weeks: "Weeks 16–18",
      hours: 24,
      outcome:
        "Let people sign in without leaking their data, and prove the important paths still work after you change them.",
      concepts: ["hashing", "sessions", "authorisation", "OWASP"],
      lessons: [
        ["Passwords and hashing", "bcrypt or argon2, salts, and why you never invent your own scheme."],
        ["Sessions vs tokens", "Cookie sessions, JWTs, expiry, refresh, and choosing based on the app you're building."],
        ["Authorisation and ownership", "Every query scoped to the signed-in user — including the ones you think are private."],
        ["The OWASP hits", "Injection, XSS, CSRF, IDOR — with a working exploit for each, then the fix."],
        ["Unit and end-to-end tests", "Vitest for logic, Playwright for the flow that pays the bills, and CI that blocks bad merges."]
      ],
      build: {
        title: "Multi-user app with real logins",
        desc: "Sign up, sign in, sign out, and a page that shows the signed-in user only their own rows. Write a test that proves a second account sees nothing."
      },
      resources: [
        ["OWASP Top 10", "https://owasp.org/www-project-top-ten/"],
        ["OWASP cheat sheets", "https://cheatsheetseries.owasp.org/"],
        ["Vitest", "https://vitest.dev/"],
        ["Playwright", "https://playwright.dev/"]
      ]
    },
    {
      n: 11,
      id: "deploy-ci-observability",
      phase: "launch",
      title: "Deploy, CI & observability",
      weeks: "Weeks 19–20",
      hours: 14,
      outcome:
        "Push a commit and watch it test and deploy itself — then find out what broke before your users tell you.",
      concepts: ["environments", "CI", "logging", "caching"],
      lessons: [
        ["Environments and configuration", "Local, preview and production; env vars, secrets, and databases that don't mix."],
        ["A CI pipeline", "GitHub Actions: install, lint, test, build — with a status badge on the README."],
        ["Deploy the full stack", "One origin or two, custom domains, HTTPS, and what a rollback actually does."],
        ["Logs, errors and performance", "Structured logs, an error tracker, and a Lighthouse budget you keep."]
      ],
      build: {
        title: "Push-to-deploy pipeline",
        desc: "Every push runs tests and deploys. Break a test on purpose to watch the pipeline stop the deploy, then fix it."
      },
      resources: [
        ["GitHub Actions docs", "https://docs.github.com/en/actions"],
        ["Cloudflare Workers", "https://developers.cloudflare.com/workers/"],
        ["Sentry docs", "https://docs.sentry.io/"]
      ]
    },
    {
      n: 12,
      id: "portfolio-and-hiring",
      phase: "launch",
      title: "Portfolio, interviews & the hunt",
      weeks: "Weeks 21–24",
      hours: 14,
      outcome:
        "Present three projects like an engineer, answer the questions you're afraid of, and run a job search that compounds.",
      concepts: ["case studies", "DSA basics", "behavioural stories", "applications"],
      lessons: [
        ["Three case studies, not three screenshots", "Problem, constraints, decisions, trade-offs, what you'd do differently."],
        ["Résumé and GitHub hygiene", "One page, outcomes over tools, pinned repos with real READMEs."],
        ["DSA and the practical round", "Arrays, maps, strings, recursion and complexity — enough to pass, without a year of grinding."],
        ["Behavioural stories and systems", "Six STAR stories, and how to sketch a design when the whiteboard is empty."]
      ],
      build: {
        title: "Portfolio + 50 applications",
        desc: "A live portfolio with three case studies, and a tracker: 50 tailored applications, 10 conversations, honest notes on what worked."
      },
      resources: [
        ["Full-stack roadmap", "https://roadmap.sh/full-stack"],
        ["Tech interview handbook", "https://github.com/yangshun/tech-interview-handbook"],
        ["Frontend Mentor challenges", "https://www.frontendmentor.io/"]
      ]
    }
  ];

  var PROJECTS = [
    {
      id: "personal-site",
      title: "Your own site",
      level: "starter",
      stage: 4,
      time: "1 weekend",
      stack: ["HTML", "CSS", "Git"],
      brief:
        "One page that says who you are, what you're learning and how to reach you. It is the easiest project you'll ever ship and the one you'll link for years.",
      must: ["Semantic sections and one h1", "Works at 360px with no horizontal scroll", "Deployed to a public URL", "A README with how to run it"],
      stretch: ["A dark/light theme toggle", "Keyboard-navigable navigation"],
      done: "You can hand the link to a stranger and nothing looks broken."
    },
    {
      id: "pricing-clone",
      title: "Layout clone",
      level: "starter",
      stage: 3,
      time: "6–8 hours",
      stack: ["HTML", "CSS Grid"],
      brief:
        "Rebuild a pricing or feature block from a product you admire. Copying well is the fastest way to internalise layout.",
      must: ["Grid for the cards, flex inside them", "Fluid type with clamp()", "Hover and focus states", "Side-by-side comparison at four widths"],
      stretch: ["A monthly/yearly toggle with no JavaScript", "Container queries for the card internals"],
      done: "At 1440px it's hard to tell which version is yours."
    },
    {
      id: "expense-tracker",
      title: "Expense tracker",
      level: "core",
      stage: 6,
      time: "2–3 days",
      stack: ["JavaScript", "localStorage"],
      brief:
        "Add expenses, categorise them, see a running total and a tiny chart. State management without a framework, so you learn what frameworks do for you.",
      must: ["Add, edit, delete", "Total and per-category totals", "Data survives a reload", "Empty state when nothing is stored"],
      stretch: ["Export to CSV", "Undo the last delete"],
      done: "You can explain exactly where the state lives and when it re-renders."
    },
    {
      id: "api-search",
      title: "Public API search",
      level: "core",
      stage: 6,
      time: "1–2 days",
      stack: ["fetch", "async/await"],
      brief:
        "Search a real dataset over HTTP. The point is the states around the data: typing, loading, no results, and the request that failed.",
      must: ["Debounced input", "Loading skeleton", "Empty and error states", "Retry without a reload"],
      stretch: ["Recent searches in localStorage", "Cancelled in-flight requests with AbortController"],
      done: "Disconnect your network and the UI still behaves like it was designed."
    },
    {
      id: "react-dashboard",
      title: "React dashboard",
      level: "core",
      stage: 7,
      time: "3–5 days",
      stack: ["React", "Vite", "React Router"],
      brief:
        "A list, a detail view and a filter across three routes, sharing one layout and one data-loading pattern.",
      must: ["Three routes with a shared layout", "Reusable card and table components", "URL-driven filter state", "Loading and error handling per view"],
      stretch: ["Dark/light theme in context", "A skeleton that matches the real layout"],
      done: "Adding a fourth page takes minutes, not a copy-paste spree."
    },
    {
      id: "notes-api",
      title: "Notes REST API",
      level: "core",
      stage: 8,
      time: "2–3 days",
      stack: ["Node", "Express/Hono", "Zod"],
      brief:
        "A backend with no UI: five endpoints, validation, pagination and errors that a front-end developer could actually work with.",
      must: ["CRUD endpoints with correct status codes", "Schema validation on every write", "Pagination and a health check", "A script that exercises every route"],
      stretch: ["Rate limiting", "OpenAPI or a docs page"],
      done: "A stranger could build a UI against your API without asking you questions."
    },
    {
      id: "blog-db",
      title: "Blog with a real database",
      level: "advanced",
      stage: 9,
      time: "4–6 days",
      stack: ["SQL", "Node", "Prisma"],
      brief:
        "Users, posts and comments in related tables, with the queries that make a blog feel alive: latest posts, author names, comment counts.",
      must: ["Three related tables with constraints", "Joins for list views (no N+1)", "Migration history in the repo", "Seed script for demo data"],
      stretch: ["Full-text search", "Draft and published states"],
      done: "You can draw the schema from memory and defend every column."
    },
    {
      id: "multi-user-app",
      title: "Multi-user app with auth",
      level: "advanced",
      stage: 10,
      time: "1–2 weeks",
      stack: ["Auth", "Sessions", "Playwright"],
      brief:
        "Sign up, sign in, and a private area where every query is scoped to the signed-in user. The capstone that proves you can be trusted with other people's data.",
      must: ["Hashed passwords, never plaintext", "Every read and write scoped by user id", "A test where a second account sees nothing", "CI running the tests on every push"],
      stretch: ["Password reset by email", "Audit log of destructive actions"],
      done: "You can demo an attack attempt on your own app and show it failing."
    }
  ];

  // Derive stable lesson ids so saved progress survives copy edits elsewhere.
  STAGES.forEach(function (stage) {
    stage.lessons = stage.lessons.map(function (lesson, i) {
      return { id: stage.id + "-" + (i + 1), t: lesson[0], d: lesson[1] };
    });
    stage.resources = stage.resources.map(function (r) {
      return { label: r[0], url: r[1] };
    });
    stage.phaseInfo = PHASES.filter(function (p) { return p.id === stage.phase; })[0];
  });

  var TOTAL_HOURS = STAGES.reduce(function (sum, s) { return sum + s.hours; }, 0);
  var TOTAL_LESSONS = STAGES.reduce(function (sum, s) { return sum + s.lessons.length; }, 0);

  return {
    PHASES: PHASES,
    STAGES: STAGES,
    PROJECTS: PROJECTS,
    TOTAL_HOURS: TOTAL_HOURS,
    TOTAL_LESSONS: TOTAL_LESSONS,
    phaseById: function (id) {
      return PHASES.filter(function (p) { return p.id === id; })[0];
    },
    stageById: function (id) {
      return STAGES.filter(function (s) { return s.id === id; })[0];
    },
    projectById: function (id) {
      return PROJECTS.filter(function (p) { return p.id === id; })[0];
    }
  };
})();
