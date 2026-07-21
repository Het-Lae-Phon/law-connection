/**
 * Vendor the @thai-law/core SDK from Het-Lae-Phon/thai-law into this app.
 *
 * thai-law is the team's structured-legal-data monorepo (typed section
 * records with point-in-time versions, definitions, references — PDPA first).
 * It is consumed READ-ONLY: this script never pushes anything upstream.
 *
 * The SDK ships a browser-safe subpath (`packages/core/src/resolve.ts`,
 * "no Node built-ins ... for web apps that load the data records themselves")
 * which is exactly what a bundled Next.js app needs — so instead of npm-
 * installing the fs-based package we vendor:
 *   1. the pure SDK sources  → web/vendor/thai-law-core/src/
 *   2. each act's records bundled to one JSON → web/vendor/thai-law-core/bundle/<slug>.json
 * and web/lib/thai-law.ts re-creates the loader API on top of them.
 *
 * Usage: node scripts/sync-thai-law.mjs [ref]
 *        (default: the pinned commit below; pass a ref to upgrade, then
 *         commit the regenerated vendor/ so builds stay reproducible)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/Het-Lae-Phon/thai-law";
const PINNED = "586f89d519250d844dede74df20ad2a035b0fdd6"; // v0.2.0 data: PDPA 96 sections

const ref = process.argv[2] ?? PINNED;
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(webRoot, "vendor", "thai-law-core");

const tmp = mkdtempSync(join(tmpdir(), "thai-law-"));
try {
  console.log(`cloning ${REPO} @ ${ref.slice(0, 10)}...`);
  execFileSync("git", ["clone", "--quiet", REPO, tmp]);
  execFileSync("git", ["-C", tmp, "checkout", "--quiet", ref]);
  const sha = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

  // 1. pure SDK sources (types + text + resolve — the browser-safe layer).
  // The upstream uses NodeNext-style "./x.js" specifiers; Next's bundler
  // resolves TS without the extension, so rewrite them (vendored copy only).
  rmSync(vendorDir, { recursive: true, force: true });
  mkdirSync(join(vendorDir, "src"), { recursive: true });
  for (const f of ["types.ts", "text.ts", "resolve.ts"]) {
    const src = readFileSync(join(tmp, "packages/core/src", f), "utf8")
      .replace(/(from\s+"\.\/[a-z-]+)\.js(")/g, "$1$2");
    writeFileSync(join(vendorDir, "src", f), src);
  }

  // 2. bundle each act: { manifest, sections: SectionRecord[] }
  mkdirSync(join(vendorDir, "bundle"), { recursive: true });
  const slugs = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      if (existsSync(join(p, "act.json"))) {
        const manifest = JSON.parse(readFileSync(join(p, "act.json"), "utf8"));
        const sections = readdirSync(join(p, "sections"))
          .filter((f) => f.endsWith(".json"))
          .map((f) => JSON.parse(readFileSync(join(p, "sections", f), "utf8")));
        writeFileSync(
          join(vendorDir, "bundle", `${manifest.slug}.json`),
          JSON.stringify({ manifest, sections }),
        );
        slugs.push(`${manifest.slug} (${sections.length} sections)`);
      } else {
        walk(p);
      }
    }
  };
  walk(join(tmp, "data"));

  writeFileSync(
    join(vendorDir, "VERSION"),
    `source: ${REPO}\ncommit: ${sha}\nsynced: ${new Date().toISOString().slice(0, 10)}\nacts: ${slugs.join(", ")}\nlicense: Apache-2.0 (code) / see thai-law data/LICENSE (data)\n`,
  );
  console.log(`vendored ${slugs.length} act(s): ${slugs.join(", ")}`);
  console.log(`→ ${vendorDir}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
