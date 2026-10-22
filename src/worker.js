/**
 * Omar's portfolio — Worker API + static asset host.
 *
 * Storage: Cloudflare D1 (binding DB)
 *   counters(key, value)              → 'visits' + 'like:<project>' tallies
 *   messages(id, name, email, message, kind, ip_hash, created_at)
 *   visitors(ip_hash, last_seen)      → de-duplicates the visit counter
 *   vaults(sigil, salt, iv, ciphertext, revision, updated_at)
 *                                     → AetherOS: client-side-encrypted state.
 *                                       The server never holds a key, only
 *                                       ciphertext it cannot read.
 *
 * The schema is created lazily on the first API call so a fresh database
 * (local or hosted) works with no manual migration step.
 */

const PROJECTS = new Set(["movie", "anime", "avatar", "birthday", "portfolio", "zerostack", "aether"]);
const KINDS = new Set(["guestbook", "contact", "rsvp"]);
// only these are readable through the public list endpoint
const PUBLIC_KINDS = new Set(["guestbook", "rsvp"]);
const HOUR = 60 * 60 * 1000;

const LIMITS = {
  name: 60,
  email: 120,
  message: 1200,
  guestbookMessage: 240
};

let schemaReady = null;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function fail(status, message) {
  return json({ error: message }, status);
}

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = env.DB;
      if (!db) throw new Error("DB binding missing");

      await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS counters (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL DEFAULT 0
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          message TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'guestbook',
          ip_hash TEXT,
          created_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_kind ON messages (kind, id DESC)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS visitors (
          ip_hash TEXT PRIMARY KEY,
          last_seen INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS like_ledger (
          ip_hash TEXT NOT NULL,
          project TEXT NOT NULL,
          PRIMARY KEY (ip_hash, project)
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS vaults (
          sigil TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          iv TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1,
          write_hash TEXT NOT NULL,
          ip_hash TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(`INSERT OR IGNORE INTO counters (key, value) VALUES ('visits', 0)`)
      ]);

      // seed like counters so reads never come back empty
      const seeds = [];
      for (const project of PROJECTS) {
        seeds.push(db.prepare(`INSERT OR IGNORE INTO counters (key, value) VALUES (?, 0)`).bind("like:" + project));
      }
      if (seeds.length) await db.batch(seeds);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function visitorHash(request) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "local";
  const data = new TextEncoder().encode(ip.trim() + "|omar-portfolio");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  // strip control characters, collapse whitespace, enforce a hard length cap
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function readCount(row, key) {
  return (row && Number.isFinite(Number(row[key]))) ? row[key] : 0;
}

/* ------------------------------------------------------------------ routes */

async function handleVisit(env, request) {
  const hash = await visitorHash(request);
  const now = Date.now();
  const seen = await env.DB.prepare("SELECT last_seen FROM visitors WHERE ip_hash = ?")
    .bind(hash)
    .first();

  if (!seen || now - Number(seen.last_seen) > HOUR) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO visitors (ip_hash, last_seen) VALUES (?, ?)
         ON CONFLICT(ip_hash) DO UPDATE SET last_seen = excluded.last_seen`
      ).bind(hash, now),
      env.DB.prepare(`UPDATE counters SET value = value + 1 WHERE key = 'visits'`)
    ]);
  }

  const row = await env.DB.prepare("SELECT value FROM counters WHERE key = 'visits'").first();
  return json({ visits: readCount(row, "value") });
}

async function handleStats(env) {
  const [counters, notes] = await env.DB.batch([
    env.DB.prepare("SELECT key, value FROM counters"),
    env.DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE kind = 'guestbook'")
  ]);

  const likes = {};
  for (const project of PROJECTS) likes[project] = 0;
  let visits = 0;
  for (const row of counters.results || []) {
    if (row.key === "visits") visits = Number(row.value) || 0;
    else if (row.key.startsWith("like:")) {
      const slug = row.key.slice(5);
      if (PROJECTS.has(slug)) likes[slug] = Number(row.value) || 0;
    }
  }
  const total = (notes.results && notes.results[0] && Number(notes.results[0].total)) || 0;
  return json({ visits, likes, notes: total });
}

async function handleLike(env, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const project = clean(body.project, 32);
  if (!PROJECTS.has(project)) return fail(400, "Unknown project");

  const delta = body.delta === -1 ? -1 : 1;
  const hash = await visitorHash(request);

  // one like per visitor per project, enforced server-side
  const existing = await env.DB.prepare("SELECT 1 AS hit FROM like_ledger WHERE ip_hash = ? AND project = ?")
    .bind(hash, project)
    .first();

  if (delta === 1 && !existing) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO like_ledger (ip_hash, project) VALUES (?, ?)").bind(hash, project),
      env.DB.prepare("UPDATE counters SET value = value + 1 WHERE key = ?").bind("like:" + project)
    ]);
  } else if (delta === -1 && existing) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM like_ledger WHERE ip_hash = ? AND project = ?").bind(hash, project),
      env.DB.prepare("UPDATE counters SET value = MAX(value - 1, 0) WHERE key = ?").bind("like:" + project)
    ]);
  }

  const row = await env.DB.prepare("SELECT value FROM counters WHERE key = ?")
    .bind("like:" + project)
    .first();

  return json({ likes: { [project]: readCount(row, "value") } });
}

async function handleList(env, url) {
  const kindRaw = url.searchParams.get("kind") || "guestbook";
  // contact submissions are private: never list them publicly
  if (!PUBLIC_KINDS.has(kindRaw)) return fail(400, "Unknown kind");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "12", 10) || 12, 1), 50);

  const [rows, total] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, name, message, created_at FROM messages
       WHERE kind = ? ORDER BY id DESC LIMIT ?`
    ).bind(kindRaw, limit),
    env.DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE kind = ?").bind(kindRaw)
  ]);

  return json({
    kind: kindRaw,
    items: (rows.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      message: row.message,
      created_at: row.created_at
    })),
    total: (total.results && Number(total.results[0].total)) || 0
  });
}

