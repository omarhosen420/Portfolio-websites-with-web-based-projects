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

async function send(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { res, data };
}

async function post(path, body) {
  return send("POST", path, body);
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

/* ------------------------------------------------------ devpath (site 2) */
const devpathPages = [
  ["/devpath/", "ZeroStack"],
  ["/devpath/index.html", "An ordinary person"],
  ["/devpath/roadmap.html", "Twelve stages"],
  ["/devpath/projects.html", "Eight builds"],
  ["/devpath/resources.html", "first seven"],
  ["/devpath/assets/css/devpath.css", "--accent"],
  ["/devpath/assets/js/curriculum.js", "how-the-web-works"],
  ["/devpath/assets/js/devpath.js", "initRoadmap"]
];

for (const [path, needle] of devpathPages) {
  const { res, text } = await get(path);
  check(`devpath ${path} → 200`, res.status === 200, "status " + res.status);
  if (needle) check(`devpath ${path} contains expected content`, text.includes(needle));
}

const { res: devMissing } = await get("/devpath/no-such-page");
check("devpath unknown path → 404", devMissing.status === 404, "status " + devMissing.status);

/* ---------------------------- devpath as a portfolio project (links/likes) */
const { text: homeBody } = await get("/index.html");
check("portfolio lists ZeroStack as a project", homeBody.includes("ZeroStack — zero to full-stack"));
check("portfolio project card links to devpath", homeBody.includes('href="devpath/"'));

const { res: cover } = await get("/assets/images/zerostack-cover.svg");
check("devpath cover art is served", cover.status === 200 && cover.headers.get("content-type").includes("svg"),
  "status " + cover.status);

const zsLike = await post("/api/like", { project: "zerostack", delta: 1 });
check("like endpoint accepts the zerostack project", zsLike.res.status === 200, "status " + zsLike.res.status);
check("zerostack has its own like tally", !!zsLike.data && typeof zsLike.data.likes.zerostack === "number",
  JSON.stringify(zsLike.data));
await post("/api/like", { project: "zerostack", delta: -1 });

/* -------------------------------------------------- aether (site 3) */
const aetherPages = [
  ["/aether/", "cyber-arcane"],
  ["/aether/index.html", 'id="view-host"'],
  ["/aether/assets/css/aether.css", "--violet"],
  ["/aether/assets/js/crypto.js", "600000"],
  ["/aether/assets/js/store.js", "AetherStore"],
  ["/aether/assets/js/fx.js", "AetherFX"],
  ["/aether/assets/js/app.js", "AetherApp"]
];

for (const [path, needle] of aetherPages) {
  const { res, text } = await get(path);
  check(`aether ${path} → 200`, res.status === 200, "status " + res.status);
  if (needle) check(`aether ${path} contains expected content`, text.includes(needle));
}

const { res: aetherCss } = await get("/aether/assets/css/aether.css");
check("aether CSS has the right content type", (aetherCss.headers.get("content-type") || "").includes("css"));

const { res: aetherMissing } = await get("/aether/no-such-page");
check("aether unknown path → 404", aetherMissing.status === 404, "status " + aetherMissing.status);

const { res: aetherCover } = await get("/assets/images/aether-cover.svg");
check("aether cover art is served", aetherCover.status === 200 && (aetherCover.headers.get("content-type") || "").includes("svg"),
  "status " + aetherCover.status);

const { text: homeWithAether } = await get("/index.html");
check("portfolio lists AetherOS as a project", homeWithAether.includes("AetherOS — the cyber-arcane workspace"));
check("portfolio AetherOS card links to the app", homeWithAether.includes('href="aether/"'));

const aeLike = await post("/api/like", { project: "aether", delta: 1 });
check("like endpoint accepts the aether project", aeLike.res.status === 200, "status " + aeLike.res.status);
check("aether has its own like tally", !!aeLike.data && typeof aeLike.data.likes.aether === "number", JSON.stringify(aeLike.data));
await post("/api/like", { project: "aether", delta: -1 });

/* the encrypted vault: the server must store and return bytes it cannot read */
const sigil = ("aeth-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toLowerCase().slice(0, 24);
const writeKey = "a".repeat(64);
const wrongKey = "b".repeat(64);
const blob = (salt, iv, ciphertext, revision, key) => ({ sigil, salt, iv, ciphertext, revision, writeKey: key || writeKey });

const seeded = await send("PUT", "/api/aether/vault", blob("c2FsdHNhbHQ=", "aXZpdml2", "Y2lwaGVydGV4dA==", 0));
check("vault accepts a new sealed blob → 201", seeded.res.status === 201, "status " + seeded.res.status + " " + JSON.stringify(seeded.data));
check("new vault starts at revision 1", !!seeded.data && seeded.data.revision === 1, JSON.stringify(seeded.data));

const readBack = await send("GET", "/api/aether/vault?sigil=" + encodeURIComponent(sigil));
check("vault reads back → 200", readBack.res.status === 200, "status " + readBack.res.status);
check("vault returns the exact ciphertext", !!readBack.data && readBack.data.vault.ciphertext === "Y2lwaGVydGV4dA==");
check("vault never returns the write key", !!readBack.data && !("writeKey" in readBack.data.vault) && !("write_hash" in readBack.data.vault));

const staleWrite = await send("PUT", "/api/aether/vault", blob("c2FsdHNhbHQ=", "aXZpdml2", "bmV3", 0));
check("stale revision is rejected → 409", staleWrite.res.status === 409, "status " + staleWrite.res.status);

const hostileWrite = await send("PUT", "/api/aether/vault", blob("c2FsdHNhbHQ=", "aXZpdml2", "bmV3", 1, wrongKey));
check("a stranger without the write key is refused → 403", hostileWrite.res.status === 403, "status " + hostileWrite.res.status);

const updated = await send("PUT", "/api/aether/vault", blob("c2FsdHNhbHQ=", "aXZpdml2", "dXBkYXRlZA==", 1));
check("a valid update is accepted → 200", updated.res.status === 200, "status " + updated.res.status);
check("a valid update bumps the revision", !!updated.data && updated.data.revision === 2, JSON.stringify(updated.data));

const badSigil = await send("GET", "/api/aether/vault?sigil=" + encodeURIComponent("NOPE!"));
check("invalid sigil rejected → 400", badSigil.res.status === 400, "status " + badSigil.res.status);

const missingVault = await send("GET", "/api/aether/vault?sigil=nobody-here");
check("unknown vault → 404", missingVault.res.status === 404, "status " + missingVault.res.status);

const deleted = await send("DELETE", "/api/aether/vault", blob("c2FsdHNhbHQ=", "aXZpdml2", "dXBkYXRlZA==", 2));
check("vault can be deleted by its holder → 200", deleted.res.status === 200, "status " + deleted.res.status);

const gone = await send("GET", "/api/aether/vault?sigil=" + encodeURIComponent(sigil));
check("deleted vault is gone → 404", gone.res.status === 404, "status " + gone.res.status);

console.log(results.join("\n"));
console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${results.length - failures}/${results.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);
