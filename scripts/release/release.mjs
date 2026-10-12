#!/usr/bin/env node
// Release helper. No dependencies, so it runs before `pnpm install`.
//
//   node scripts/release/release.mjs version 0.5.0   set the app version and date the CHANGELOG section
//   node scripts/release/release.mjs check v0.5.0    fail unless the tag matches the version in Cargo.toml
//   node scripts/release/release.mjs notes 0.5.0     print that version's CHANGELOG section (release notes)
//   node scripts/release/release.mjs updater-manifest 0.5.0 <setup.exe> <setup.exe.sig>
//                                                    print latest.json for the in-app updater
//   node scripts/release/release.mjs ci-scope <base> <head>
//                                                    print frontend=… and rust=… for $GITHUB_OUTPUT:
//                                                    which CI jobs have something to test in base..head
//
// The version lives in one place, [package] in src-tauri/Cargo.toml. tauri.conf.json and
// package.json have none; Tauri takes it from Cargo.toml.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CARGO_TOML = "src-tauri/Cargo.toml";
const CARGO_LOCK = "src-tauri/Cargo.lock";
const CHANGELOG = "CHANGELOG.md";

// Semver without build metadata; a pre-release (0.5.0-beta.1) becomes a GitHub pre-release.
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const PACKAGE_VERSION = /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/;

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

export function readVersion() {
  const match = readFileSync(join(root, CARGO_TOML), "utf8").match(PACKAGE_VERSION);
  if (!match) fail(`no version under [package] in ${CARGO_TOML}`);
  return match[2];
}

export function parseVersion(arg) {
  const version = (arg ?? "").replace(/^v/, "");
  if (!SEMVER.test(version)) fail(`"${arg ?? ""}" is not a version like 1.2.0 or 1.2.0-beta.1`);
  return version;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The lines under "## [version]" up to the next "## " heading.
export function changelogSection(text, version) {
  const lines = text.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${escape(version)}\\]`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
}

// Where the release workflow uploads the installer; the updater downloads it from there.
export const RELEASES = "https://github.com/etiennedelange/notes/releases";

// latest.json, read by tauri-plugin-updater from releases/latest/download/latest.json.
// `signature` is the content of the .sig file that `tauri build` writes next to the installer.
export function updaterManifest({ version, notes, exe, signature, date = new Date() }) {
  return {
    version,
    notes: notes ?? "",
    pub_date: date.toISOString(),
    platforms: {
      "windows-x86_64": {
        url: `${RELEASES}/download/v${version}/${encodeURIComponent(basename(exe))}`,
        signature: signature.trim(),
      },
    },
  };
}

// The files a release PR touches. CHANGELOG.md may change freely; it isn't code.
const RELEASE_FILES = new Set([CARGO_TOML, CARGO_LOCK, CHANGELOG]);

// Cargo.lock with the workspace crates' versions blanked: they have no `source` line, every
// crate from crates.io or git has one.
function lockWithoutWorkspaceVersions(text) {
  return text
    .split(/\n(?=\[\[package\]\])/)
    .map((block) => (/^source = /m.test(block) ? block : block.replace(/^version = ".*"$/m, 'version = "*"')))
    .join("\n");
}

// Whether a change only sets the app version (src-tauri/Cargo.toml's [package] and the workspace
// crates in Cargo.lock) and edits the CHANGELOG, as `release.mjs version` does. `files` are the
// changed paths; `before` and `after` read a path's content on each side (null if missing).
export function versionOnlyChange(files, before, after) {
  if (!files.length || files.some((f) => !RELEASE_FILES.has(f))) return false;
  const same = (file, normalize) => {
    const [a, b] = [before(file), after(file)];
    return a !== null && b !== null && normalize(a) === normalize(b);
  };
  const blankVersion = (text) => text.replace(PACKAGE_VERSION, "$1*$3");
  return (
    (!files.includes(CARGO_TOML) || same(CARGO_TOML, blankVersion)) &&
    (!files.includes(CARGO_LOCK) || same(CARGO_LOCK, lockWithoutWorkspaceVersions))
  );
}

// What each CI job tests. The same split the workflows' `paths:` filters make on pushes to main:
// the frontend job doesn't look at the site, the Rust crates, docs, the devcontainer, Markdown or
// other workflows; the Rust job looks only at src-tauri.
const isMarkdown = (f) => f.toLowerCase().endsWith(".md");
const FRONTEND_IGNORES = [/^site\//, /^src-tauri\//, /^docs\//, /^\.devcontainer\//, /^\.github\//];
const frontendFile = (f) =>
  f === ".github/workflows/ci.yml" || !(isMarkdown(f) || FRONTEND_IGNORES.some((re) => re.test(f)));
const rustFile = (f) => f === ".github/workflows/rust.yml" || (f.startsWith("src-tauri/") && !isMarkdown(f));

// Which CI jobs have something to test in a change. A release's version bump counts as nothing:
// the code it releases passed CI when it merged.
export function ciScope(files, before, after) {
  if (!files.length) return { frontend: true, rust: true };
  const rest = files.filter((f) => !isMarkdown(f));
  const releaseOnly = rest.length > 0 && versionOnlyChange(rest, before, after);
  return {
    frontend: files.some(frontendFile),
    rust: !releaseOnly && files.some(rustFile),
  };
}

export function setVersion(version) {
  const current = readVersion();
  const toml = join(root, CARGO_TOML);
  writeFileSync(toml, readFileSync(toml, "utf8").replace(PACKAGE_VERSION, `$1${version}$3`));
  // Updates only this crate's entry in Cargo.lock.
  execFileSync("cargo", ["update", "--package", "notes", "--offline"], {
    cwd: join(root, "src-tauri"),
    stdio: "inherit",
  });

  const changelog = join(root, CHANGELOG);
  const text = readFileSync(changelog, "utf8");
  if (changelogSection(text, version) !== null) {
    console.log(`CHANGELOG.md already has a [${version}] section; left as it is.`);
  } else if (!/^## \[Unreleased\]/m.test(text)) {
    fail('CHANGELOG.md has no "## [Unreleased]" heading');
  } else {
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(changelog, text.replace(/^## \[Unreleased\]/m, `## [Unreleased]\n\n## [${version}] - ${date}`));
  }
  console.log(`Version ${current} -> ${version}.`);
}

