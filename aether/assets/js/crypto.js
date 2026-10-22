/* ==========================================================================
   AetherOS — vault cryptography
   --------------------------------------------------------------------------
   Everything here runs in the browser, and in Node for the test suite. The
   server is handed base64 ciphertext and nothing else: it never sees the
   passphrase, the key, or the plaintext.

     passphrase ──PBKDF2-SHA256 (600k, 16-byte random salt)──▶ AES-256 key
     state JSON ──AES-GCM (96-bit random IV, authenticated)──▶ ciphertext

   600,000 iterations is the OWASP Password Storage Cheat Sheet baseline for
   PBKDF2-HMAC-SHA256. AES-GCM is authenticated, so a tampered blob fails to
   decrypt instead of decrypting to something wrong.
   ========================================================================== */
(function (root) {
  "use strict";

  var ITERATIONS = 600000;
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var MAGIC = "aetheros/1|";

  function subtle() {
    var c = root.crypto;
    if (!c || !c.subtle) throw new Error("This browser has no WebCrypto — the vault is unavailable.");
    return c.subtle;
  }

  function toBytes(text) {
    return new TextEncoder().encode(text);
  }

  function bytesToB64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof root.btoa === "function") return root.btoa(binary);
    return Buffer.from(bytes).toString("base64"); // eslint-disable-line no-undef
  }

  function b64ToBytes(value) {
    var binary;
    if (typeof root.atob === "function") binary = root.atob(value);
    else binary = Buffer.from(value, "base64").toString("binary"); // eslint-disable-line no-undef
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomBytes(length) {
    var bytes = new Uint8Array(length);
    root.crypto.getRandomValues(bytes);
    return bytes;
  }

  function makeSalt() {
    return bytesToB64(randomBytes(SALT_BYTES));
  }

  // 32 random bytes as hex — this is the vault's write key. It proves the
  // holder may overwrite the locker; it never leaves this device unhashed.
  function makeWriteKey() {
    return [...randomBytes(32)].map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  async function deriveKey(passphrase, saltB64, iterations) {
    if (typeof passphrase !== "string" || passphrase.length < 8) {
      throw new Error("Use a passphrase of at least 8 characters.");
    }
    var base = await subtle().importKey("raw", toBytes(passphrase), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "PBKDF2", salt: b64ToBytes(saltB64), iterations: iterations || ITERATIONS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(key, value) {
    var iv = randomBytes(IV_BYTES);
    var plaintext = toBytes(MAGIC + JSON.stringify(value));
    var cipher = await subtle().encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
    return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(cipher)) };
  }

  async function decrypt(key, ivB64, ciphertextB64) {
    var plain;
    try {
      plain = await subtle().decrypt(
        { name: "AES-GCM", iv: b64ToBytes(ivB64) },
        key,
        b64ToBytes(ciphertextB64)
      );
    } catch (error) {
      // GCM authentication failed: wrong passphrase, or the blob was altered
      throw new Error("That passphrase does not open this vault.");
    }
    var text = new TextDecoder().decode(plain);
    if (text.indexOf(MAGIC) !== 0) throw new Error("This vault was written by a newer AetherOS.");
    return JSON.parse(text.slice(MAGIC.length));
  }

  var api = {
    ITERATIONS: ITERATIONS,
    makeSalt: makeSalt,
    makeWriteKey: makeWriteKey,
    deriveKey: deriveKey,
    encrypt: encrypt,
    decrypt: decrypt,
    bytesToB64: bytesToB64,
    b64ToBytes: b64ToBytes
  };

  root.AetherCrypto = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
