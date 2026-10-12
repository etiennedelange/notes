// pnpm test:scripts (node --test)
import assert from "node:assert/strict";
import { test } from "node:test";
import { changelogSection, ciScope, updaterManifest, versionOnlyChange } from "./release.mjs";

test("latest.json points at the release asset and carries the signature", () => {
  const manifest = updaterManifest({
    version: "0.5.0",
    notes: "### Added\n- Updates",
    exe: "src-tauri/target/release/bundle/nsis/Notes_0.5.0_x64-setup.exe",
    signature: "dW50cnVzdGVkIGNvbW1lbnQ=\n",
    date: new Date("2026-10-12T09:00:00Z"),
  });
  assert.deepEqual(manifest, {
    version: "0.5.0",
    notes: "### Added\n- Updates",
    pub_date: "2026-10-12T09:00:00.000Z",
    platforms: {
      "windows-x86_64": {
        url: "https://github.com/etiennedelange/notes/releases/download/v0.5.0/Notes_0.5.0_x64-setup.exe",
        signature: "dW50cnVzdGVkIGNvbW1lbnQ=",
      },
    },
  });
});

test("latest.json without CHANGELOG notes has empty notes", () => {
  const manifest = updaterManifest({ version: "0.5.0", notes: null, exe: "a.exe", signature: "s" });
  assert.equal(manifest.notes, "");
  assert.match(manifest.pub_date, /^\d{4}-\d\d-\d\dT/);
});

test("changelogSection stops at the next version", () => {
  const text =
    "# Changelog\n\n## [Unreleased]\n\n## [0.5.0] - 2026-10-12\n\n### Added\n- Updates\n\n## [0.4.0] - 2026-09-26\n- Old";
  assert.equal(changelogSection(text, "0.5.0"), "### Added\n- Updates");
  assert.equal(changelogSection(text, "9.9.9"), null);
});

const toml = (v, extra = "") =>
  `[workspace]\nmembers = ["core"]\n\n[package]\nname = "notes"\nversion = "${v}"\nedition = "2021"\n\n[dependencies]\nserde = "1"\n${extra}`;
const lock = (app, serde = "1.0.0") =>
  `version = 4\n\n[[package]]\nname = "notes"\nversion = "${app}"\ndependencies = [\n "serde",\n]\n\n[[package]]\nname = "serde"\nversion = "${serde}"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "abc"\n`;
const sides = (before, after) => [(f) => before[f] ?? null, (f) => after[f] ?? null];
const TOML = "src-tauri/Cargo.toml";
const LOCK = "src-tauri/Cargo.lock";

test("versionOnlyChange accepts what release.mjs version changes", () => {
  const [b, a] = sides(
    { [TOML]: toml("0.4.0"), [LOCK]: lock("0.4.0"), "CHANGELOG.md": "## [Unreleased]\n- x" },
    { [TOML]: toml("0.5.0"), [LOCK]: lock("0.5.0"), "CHANGELOG.md": "## [Unreleased]\n\n## [0.5.0]\n- x" },
  );
  assert.equal(versionOnlyChange(["CHANGELOG.md", LOCK, TOML], b, a), true);
  assert.equal(versionOnlyChange(["CHANGELOG.md"], b, a), true);
});

test("versionOnlyChange refuses anything else", () => {
  const before = { [TOML]: toml("0.4.0"), [LOCK]: lock("0.4.0") };
  const check = (files, after) => versionOnlyChange(files, ...sides(before, after));
  // Another file.
  assert.equal(check([TOML, "src-tauri/src/lib.rs"], { [TOML]: toml("0.5.0") }), false);
  // Another line in Cargo.toml (a new dependency, a profile change).
  assert.equal(check([TOML], { [TOML]: toml("0.5.0", '\n[profile.release]\nlto = "thin"\n') }), false);
  // A dependency's version in Cargo.lock.
  assert.equal(check([LOCK], { [LOCK]: lock("0.4.0", "1.0.1") }), false);
  // A file deleted, and an empty change.
  assert.equal(check([LOCK], {}), false);
  assert.equal(check([], {}), false);
});

test("ciScope matches each job to what it tests", () => {
  const [b, a] = sides(
    { [TOML]: toml("0.4.0"), [LOCK]: lock("0.4.0") },
    { [TOML]: toml("0.5.0"), [LOCK]: lock("0.5.0") },
  );
  const scope = (...files) => ciScope(files, b, a);
  const none = { frontend: false, rust: false };
  // Markdown, the site, docs and a release's version bump: nothing to test.
  assert.deepEqual(scope("README.md", "docs/HISTORY.md"), none);
  assert.deepEqual(scope("site/src/pages/index.astro"), none);
  assert.deepEqual(scope("CHANGELOG.md", TOML, LOCK), none);
  assert.deepEqual(scope(".github/workflows/audit.yml"), none);
  // The front end, its scripts and its own workflow.
  assert.deepEqual(scope("src/app.ts"), { frontend: true, rust: false });
  assert.deepEqual(scope("scripts/release/ship.mjs", "package.json"), { frontend: true, rust: false });
  assert.deepEqual(scope(".github/workflows/ci.yml"), { frontend: true, rust: false });
  // Rust code, a new dependency, its workflow.
  assert.deepEqual(scope("src-tauri/src/lib.rs"), { frontend: false, rust: true });
  assert.deepEqual(scope(".github/workflows/rust.yml"), { frontend: false, rust: true });
  const [b2, a2] = sides({ [TOML]: toml("0.4.0") }, { [TOML]: toml("0.5.0", 'x = "1"\n') });
  assert.deepEqual(ciScope([TOML], b2, a2), { frontend: false, rust: true });
  // A version bump plus code runs in full; an unknown change runs everything.
  assert.deepEqual(scope(TOML, LOCK, "src-tauri/src/lib.rs"), { frontend: false, rust: true });
  assert.deepEqual(scope(), { frontend: true, rust: true });
  assert.deepEqual(scope("notes.md.txt"), { frontend: true, rust: false });
});