async function handleCreate(env, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const kind = clean(body.kind, 20) || "guestbook";
  if (!KINDS.has(kind)) return fail(400, "Unknown kind");

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, kind === "guestbook" ? LIMITS.guestbookMessage : LIMITS.message);

  if (name.length < 2) return fail(400, "Please include a name of at least 2 characters.");
  if (message.length < 4) return fail(400, "Message is too short.");
  if (kind === "contact" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return fail(400, "Please include a valid email address.");
  }

  const hash = await visitorHash(request);

  // light abuse guard: max 5 submissions per visitor per minute
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM messages WHERE ip_hash = ? AND kind = ? AND created_at > ?"
  )
    .bind(hash, kind, new Date(Date.now() - 60_000).toISOString())
    .first();
  if (recent && Number(recent.total) >= 5) {
    return fail(429, "Too many submissions — please wait a minute.");
  }

  const createdAt = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT INTO messages (name, email, message, kind, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(name, email || null, message, kind, hash, createdAt)
    .run();

  const item = {
    id: inserted.meta && inserted.meta.last_row_id,
    name,
    message,
    created_at: createdAt
  };
  return json({ ok: true, item, kind }, 201);
}

/* ---------------------------------------------------------------- AetherOS */

// AetherOS keeps its whole state as one client-encrypted blob. The server is a
// dumb, honest locker: it stores ciphertext it has no key for. Two things stop
// one visitor from clobbering another's locker — a write key (proven by hash)
// and an optimistic revision number.
const SIGIL_RE = /^[a-z0-9][a-z0-9_-]{2,23}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const HEX_RE = /^[a-f0-9]{64}$/;
const VAULT_LIMITS = { salt: 96, iv: 96, ciphertext: 190_000 };

function badBlob(value, max) {
  return typeof value !== "string" || value.length === 0 || value.length > max || !B64_RE.test(value);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleVaultGet(env, url) {
  const sigil = (url.searchParams.get("sigil") || "").toLowerCase();
  if (!SIGIL_RE.test(sigil)) return fail(400, "Invalid sigil");

  const row = await env.DB.prepare(
    "SELECT sigil, salt, iv, ciphertext, revision, updated_at FROM vaults WHERE sigil = ?"
  )
    .bind(sigil)
    .first();
  if (!row) return fail(404, "No vault under that sigil");

  return json({
    vault: {
      sigil: row.sigil,
      salt: row.salt,
      iv: row.iv,
      ciphertext: row.ciphertext,
      revision: Number(row.revision) || 0,
      updated_at: row.updated_at
    }
  });
}

async function readVaultBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: fail(400, "Invalid JSON") };
  }
  if (!body || typeof body !== "object") return { error: fail(400, "Invalid body") };

  const sigil = typeof body.sigil === "string" ? body.sigil.toLowerCase() : "";
  if (!SIGIL_RE.test(sigil)) return { error: fail(400, "Sigil must be 3-24 lowercase letters, digits, - or _") };

  const writeKey = typeof body.writeKey === "string" ? body.writeKey.toLowerCase() : "";
  if (!HEX_RE.test(writeKey)) return { error: fail(400, "Missing write key") };

  if (badBlob(body.salt, VAULT_LIMITS.salt)) return { error: fail(400, "Invalid salt") };
  if (badBlob(body.iv, VAULT_LIMITS.iv)) return { error: fail(400, "Invalid iv") };
  if (badBlob(body.ciphertext, VAULT_LIMITS.ciphertext)) return { error: fail(400, "Invalid ciphertext") };

  const revision = Number(body.revision);
  if (!Number.isInteger(revision) || revision < 0) return { error: fail(400, "Invalid revision") };

  return { sigil, writeKey, revision, salt: body.salt, iv: body.iv, ciphertext: body.ciphertext };
}

