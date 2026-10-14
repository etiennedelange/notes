# Branches and releases

How changes reach `main`, how a release is cut, and how installed copies
update themselves. Adapted on 2026-10-12 from the Gitr repo's
`docs/releasing.md` (see the `HISTORY.md` entry of that date).

## Day to day

1. Branch from `main`: `feature/<topic>`, `fix/<topic>`, `chore/<topic>`.
2. Commit as often as you like; the branch's commits are squashed away.
3. Open a PR. Add a line under `[Unreleased]` in `CHANGELOG.md` for
   anything a user would notice. CI runs the `frontend` job (`ci.yml`) and
   the `rust` job (`rust.yml`) on every PR. Each job first asks
   `node scripts/release/release.mjs ci-scope HEAD^1 HEAD` whether the PR
   touches anything it tests, and skips its steps if not. The job still
   succeeds, so the required checks report and the PR can merge. Docs,
   site-only and release PRs take seconds.
4. **Squash and merge.** The PR title becomes the commit subject on `main`
   and a line in the generated release notes, so write it as one. Label it
   `feature`, `bug` or `skip-changelog` to sort it there
   (`.github/release.yml`).

## Cutting a release

The version lives in one place: `version` under `[package]` in
`src-tauri/Cargo.toml`. `tauri.conf.json` and `package.json` have none;
Tauri reads it from `Cargo.toml`.

```sh
pnpm release 0.5.0
```

`scripts/release/ship.mjs` checks first: no uncommitted changes to tracked
files, `gh` signed in, `v0.5.0` not tagged yet and not older than the newest
tag, and entries under the CHANGELOG's `[Unreleased]`. After you confirm, it:

1. Branches `release/0.5.0` from `origin/main` and runs
   `pnpm release:version 0.5.0`. That sets the version, updates `Cargo.lock`
   and turns the `[Unreleased]` entries into a dated `## [0.5.0]` section. It
   commits "Release 0.5.0" (signed, if your git signs commits) and pushes.
2. Opens the PR "Release 0.5.0" with the `skip-changelog` label and turns on
   squash auto-merge. CI sees a version-only change and skips its build and
   test steps, because the code already passed when it merged. Any other
   change on the release branch gets the full run.
3. Waits for the merge (checking every 10 seconds), tags the merge commit
   `v0.5.0`, pushes the tag, and switches you back to an up-to-date `main`.
4. Follows the Release workflow and prints the release page.

Ctrl+C is safe at any point. Run the same command again and it carries on
from where it stopped. `--yes` skips the question. If CI fails, fix it on the
release branch and run it again.

`.github/workflows/release.yml` then:

- checks the tag is on `main` and matches the version in `Cargo.toml`, and
  that the updater public key isn't the placeholder;
- builds `Notes_0.5.0_x64-setup.exe` with `pnpm tauri build --bundles nsis`
  on `windows-latest`, plus its updater signature `…-setup.exe.sig`;
- writes `latest.json` for the in-app updater (below);
- publishes the GitHub Release (not a draft) with the installer, its
  `.sig`, `latest.json` and `SHA256SUMS.txt`. The notes are the
  CHANGELOG's `[0.5.0]` section followed by GitHub's list of merged PRs;
- starts `site-rebuild.yml`, so the site's Download section picks the
  release up. A release made with the job's own token doesn't fire the
  `release: published` event that workflow also listens for.

Afterwards, add the release to `docs/RELEASES.md`.

A version with a pre-release part (`v0.5.0-beta.1`) is published as a
pre-release. Installed copies never see it, because the updater asks for
the *latest* release and GitHub's latest skips pre-releases. To try the
updater, release two normal patch versions.

If a run fails after the tag is pushed, fix the cause and rerun it
(**Actions → Release → Run workflow** with the tag). If the fix needs code,
make a new patch version instead.

## In-app updater

`tauri-plugin-updater` reads
`https://github.com/etiennedelange/notes/releases/latest/download/latest.json`
(`plugins.updater` in `tauri.conf.json`). `src/update.ts` checks 5 seconds
after startup and then every hour until it finds one, since Notes is often
left open for days; a failed check is only logged to the console. Clicking
the version (**v0.6.0**) in the status bar checks right away and says
whether Notes is up to date, showing any error. When a newer version
exists, the status bar shows **Update to x.y.z**. **Update Now**
then:

1. downloads the installer and checks its signature against
   `plugins.updater.pubkey` (`download_update` in `src-tauri/src/update.rs`);
2. asks about unsaved tabs and saves the session, as quitting does
   (`App.prepareToExit`). Cancelling keeps Notes running;
3. runs the NSIS installer in passive mode (`install_update`). The installer
   closes Notes and starts the new version.

Downloading comes before the unsaved-changes question so nothing typed
during the download is lost.

`latest.json` is written by
`node scripts/release/release.mjs updater-manifest <version> <setup.exe> <setup.exe.sig>`:

```json
{
  "version": "0.5.0",
  "notes": "the CHANGELOG's [0.5.0] section",
  "pub_date": "2026-10-12T09:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/etiennedelange/notes/releases/download/v0.5.0/Notes_0.5.0_x64-setup.exe",
      "signature": "the content of Notes_0.5.0_x64-setup.exe.sig"
    }
  }
}
```

Copies installed from v0.4.0 or earlier have no updater. They need the new
installer downloaded once by hand; from then on they update themselves.

### The updater signing key

`bundle.createUpdaterArtifacts` makes `tauri build` sign the installer with a
minisign key, and every installed copy checks updates against the public
half in `tauri.conf.json`. This is not code signing: SmartScreen still warns
once on first install. But it stops anyone who could swap a release asset
from pushing their own installer to every user.

Once, on your own machine:

```sh
pnpm tauri signer generate -w ~/.tauri/notes-updater.key   # asks for a password
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/notes-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD             # paste the password
```

Put the public key (`~/.tauri/notes-updater.key.pub`, one line) into
`plugins.updater.pubkey` in `src-tauri/tauri.conf.json`, replacing
`REPLACE_WITH_THE_PUBLIC_KEY`, and merge that before the first release.

**Back up the private key and its password** somewhere outside this machine,
such as a password manager. Without them no installed copy can ever be
updated again: their users would have to download a new installer by hand.
Changing the key works the same way, because copies that trust the old key
don't accept updates signed with the new one.

The release job fails early when the secret or the public key is missing.
`release-cache.yml` has no secrets, so it builds with
`--config src-tauri/tauri.no-updater.conf.json`. A local `pnpm tauri build`
needs the key in `TAURI_SIGNING_PRIVATE_KEY`, or that same `--config`.

## Build speed and caching

- **CI:** `Swatinem/rust-cache` keeps compiled dependencies, and
  `setup-node` keeps the pnpm store. Only `main` saves the Rust cache; PRs
  restore `main`'s, so they can't push it out of the 10 GB limit.
- **Releases:** a cache saved under a tag can't be read by later tags, so
  the release job only restores. `release-cache.yml` saves on `main`: it
  runs the same release build when `Cargo.lock`, a `Cargo.toml`,
  `pnpm-lock.yaml` or `tauri.conf.json` changes, and twice a week so the
  cache isn't evicted after 7 days unused. It caches the release-profile
  dependencies and Tauri's NSIS download (`%LOCALAPPDATA%\tauri`). It also
  catches a broken installer build before you tag. A release then compiles
  only Notes' own crates.

## Repository settings

`scripts/release/github-settings.sh` applies these. Run it once after
`gh auth login`, and again after changing it:

- squash merge only, with the PR title and body as the commit message;
- head branches deleted after merging; auto-merge and "Update branch"
  allowed;
- ruleset **main** (replacing the hand-made "Protect main"): changes only
  through a PR, squash only, linear history, no force-push or deletion,
  open review threads must be resolved, and the `frontend` and `rust` jobs
  must pass. A solo PR needs no approving review;
- ruleset **release tags**: `v*` tags can be created but not moved or
  deleted;
- the `feature`, `bug` and `skip-changelog` labels.

`pnpm release` needs auto-merge, so run the script before the first release.
The required checks are CI's job names, so rename them there and in the
script together.
