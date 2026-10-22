# Omar's Portfolio

A hand-built portfolio for **Mohammad Omar Hosen** — CSE student, front-end tinkerer, Dhaka.

Static pages served by a Cloudflare Worker, with a **D1 database** behind the interactive parts
(guestbook, contact form, birthday RSVP, page likes, the visit counter and the AetherOS encrypted
vault). Two self-contained apps ship alongside the portfolio pages: **ZeroStack** (`devpath/`) and
**AetherOS** (`aether/`).

## Live

| Host | URL | Notes |
| ---- | --- | ----- |
| GitHub Pages | https://omarhosen420.github.io/Portfolio-websites-with-web-based-projects/ | Pages only serves static files; the API calls the Worker below |
| Production   | https://site-70c8da266b74437b9066daf6785f9b11.freebuff.page | Pages + Worker + D1 in one origin |
| Preview      | https://site-fd738429b66846d7937825137bcbf3e1.freebuff.page | Same, with its own separate database |

Each environment has its own isolated D1 database, so guestbook entries written on preview never
appear in production.

### GitHub Pages

Pages publishes this repository from `main` (branch source, root folder), so the site goes live at
https://omarhosen420.github.io/html-portfolio/ on every push. No build step is needed: every link
and asset path is relative, so the pages also work under the `/html-portfolio/` subpath.
`.nojekyll` keeps Jekyll from processing the files.

GitHub Pages cannot run a Worker, so when the pages are served from `*.github.io` the front-end
sends API calls to the deployed Worker instead — see `API_ORIGIN` in `assets/js/app.js`. That
origin is allowed through CORS in `src/worker.js`; edit `ALLOWED_ORIGINS` if the domain changes.

One consequence of branch-source hosting: the whole repository is publicly readable, so files such
as `package.json` and `src/worker.js` can be fetched from the Pages URL. None of them contain
secrets, but keep it that way.

## What's in here

```
devpath/                ZeroStack — the learning site (see below)
aether/                 AetherOS — the cyber-arcane workspace (see below)
index.html              Home — hero, about, skills, projects, hobbies, guestbook
contact.html            Contact form + direct contact cards
movie-ranking.html      Movie ranking project page
birthday.html           Birthday invitation with live countdown + RSVP
assets/css/styles.css   Design system: tokens, light/dark theme, components, animation
assets/js/app.js        All interactions: reveals, tilt, magnets, toasts, bounce modal, confetti
src/worker.js           Worker: static assets + JSON API
migrations/             D1 schema (also applied automatically on first API call)
scripts/build.mjs       Copies the static site into dist/ for the Worker
scripts/smoke.mjs       End-to-end HTTP test for pages and API
deploy.json             Deployment manifest (Worker + dist assets)
```

The two original filenames (`movie ranking project.html`, `birthday invitation.html`) are kept as
redirect stubs so old links keep working.

## Run it locally

```bash
npm install
npm run build        # assembles dist/
npm run dev          # wrangler dev on http://localhost:3000 (local D1, no account needed)
npm test             # 89 end-to-end HTTP checks against the running server
```

Two more suites cover what HTTP cannot:

```bash
node .tools/aether-crypto.mjs   # vault crypto: AES-GCM round-trip, wrong passphrase, tampering
node .tools/aether-dom.mjs      # drives the real AetherOS page in jsdom, including encrypted sync
```

Both need `node_modules` and jsdom available to Node (`createRequire` points at `/tmp/pw/`); the
DOM suite also needs the dev server running on port 3000.

`npm run dev` uses a local SQLite-backed D1 instance. The schema is created on the first API
request, so there is no migration step to remember.

## API

| Method | Route                          | Purpose                                      |
| ------ | ------------------------------ | -------------------------------------------- |
| POST   | `/api/visit`                   | Increment the visit counter (1× per hour/IP) |
| GET    | `/api/stats`                   | Visits, like tallies, guestbook count        |
| POST   | `/api/like`                    | `{ project, delta }` — one like per visitor  |
| GET    | `/api/messages?kind=&limit=`   | Guestbook / RSVP list                        |
| POST   | `/api/messages`                | `{ name, email?, message, kind }`            |
| GET    | `/api/aether/vault?sigil=`     | Read one encrypted vault blob                |
| PUT    | `/api/aether/vault`            | Create/update a vault (write key + revision)  |
| DELETE | `/api/aether/vault`            | Erase a vault (write key + revision)         |
| GET    | `/api/health`                  | Health probe                                 |