async function handleVaultPut(env, request) {
  const parsed = await readVaultBody(request);
  if (parsed.error) return parsed.error;
  const { sigil, writeKey, revision, salt, iv, ciphertext } = parsed;

  const writeHash = await sha256Hex(writeKey);
  const existing = await env.DB.prepare(
    "SELECT revision, write_hash FROM vaults WHERE sigil = ?"
  )
    .bind(sigil)
    .first();

  const now = new Date().toISOString();

  if (!existing) {
    if (revision !== 0) return fail(409, "Vault does not exist yet");
    await env.DB.prepare(
      `INSERT INTO vaults (sigil, salt, iv, ciphertext, revision, write_hash, ip_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`
    )
      .bind(sigil, salt, iv, ciphertext, writeHash, await visitorHash(request), now, now)
      .run();
    return json({ ok: true, revision: 1, updated_at: now }, 201);
  }

  // anyone can read a locker; only the holder of the write key may change it
  if (writeHash !== existing.write_hash) return fail(403, "Write key does not match this vault");
  if (revision !== Number(existing.revision)) {
    return json({ error: "Revision conflict", revision: Number(existing.revision) }, 409);
  }

  await env.DB.prepare(
    `UPDATE vaults SET salt = ?, iv = ?, ciphertext = ?, revision = revision + 1,
      ip_hash = ?, updated_at = ? WHERE sigil = ?`
  )
    .bind(salt, iv, ciphertext, await visitorHash(request), now, sigil)
    .run();

  return json({ ok: true, revision: Number(existing.revision) + 1, updated_at: now });
}

async function handleVaultDelete(env, request) {
  const parsed = await readVaultBody(request);
  if (parsed.error) return parsed.error;
  const { sigil, writeKey, revision } = parsed;

  const existing = await env.DB.prepare("SELECT revision, write_hash FROM vaults WHERE sigil = ?")
    .bind(sigil)
    .first();
  if (!existing) return fail(404, "No vault under that sigil");
  if ((await sha256Hex(writeKey)) !== existing.write_hash) return fail(403, "Write key does not match this vault");
  if (revision !== Number(existing.revision)) return fail(409, "Revision conflict");

  await env.DB.prepare("DELETE FROM vaults WHERE sigil = ?").bind(sigil).run();
  return json({ ok: true, deleted: sigil });
}

/* ------------------------------------------------------------------ fetch */

// The static pages can also be hosted without a Worker (GitHub Pages), in which
// case the browser calls this API cross-origin. Only these origins may do so.
const ALLOWED_ORIGINS = new Set(["https://omarhosen420.github.io"]);

function withCors(request, response) {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-max-age", "86400");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    return withCors(request, await handleRequest(request, env));
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "GET, POST, PUT, DELETE, OPTIONS" } });
  }

  if (!url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }

  try {
    await ensureSchema(env);
  } catch (error) {
    console.error("schema init failed", error);
    return fail(503, "Database unavailable");
  }

  const path = url.pathname.replace(/\/+$/, "");

  try {
    if (path === "/api/visit" && request.method === "POST") return await handleVisit(env, request);
    if (path === "/api/stats" && request.method === "GET") return await handleStats(env);
    if (path === "/api/like" && request.method === "POST") return await handleLike(env, request);
    if (path === "/api/messages" && request.method === "GET") return await handleList(env, url);
    if (path === "/api/messages" && request.method === "POST") return await handleCreate(env, request);
    if (path === "/api/aether/vault" && request.method === "GET") return await handleVaultGet(env, url);
    if (path === "/api/aether/vault" && request.method === "PUT") return await handleVaultPut(env, request);
    if (path === "/api/aether/vault" && request.method === "DELETE") return await handleVaultDelete(env, request);
    if (path === "/api/health") return json({ ok: true });
    return fail(404, "Not found");
  } catch (error) {
    console.error("api error", url.pathname, error);
    return fail(500, "Server error");
  }
}