function main([command, arg, ...rest]) {
  switch (command) {
    case "version":
      setVersion(parseVersion(arg));
      break;
    case "check": {
      const version = parseVersion(arg);
      const current = readVersion();
      if (current !== version) fail(`tag ${arg} does not match version ${current} in ${CARGO_TOML}`);
      console.log(version);
      break;
    }
    case "notes": {
      const version = parseVersion(arg);
      const section = changelogSection(readFileSync(join(root, CHANGELOG), "utf8"), version);
      if (!section) fail(`CHANGELOG.md has no entries under "## [${version}]"`);
      console.log(section);
      break;
    }
    case "updater-manifest": {
      const version = parseVersion(arg);
      const [exe, sig] = rest;
      if (!exe || !sig) fail("usage: release.mjs updater-manifest <x.y.z> <setup.exe> <setup.exe.sig>");
      const notes = changelogSection(readFileSync(join(root, CHANGELOG), "utf8"), version);
      const manifest = updaterManifest({ version, notes, exe, signature: readFileSync(sig, "utf8") });
      console.log(JSON.stringify(manifest, null, 2));
      break;
    }
    case "ci-scope": {
      const [base, head] = [arg, rest[0]];
      if (!base || !head) fail("usage: release.mjs ci-scope <base> <head>");
      const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
      const show = (rev) => (file) => {
        try {
          return git("show", `${rev}:${file}`);
        } catch {
          return null;
        }
      };
      const files = git("diff", "--name-only", base, head).split("\n").filter(Boolean);
      const scope = ciScope(files, show(base), show(head));
      console.log(`frontend=${scope.frontend}\nrust=${scope.rust}`);
      break;
    }
    default:
      fail(
        "usage: release.mjs version <x.y.z> | check <vX.Y.Z> | notes <x.y.z> | updater-manifest <x.y.z> <exe> <sig> | ci-scope <base> <head>",
      );
  }
}

// Imported by the tests: no command runs then. import.meta.main needs Node 24.2; CI runners may
// run this with their own older Node, so compare the script path there.
const isMain =
  import.meta.main ?? (!!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url);
if (isMain) main(process.argv.slice(2));
