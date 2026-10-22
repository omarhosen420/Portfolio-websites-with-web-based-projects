/**
 * Copies the hand-written static site into dist/ for the Worker to serve.
 * No bundler, no framework — just a clean, deployable snapshot.
 */
import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist");

const PAGES = [
  "index.html",
  "contact.html",
  "movie-ranking.html",
  "birthday.html",
  "movie ranking project.html",
  "birthday invitation.html"
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const page of PAGES) {
  await cp(join(root, page), join(out, page));
}
await cp(join(root, "assets"), join(out, "assets"), { recursive: true });

const files = await readdir(out);
console.log(`built dist/ → ${files.join(", ")}`);