`kind` is one of `guestbook`, `contact`, `rsvp`. All writes are validated, length-capped, rate
limited to 5 per minute per visitor, and stored with bound SQL parameters. Public responses never
include email addresses.

## ZeroStack (the learning site)

`devpath/` is a second, self-contained site: a 24-week path that takes someone with no
coding background to full-stack developer. Twelve stages, 55 lessons, eight project
briefs, saved progress, a searchable command palette and a light/dark theme.

| Host | URL |
| ---- | --- |
| GitHub Pages | https://omarhosen420.github.io/Portfolio-websites-with-web-based-projects/devpath/ |
| Worker | `<worker-origin>/devpath/` |

It has no backend of its own on purpose: progress lives in the visitor's `localStorage`,
so there is no account and nothing to moderate. Because Pages serves the repository root,
`devpath/` goes live with the rest of the site on every push; `scripts/build.mjs` copies it
into `dist/`, so the Worker deployment serves it from the same origin too.

The roadmap and the project briefs are rendered from `devpath/assets/js/curriculum.js` —
edit the curriculum there, not the HTML. Each page carries a `<noscript>` outline of the
syllabus so the content still reads without JavaScript.

## AetherOS (the cyber-arcane workspace)

`aether/` is a productivity app disguised as a cyberpunk wizard's grimoire: tasks are *spells* you
cast into four realms, compiling one pays xp and returns mana, the vault floats those realms in a
3D chamber, and the codex binds notes into a flip-book with holographic interference.

| Host | URL |
| ---- | --- |
| GitHub Pages | https://omarhosen420.github.io/Portfolio-websites-with-web-based-projects/aether/ |
| Worker | `<worker-origin>/aether/` |

No framework, no bundler: hand-written HTML/CSS/JS in four files.

| File | Job |
| ---- | --- |
| `aether/assets/js/crypto.js` | PBKDF2-SHA256 (600,000 iterations) → AES-256-GCM. Runs in the browser and in Node. |
| `aether/assets/js/store.js` | state, `localStorage` persistence, mana/xp rules, encrypted sync |
| `aether/assets/js/fx.js` | canvas particles, rune circles, ambient motes |
| `aether/assets/js/app.js` | hash router, rendering, delegated events, palette |

### The vault is a locker, not a reader

The server stores **one base64 blob per sigil**. The passphrase never leaves the browser and the
server has no key, so it cannot read a grimoire even if it wanted to. Two things stop one visitor
from clobbering another's locker:

- a **write key** — 32 random bytes kept *inside* the ciphertext, proven to the server by SHA-256
  hash. Reading the blob does not reveal it, so a stranger can fetch ciphertext but cannot
  overwrite or delete it.
- a **revision number** — every write bumps it, and a stale write gets `409` instead of silently
  winning.

Consequences worth knowing: losing the passphrase means losing the data (there is no reset link,
because nobody can open it for you), and the sigil is an address rather than a secret — treat it
like a username. The app is local-first: with the network gone, everything still works and saves.

Model choice: the requested Spring Boot backend cannot run on GitHub Pages, and this repository has
no host for a JVM. The API is therefore implemented on the Worker + D1 that already back the site,
so the app is genuinely full-stack and live rather than half-deployed.

## Design notes

- One design system, no framework, no build step for the front-end.
- Light/dark theme persisted in `localStorage`, set before first paint (no flash).
- Motion: scroll reveals, split-text headline, 3D tilt, magnetic buttons, marquee, animated
  counters, skill bars, floating blobs, cursor spotlight, confetti, bounce-in modal and toasts.
- Every animation is disabled under `prefers-reduced-motion`.
- Progressive enhancement: with JavaScript or the API unavailable, every page still reads correctly.
