# Omar's Portfolio

A hand-built portfolio for **Mohammad Omar Hosen** — CSE student, front-end tinkerer, Dhaka.

Four static pages served by a Cloudflare Worker, with a **D1 database** behind the interactive
parts (guestbook, contact form, birthday RSVP, page likes and the visit counter).

## Live

| Host | URL | Notes |
| ---- | --- | ----- |
| GitHub Pages | https://omarhosen420.github.io/html-portfolio/ | Pages only serves static files; the API calls the Worker below |
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
devpath/                ZeroStack — the separate learning site (see below)
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
npm test             # 33 end-to-end checks against the running server
```

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
| GitHub Pages | https://omarhosen420.github.io/html-portfolio/devpath/ |
| Worker | `<worker-origin>/devpath/` |

It has no backend of its own on purpose: progress lives in the visitor's `localStorage`,
so there is no account and nothing to moderate. Because Pages serves the repository root,
`devpath/` goes live with the rest of the site on every push; `scripts/build.mjs` copies it
into `dist/`, so the next Worker deploy ships it too (the Worker deployment in production
predates it until then).

The roadmap and the project briefs are rendered from `devpath/assets/js/curriculum.js` —
edit the curriculum there, not the HTML. Each page carries a `<noscript>` outline of the
syllabus so the content still reads without JavaScript.

## Design notes

- One design system, no framework, no build step for the front-end.
- Light/dark theme persisted in `localStorage`, set before first paint (no flash).
- Motion: scroll reveals, split-text headline, 3D tilt, magnetic buttons, marquee, animated
  counters, skill bars, floating blobs, cursor spotlight, confetti, bounce-in modal and toasts.
- Every animation is disabled under `prefers-reduced-motion`.
- Progressive enhancement: with JavaScript or the API unavailable, every page still reads correctly.
