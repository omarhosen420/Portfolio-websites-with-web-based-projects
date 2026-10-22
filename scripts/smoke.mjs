/**
 * End-to-end smoke test against a running Worker (local wrangler dev or a
 * deployed preview). Usage: BASE=http://127.0.0.1:3000 npm test
 */
const BASE = process.env.BASE || "http://127.0.0.1:3000";

let failures = 0;
const results = [];

function check(name, condition, detail = "") {
  if (condition) {
    results.push(`  ✓ ${name}`);
  } else {
    failures++;
    results.push(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

async function get(path, headers = {}) {
  // follow redirects: Cloudflare assets map /contact.html → /contact
  const res = await fetch(BASE + path, { headers });
  return { res, text: await res.text(), finalUrl: res.url };
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { res, data };
}

console.log(`Smoke testing ${BASE}\n`);

/* ---------------------------------------------------------------- pages */
const pages = [
  ["index.html", "Crafting bold"],
  ["contact.html", "Send me a message"],
  ["movie-ranking.html", "Demon Slayer"],
  ["birthday.html", "Save your spot"],
  ["assets/css/styles.css", "--violet"],
  ["assets/js/app.js", "initGuestbook"],
  ["assets/images/image.png", ""]
];

for (const [path, needle] of pages) {
  const { res, text } = await get("/" + path);
  check(`${path} → 200`, res.status === 200, "status " + res.status);
  if (needle) check(`${path} contains expected content`, text.includes(needle));
}

const { res: legacy, text: legacyBody } = await get("/movie%20ranking%20project.html");
check("legacy movie URL still served", legacy.status === 200 && legacyBody.includes("movie-ranking.html"));

const { res: home } = await get("/");
check("root serves the homepage", home.status === 200 && home.headers.get("content-type").includes("text/html"));

const { res: missing } = await get("/definitely-not-a-page");
check("unknown static path → 404", missing.status === 404, "status " + missing.status);

/* ------------------------------------------------------------------ api */
const stats = await get("/api/stats");
let statsJson = null;
try { statsJson = JSON.parse(stats.text); } catch { /* ignore */ }
check("GET /api/stats → 200", stats.res.status === 200, "status " + stats.res.status);
check("stats has likes map", !!statsJson && typeof statsJson.likes === "object");
check("stats has numeric visits", !!statsJson && typeof statsJson.visits === "number");

const visit1 = await post("/api/visit", {});
check("POST /api/visit → 200", visit1.res.status === 200);
check("visit returns a counter", !!visit1.data && typeof visit1.data.visits === "number", JSON.stringify(visit1.data));

const like = await post("/api/like", { project: "movie", delta: 1 });
check("POST /api/like → 200", like.res.status === 200);
check("like returns a count", !!like.data && typeof like.data.likes.movie === "number", JSON.stringify(like.data));

const badLike = await post("/api/like", { project: "'; DROP TABLE counters; --" });
check("unknown project rejected", badLike.res.status === 400);

const booked = `Smoke tester ${Date.now()}`;
const created = await post("/api/messages", {
  name: booked,
  message: "Testing the guestbook end to end.",
  kind: "guestbook"
});
check("POST /api/messages → 201", created.res.status === 201, "status " + created.res.status);
check("message echoed back", !!created.data && created.data.item && created.data.item.name === booked);

const list = await get("/api/messages?kind=guestbook&limit=20");
let listJson = null;
try { listJson = JSON.parse(list.text); } catch { /* ignore */ }
check("guestbook list includes the new note", !!listJson && listJson.items.some((i) => i.name === booked));
check("guestbook items expose no email", !!listJson && listJson.items.every((i) => !("email" in i)));

const privateList = await get("/api/messages?kind=contact");
check("contact messages are not publicly listable", privateList.res.status === 400, "status " + privateList.res.status);

const badContact = await post("/api/messages", { name: "No Mail", message: "hello there friend", kind: "contact" });
check("contact form requires a valid email", badContact.res.status === 400);

const rsvp = await post("/api/messages", { name: "RSVP " + Date.now(), message: "is coming", kind: "rsvp" });
check("birthday RSVP saves", rsvp.res.status === 201);

const unknown = await get("/api/nope");
check("unknown API route → 404", unknown.res.status === 404);

const health = await get("/api/health");
check("health check → 200", health.res.status === 200);

console.log(results.join("\n"));
console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${results.length - failures}/${results.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);
